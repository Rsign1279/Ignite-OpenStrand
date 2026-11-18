import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/client-api";
import {
  registerWithRecovery,
  type PendingRegistration,
  type RegistrationAuth,
} from "@/lib/registration-recovery";
import type { Profile } from "@/lib/validation";
import {
  SESSION_CHANGED_MESSAGE,
  STUDENT_SESSION_HEADER,
} from "@/lib/student-session";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const desired: Profile = {
  name: "[QA Pilot] Agent 21",
  strand: "technology",
  ignite_year: 1,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let current: boolean;
let pending: PendingRegistration | null;
let cookieIdentity: string;
let anonymous: boolean;
let saved: Profile | null;
let losePostResponse: boolean;
let posts: number;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const auth = {
  signOut: vi.fn<RegistrationAuth["signOut"]>(),
  signInAnonymously: vi.fn<RegistrationAuth["signInAnonymously"]>(),
  getSession: vi.fn<RegistrationAuth["getSession"]>(),
};
const onPending = vi.fn((next: PendingRegistration | null) => {
  pending = next;
});
const readProfile = async (identity: string) => {
  let sessionIdentity: string | null = null;
  const profile = await api<Profile | null>(
    "/api/profile",
    undefined,
    undefined,
    {
      studentSessionId: identity,
      onResponse: (response) => {
        sessionIdentity = response.headers.get(STUDENT_SESSION_HEADER);
      },
    },
  );
  return { profile, sessionIdentity };
};
const writeProfile = async (identity: string, profile: Profile) => {
  let sessionIdentity: string | null = null;
  await api("/api/profile", profile, undefined, {
    studentSessionId: identity,
    onResponse: (response) => {
      sessionIdentity = response.headers.get(STUDENT_SESSION_HEADER);
    },
  });
  return { sessionIdentity };
};
const run = (profile: Profile = desired) =>
  registerWithRecovery({
    auth,
    desiredProfile: profile,
    pending,
    isCurrent: () => current,
    onPending,
    readProfile,
    writeProfile,
  });

beforeEach(() => {
  vi.resetAllMocks();
  current = true;
  pending = null;
  cookieIdentity = firstId;
  anonymous = true;
  saved = null;
  posts = 0;
  losePostResponse = false;
  onPending.mockImplementation((next) => {
    pending = next;
  });
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInAnonymously.mockResolvedValue({
    data: { user: { id: firstId, is_anonymous: true } },
    error: null,
  });
  auth.getSession.mockImplementation(async () => ({
    data: {
      session: {
        user: { id: cookieIdentity, is_anonymous: anonymous },
      },
    },
    error: null,
  }));
  fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
    const headers = new Headers(init?.headers);
    if (init?.method === "POST") {
      posts++;
      if (!anonymous)
        return Response.json(
          { error: "Use student access to register." },
          { status: 403 },
        );
      if (headers.get(STUDENT_SESSION_HEADER) !== cookieIdentity)
        return Response.json(
          { error: SESSION_CHANGED_MESSAGE },
          { status: 409 },
        );
      if (saved)
        return Response.json(
          { error: "A profile may already exist for this session." },
          { status: 400 },
        );
      saved = JSON.parse(String(init.body)) as Profile;
      if (losePostResponse) throw new TypeError("Synthetic connection loss");
    }
    return Response.json(saved, {
      headers: { [STUDENT_SESSION_HEADER]: cookieIdentity },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("recovers a committed profile after an actual client API network rejection", async () => {
  losePostResponse = true;
  expect(await run()).toEqual({
    identity: firstId,
    profile: desired,
    recovered: true,
  });
  expect(posts).toBe(1);
  expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  expect(pending).toBeNull();
  expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
    "POST",
    "GET",
  ]);
});

it("uses the actual saved name when a later retry edits an already saved form", async () => {
  pending = { identity: firstId, initialProfile: desired };
  saved = { ...desired };
  const result = await run({ ...desired, name: "A different visible draft" });
  expect(result.profile.name).toBe(desired.name);
  expect(result.recovered).toBe(true);
  expect(posts).toBe(0);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});

it("retains the identity on profile service failure and sends one signup across two attempts", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json(
      { error: "Temporary profile service outage" },
      { status: 503 },
    ),
  );
  await expect(run()).rejects.toThrow("Temporary profile service outage");
  expect(pending?.identity).toBe(firstId);
  expect(await run()).toMatchObject({ identity: firstId, profile: desired });
  expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  expect(posts).toBe(1);
});

it("rejects a staff cookie switched after the last pre-write SDK check", async () => {
  const realFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === "POST") {
      cookieIdentity = secondId;
      anonymous = false;
    }
    return realFetch(url, init);
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(saved).toBeNull();
  expect(posts).toBe(1);
  expect(pending).toBeNull();
});

it("pins a changed anonymous cookie to the initiating student instead of writing another profile", async () => {
  const realFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === "POST") cookieIdentity = secondId;
    expect(new Headers(init?.headers).get(STUDENT_SESSION_HEADER)).toBe(
      firstId,
    );
    return realFetch(url, init);
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(saved).toBeNull();
  expect(pending).toBeNull();
});

it("does not issue a profile POST when an external session notice invalidates a delayed signup", async () => {
  const gate =
    deferred<Awaited<ReturnType<RegistrationAuth["signInAnonymously"]>>>();
  const entered = deferred<void>();
  auth.signInAnonymously.mockImplementation(() => {
    entered.resolve();
    return gate.promise;
  });
  const operation = run();
  await entered.promise;
  current = false;
  const newer = {
    identity: secondId,
    initialProfile: { ...desired, name: "New" },
  };
  pending = newer;
  gate.resolve({
    data: { user: { id: firstId, is_anonymous: true } },
    error: null,
  });
  await expect(operation).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(pending).toBe(newer);
  expect(onPending).not.toHaveBeenCalled();
});

it("does not clear a new pending registration after a delayed recovery response", async () => {
  pending = { identity: firstId, initialProfile: desired };
  const gate = deferred<Response>();
  const entered = deferred<void>();
  fetchMock.mockImplementation(() => {
    entered.resolve();
    return gate.promise;
  });
  const operation = run();
  await entered.promise;
  current = false;
  const newer = {
    identity: secondId,
    initialProfile: { ...desired, name: "New" },
  };
  pending = newer;
  gate.resolve(
    Response.json(desired, {
      headers: { [STUDENT_SESSION_HEADER]: firstId },
    }),
  );
  await expect(operation).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(pending).toBe(newer);
  expect(onPending).not.toHaveBeenCalled();
  expect(posts).toBe(0);
});

it("refuses a successful-looking profile response without the verified identity header", async () => {
  fetchMock.mockResolvedValueOnce(Response.json(desired));
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(pending).toBeNull();
});

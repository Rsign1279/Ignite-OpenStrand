import { beforeEach, expect, it, vi } from "vitest";
import {
  registerWithRecovery,
  type PendingRegistration,
  type RegistrationAuth,
} from "@/lib/registration-recovery";
import type { Profile } from "@/lib/validation";
import { SESSION_CHANGED_MESSAGE } from "@/lib/student-session";

const identity = "11111111-1111-4111-8111-111111111111";
const otherIdentity = "22222222-2222-4222-8222-222222222222";
const desired: Profile = {
  name: "Synthetic Student",
  strand: "aviation",
  ignite_year: 1,
};
let current: boolean;
let pending: PendingRegistration | null;
const auth = {
  signOut: vi.fn<RegistrationAuth["signOut"]>(),
  signInAnonymously: vi.fn<RegistrationAuth["signInAnonymously"]>(),
  getSession: vi.fn<RegistrationAuth["getSession"]>(),
};
const readProfile =
  vi.fn<Parameters<typeof registerWithRecovery>[0]["readProfile"]>();
const writeProfile =
  vi.fn<Parameters<typeof registerWithRecovery>[0]["writeProfile"]>();
const onPending = vi.fn((value: PendingRegistration | null) => {
  pending = value;
});
const run = (profile: Profile = desired) =>
  registerWithRecovery({
    auth,
    pending,
    desiredProfile: profile,
    isCurrent: () => current,
    onPending,
    readProfile,
    writeProfile,
  });
const ownSession = () => ({
  data: { session: { user: { id: identity, is_anonymous: true } } },
  error: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  current = true;
  pending = null;
  onPending.mockImplementation((value) => {
    pending = value;
  });
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInAnonymously.mockResolvedValue({
    data: { user: { id: identity, is_anonymous: true } },
    error: null,
  });
  auth.getSession.mockResolvedValue(ownSession());
  readProfile.mockResolvedValue({ profile: null, sessionIdentity: identity });
  writeProfile.mockResolvedValue({ sessionIdentity: identity });
});

it("ends a previous local session and binds the new anonymous identity before writing", async () => {
  writeProfile.mockImplementation(async (id, profile) => {
    expect(id).toBe(identity);
    expect(profile).toEqual(desired);
    expect(pending).toEqual({ identity, initialProfile: desired });
    return { sessionIdentity: identity };
  });
  expect(await run()).toEqual({ identity, profile: desired, recovered: false });
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(auth.signInAnonymously).toHaveBeenCalledOnce();
  expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
    auth.signInAnonymously.mock.invocationCallOrder[0],
  );
  expect(readProfile).not.toHaveBeenCalled();
  expect(pending).toBeNull();
});
it("keeps its pending identity after an ordinary failed write and unsuccessful recovery", async () => {
  writeProfile.mockRejectedValue(new Error("Profile temporarily unavailable"));
  await expect(run()).rejects.toThrow("Profile temporarily unavailable");
  expect(pending).toEqual({ identity, initialProfile: desired });
  expect(auth.signInAnonymously).toHaveBeenCalledOnce();
});
it("retries an unsaved profile without spending another anonymous signup", async () => {
  pending = { identity, initialProfile: desired };
  expect(await run()).toEqual({ identity, profile: desired, recovered: false });
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(readProfile).toHaveBeenCalledWith(identity);
  expect(writeProfile).toHaveBeenCalledOnce();
});
it("recovers a saved original profile rather than silently replacing its displayed name", async () => {
  pending = { identity, initialProfile: desired };
  readProfile.mockResolvedValue({
    profile: desired,
    sessionIdentity: identity,
  });
  expect(
    await run({ ...desired, name: "Edited after network failure" }),
  ).toEqual({ identity, profile: desired, recovered: true });
  expect(writeProfile).not.toHaveBeenCalled();
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(pending).toBeNull();
});
it("allows editing an unsaved form while keeping its own anonymous identity", async () => {
  pending = { identity, initialProfile: desired };
  const edited = { ...desired, name: "Edited draft" };
  expect(await run(edited)).toEqual({
    identity,
    profile: edited,
    recovered: false,
  });
  expect(writeProfile).toHaveBeenCalledWith(identity, edited);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});
it("recovers a profile saved before a lost POST response without a second write", async () => {
  writeProfile.mockRejectedValue(new Error("Connection interrupted"));
  readProfile.mockResolvedValue({
    profile: desired,
    sessionIdentity: identity,
  });
  expect(await run()).toEqual({ identity, profile: desired, recovered: true });
  expect(writeProfile).toHaveBeenCalledOnce();
  expect(pending).toBeNull();
});
it("retains the initiating error and identity when the recovery read also fails", async () => {
  writeProfile.mockRejectedValue(new Error("Original write outage"));
  readProfile.mockRejectedValue(new Error("Read outage"));
  await expect(run()).rejects.toThrow("Original write outage");
  expect(pending?.identity).toBe(identity);
});
it.each([false, undefined])(
  "never reuses a permanent or unverified identity (anonymous=%s)",
  async (is_anonymous) => {
    pending = { identity, initialProfile: desired };
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: identity, is_anonymous } } },
      error: null,
    });
    await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
    expect(writeProfile).not.toHaveBeenCalled();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(pending).toBeNull();
  },
);
it("does not adopt a different student's identity on retry", async () => {
  pending = { identity, initialProfile: desired };
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: otherIdentity, is_anonymous: true } } },
    error: null,
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(readProfile).not.toHaveBeenCalled();
  expect(writeProfile).not.toHaveBeenCalled();
  expect(pending).toBeNull();
});
it.each([null, otherIdentity])(
  "requires the retry GET response's exact session pin (%s)",
  async (pin) => {
    pending = { identity, initialProfile: desired };
    readProfile.mockResolvedValue({ profile: desired, sessionIdentity: pin });
    await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
    expect(writeProfile).not.toHaveBeenCalled();
    expect(pending).toBeNull();
  },
);
it.each([null, otherIdentity])(
  "requires the POST response's exact session pin (%s)",
  async (pin) => {
    writeProfile.mockResolvedValue({ sessionIdentity: pin });
    await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
    expect(readProfile).not.toHaveBeenCalled();
    expect(pending).toBeNull();
  },
);
it("rejects a different profile even if its response uses the expected identity pin", async () => {
  pending = { identity, initialProfile: desired };
  readProfile.mockResolvedValue({
    profile: { ...desired, name: "Another student" },
    sessionIdentity: identity,
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(writeProfile).not.toHaveBeenCalled();
  expect(pending).toBeNull();
});
it("does not begin auth work for a stale registration", async () => {
  current = false;
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(onPending).not.toHaveBeenCalled();
});
it("checks the epoch after signout before creating an anonymous account", async () => {
  auth.signOut.mockImplementation(async () => {
    current = false;
    return { error: null };
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(onPending).not.toHaveBeenCalled();
});
it("cannot publish or write a late anonymous signup into a newer registration", async () => {
  auth.signInAnonymously.mockImplementation(async () => {
    current = false;
    return {
      data: { user: { id: identity, is_anonymous: true } },
      error: null,
    };
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(writeProfile).not.toHaveBeenCalled();
  expect(onPending).not.toHaveBeenCalled();
});
it("does not clear a newer pending registration after a stale GET completes", async () => {
  pending = { identity, initialProfile: desired };
  const newer = {
    identity: otherIdentity,
    initialProfile: { ...desired, name: "New tab" },
  };
  readProfile.mockImplementation(async () => {
    pending = newer;
    current = false;
    return { profile: desired, sessionIdentity: identity };
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(pending).toBe(newer);
  expect(onPending).not.toHaveBeenCalled();
  expect(writeProfile).not.toHaveBeenCalled();
});
it("checks identity again after a profile write", async () => {
  writeProfile.mockImplementation(async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: otherIdentity, is_anonymous: true } } },
      error: null,
    });
    return { sessionIdentity: identity };
  });
  await expect(run()).rejects.toThrow(SESSION_CHANGED_MESSAGE);
  expect(pending).toBeNull();
});
it("never creates a new account when local signout fails", async () => {
  auth.signOut.mockResolvedValue({ error: new Error("PRIVATE auth detail") });
  await expect(run()).rejects.toThrow("previous session could not be ended");
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(writeProfile).not.toHaveBeenCalled();
});
it("snapshots the desired profile before awaiting auth", async () => {
  const mutable = { ...desired };
  auth.signInAnonymously.mockImplementation(async () => {
    mutable.name = "Changed during await";
    return {
      data: { user: { id: identity, is_anonymous: true } },
      error: null,
    };
  });
  expect((await run(mutable)).profile).toEqual(desired);
  expect(writeProfile).toHaveBeenCalledWith(identity, desired);
});

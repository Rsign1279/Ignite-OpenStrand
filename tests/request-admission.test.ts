import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  clock: 0,
  strings: new Map<string, { value: unknown; expires: number }>(),
  uploads: new Map<string, Map<string, number>>(),
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  zrem: vi.fn(),
  rate: vi.fn(),
  fromEnv: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: mock.fromEnv } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mock.rate }));
import {
  limitLogicalSubmission,
  withAssessmentLock,
  withUploadAdmission,
} from "@/lib/request-admission";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function current(key: string) {
  const record = mock.strings.get(key);
  if (record && record.expires <= mock.clock) {
    mock.strings.delete(key);
    return undefined;
  }
  return record;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.clock = 0;
  mock.strings.clear();
  mock.uploads.clear();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://local-redis.invalid");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "controlled-test-token");
  mock.fromEnv.mockReturnValue({
    get: mock.get,
    set: mock.set,
    eval: mock.eval,
    zrem: mock.zrem,
  });
  mock.get.mockImplementation(
    async (key: string) => current(key)?.value ?? null,
  );
  mock.set.mockImplementation(
    async (
      key: string,
      value: unknown,
      options: { nx?: boolean; ex: number },
    ) => {
      if (options.nx && current(key)) return null;
      mock.strings.set(key, { value, expires: mock.clock + options.ex * 1000 });
      return "OK";
    },
  );
  // Controlled command responses test the wrapper's use of leases. The actual
  // Lua scripts are separately exercised against isolated real Redis.
  mock.eval.mockImplementation(
    async (script: string, keys: string[], args: (string | number)[]) => {
      const key = keys[0];
      if (script.includes("ZREMRANGEBYSCORE")) {
        const [maximum, leaseMs, owner] = args;
        const active = mock.uploads.get(key) ?? new Map<string, number>();
        for (const [id, expires] of active)
          if (expires <= mock.clock) active.delete(id);
        mock.uploads.set(key, active);
        if (active.size >= Number(maximum)) return 0;
        active.set(String(owner), mock.clock + Number(leaseMs));
        return 1;
      }
      if (current(key)?.value !== args[0]) return 0;
      mock.strings.delete(key);
      return 1;
    },
  );
  mock.zrem.mockImplementation(async (key: string, owner: string) =>
    Number(mock.uploads.get(key)?.delete(owner) ?? false),
  );
  mock.rate.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it("rejects duplicate in-flight assessment work before invoking its operation", async () => {
  const held = deferred<string>();
  const first = withAssessmentLock(
    "student-a",
    "request-1",
    () => held.promise,
  );
  const duplicate = vi.fn(async () => "duplicate provider work");
  await expect(
    withAssessmentLock("student-a", "request-1", duplicate),
  ).rejects.toMatchObject({
    status: 429,
    code: "AI_CAPACITY_BUSY",
    retryAfterSeconds: 2,
  });
  expect(duplicate).not.toHaveBeenCalled();
  held.resolve("original result");
  await expect(first).resolves.toBe("original result");
  expect(mock.strings.size).toBe(0);
});

it("isolates students and different requests without sharing lease ownership", async () => {
  const held = deferred<string>();
  const first = withAssessmentLock("student-a", "same-id", () => held.promise);
  await expect(
    withAssessmentLock("student-b", "same-id", async () => "B"),
  ).resolves.toBe("B");
  await expect(
    withAssessmentLock("student-a", "another-id", async () => "A2"),
  ).resolves.toBe("A2");
  expect(mock.strings.size).toBe(1);
  held.resolve("A1");
  await expect(first).resolves.toBe("A1");
});

it("does not let an expired owner release the replacement owner's lock", async () => {
  const oldOperation = deferred<string>(),
    newOperation = deferred<string>();
  const old = withAssessmentLock(
    "student",
    "request",
    () => oldOperation.promise,
  );
  mock.clock = 120001;
  const newer = withAssessmentLock(
    "student",
    "request",
    () => newOperation.promise,
  );
  oldOperation.resolve("old completed");
  await old;
  const thirdOperation = vi.fn(async () => "should not run");
  await expect(
    withAssessmentLock("student", "request", thirdOperation),
  ).rejects.toMatchObject({ status: 429 });
  expect(thirdOperation).not.toHaveBeenCalled();
  newOperation.resolve("new completed");
  await newer;
  await expect(
    withAssessmentLock("student", "request", async () => "after release"),
  ).resolves.toBe("after release");
});

it("releases a held assessment lock without masking the operation's error", async () => {
  const failure = new Error("controlled provider failure");
  await expect(
    withAssessmentLock("student", "request", async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(mock.strings.size).toBe(0);
  expect(mock.eval).toHaveBeenCalledOnce();
});

it("keeps successful work usable if lease cleanup fails, then recovers after expiry", async () => {
  mock.eval.mockRejectedValueOnce(new Error("cleanup unavailable"));
  await expect(
    withAssessmentLock("student", "request", async () => "saved result"),
  ).resolves.toBe("saved result");
  await expect(
    withAssessmentLock("student", "request", async () => "too soon"),
  ).rejects.toMatchObject({ status: 429 });
  mock.clock = 120001;
  await expect(
    withAssessmentLock("student", "request", async () => "recovered"),
  ).resolves.toBe("recovered");
});

it("fails closed before provider work when lock storage is unavailable or unconfigured", async () => {
  const operation = vi.fn(async () => "never");
  mock.set.mockRejectedValueOnce(new Error("private storage detail"));
  await expect(
    withAssessmentLock("student", "request", operation),
  ).rejects.toMatchObject({ status: 503 });
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  await expect(
    withAssessmentLock("student", "request", operation),
  ).rejects.toMatchObject({ status: 503 });
  expect(operation).not.toHaveBeenCalled();
});

it("charges a repeated logical submission once while binding its fingerprint", async () => {
  await limitLogicalSubmission(
    "student",
    "assessment",
    "request",
    "same-fingerprint",
  );
  await limitLogicalSubmission(
    "student",
    "assessment",
    "request",
    "same-fingerprint",
  );
  expect(mock.rate).toHaveBeenCalledExactlyOnceWith("student", "assessment");
  await expect(
    limitLogicalSubmission(
      "student",
      "assessment",
      "request",
      "changed-fingerprint",
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(mock.rate).toHaveBeenCalledTimes(1);
});

it("does not reuse another student's or lane's logical quota marker", async () => {
  await limitLogicalSubmission("student-a", "assessment", "same-id", "first");
  await limitLogicalSubmission("student-b", "assessment", "same-id", "second");
  await limitLogicalSubmission("student-a", "transcribe", "same-id", "third");
  expect(mock.rate).toHaveBeenCalledTimes(3);
  expect(mock.strings.size).toBe(3);
});

it("does not mark a rejected student quota as charged", async () => {
  const rejected = Object.assign(new Error("quota exhausted"), { status: 429 });
  mock.rate.mockRejectedValueOnce(rejected);
  await expect(
    limitLogicalSubmission("student", "assessment", "request", "fingerprint"),
  ).rejects.toBe(rejected);
  expect(mock.strings.size).toBe(0);
  await limitLogicalSubmission(
    "student",
    "assessment",
    "request",
    "fingerprint",
  );
  expect(mock.rate).toHaveBeenCalledTimes(2);
});

it.each(["read", "write"])(
  "fails closed when logical quota marker %s fails",
  async (stage) => {
    if (stage === "read")
      mock.get.mockRejectedValueOnce(new Error("private storage detail"));
    else mock.set.mockRejectedValueOnce(new Error("private storage detail"));
    await expect(
      limitLogicalSubmission("student", "assessment", "request", "fingerprint"),
    ).rejects.toMatchObject({ status: 503 });
    expect(mock.rate).toHaveBeenCalledTimes(stage === "read" ? 0 : 1);
  },
);

it("bounds concurrent upload operations before any rejected body can be read", async () => {
  const held = deferred<string>();
  const readBody = vi.fn(() => held.promise);
  const attempts = Array.from({ length: 32 }, () =>
    withUploadAdmission(readBody).then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    ),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(readBody).toHaveBeenCalledTimes(8);
  held.resolve("parsed safely");
  const results = await Promise.all(attempts);
  expect(results.filter((r) => r.ok)).toHaveLength(8);
  expect(results.filter((r) => !r.ok)).toHaveLength(24);
  for (const result of results)
    if ("error" in result)
      expect(result.error).toMatchObject({
        status: 429,
        code: "AI_CAPACITY_BUSY",
      });
  expect(mock.uploads.get("ignite:uploads:active")?.size).toBe(0);
  expect(mock.zrem).toHaveBeenCalledTimes(8);
});

it("releases upload ownership on parse/provider failure and tolerates cleanup failure", async () => {
  const failure = new Error("body parsing failed");
  await expect(
    withUploadAdmission(async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(mock.uploads.get("ignite:uploads:active")?.size).toBe(0);
  mock.zrem.mockRejectedValueOnce(new Error("cleanup unavailable"));
  await expect(withUploadAdmission(async () => "completed")).resolves.toBe(
    "completed",
  );
});

it("never enters an upload operation when shared admission storage fails", async () => {
  const operation = vi.fn(async () => "never");
  mock.eval.mockRejectedValueOnce(new Error("private storage detail"));
  await expect(withUploadAdmission(operation)).rejects.toMatchObject({
    status: 503,
  });
  expect(operation).not.toHaveBeenCalled();
});

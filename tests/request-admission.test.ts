import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  clock: 0,
  strings: new Map<string, { value: unknown; expires: number }>(),
  uploads: new Map<string, Map<string, number>>(),
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
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
        const [maximum, leaseMs, owner, studentMaximum] = args;
        const active = keys.map(
          (uploadKey) =>
            mock.uploads.get(uploadKey) ?? new Map<string, number>(),
        );
        for (const leases of active)
          for (const [id, expires] of leases)
            if (expires <= mock.clock) leases.delete(id);
        if (
          active[0].size >= Number(maximum) ||
          (active[1] && active[1].size >= Number(studentMaximum))
        )
          return 0;
        for (const [index, leases] of active.entries()) {
          leases.set(String(owner), mock.clock + Number(leaseMs));
          mock.uploads.set(keys[index], leases);
        }
        return 1;
      }
      if (script.includes("'ZREM'"))
        return keys.reduce(
          (removed, uploadKey) =>
            removed +
            Number(
              mock.uploads.get(uploadKey)?.delete(String(args[0])) ?? false,
            ),
          0,
        );
      if (current(key)?.value !== args[0]) return 0;
      mock.strings.delete(key);
      return 1;
    },
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
  expect(
    mock.eval.mock.calls.filter(([script]) => script.includes("'ZREM'")),
  ).toHaveLength(8);
});

it("releases upload ownership on parse/provider failure and tolerates cleanup failure", async () => {
  const failure = new Error("body parsing failed");
  await expect(
    withUploadAdmission(async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(mock.uploads.get("ignite:uploads:active")?.size).toBe(0);
  await expect(
    withUploadAdmission(async () => {
      mock.eval.mockRejectedValueOnce(new Error("cleanup unavailable"));
      return "completed";
    }),
  ).resolves.toBe("completed");
});

it("never enters an upload operation when shared admission storage fails", async () => {
  const operation = vi.fn(async () => "never");
  mock.eval.mockRejectedValueOnce(new Error("private storage detail"));
  await expect(withUploadAdmission(operation)).rejects.toMatchObject({
    status: 503,
  });
  expect(operation).not.toHaveBeenCalled();
});

const studentA = "abcdef12-1111-4111-8111-111111111111";
const studentB = "22222222-2222-4222-8222-222222222222";
const globalUploads = "ignite:uploads:active";
const studentUploads = (id: string) =>
  `ignite:uploads:{ignite:uploads:active}:student:${createHash("sha256").update(id.toLowerCase()).digest("hex")}`;

it("limits a trusted student to two uploads without reserving a rejected global slot", async () => {
  const held = deferred<string>();
  const readBody = vi.fn(() => held.promise);
  const first = withUploadAdmission(readBody, studentA);
  const second = withUploadAdmission(readBody, studentA);
  const rejectedBody = vi.fn(async () => "should not read");
  await expect(
    withUploadAdmission(rejectedBody, studentA),
  ).rejects.toMatchObject({ status: 429, code: "AI_CAPACITY_BUSY" });
  expect(readBody).toHaveBeenCalledTimes(2);
  expect(rejectedBody).not.toHaveBeenCalled();
  expect(mock.uploads.get(globalUploads)?.size).toBe(2);
  expect(mock.uploads.get(studentUploads(studentA))?.size).toBe(2);
  await expect(
    withUploadAdmission(async () => "another student can upload", studentB),
  ).resolves.toBe("another student can upload");
  expect(mock.uploads.get(globalUploads)?.size).toBe(2);
  expect(mock.rate).not.toHaveBeenCalled();
  held.resolve("read");
  await Promise.all([first, second]);
  expect(mock.uploads.get(globalUploads)?.size).toBe(0);
  expect(mock.uploads.get(studentUploads(studentA))?.size).toBe(0);
});

it("retains the global eight-upload bound across isolated student shares", async () => {
  const held = deferred<string>();
  const readBody = vi.fn(() => held.promise);
  const students = Array.from(
    { length: 5 },
    (_, index) =>
      `12345678-1234-4123-8123-${String(index + 1).padStart(12, "0")}`,
  );
  const attempts = students.flatMap((id) =>
    Array.from({ length: 2 }, () =>
      withUploadAdmission(readBody, id).then(
        () => true,
        () => false,
      ),
    ),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(readBody).toHaveBeenCalledTimes(8);
  expect(mock.uploads.get(globalUploads)?.size).toBe(8);
  for (const id of students.slice(0, 4))
    expect(mock.uploads.get(studentUploads(id))?.size).toBe(2);
  // A denied global admission must not leave a student-only lease behind.
  expect(mock.uploads.has(studentUploads(students[4]))).toBe(false);
  held.resolve("read");
  const results = await Promise.all(attempts);
  expect(results.filter(Boolean)).toHaveLength(8);
  expect(results.filter((result) => !result)).toHaveLength(2);
  for (const leases of mock.uploads.values()) expect(leases.size).toBe(0);
});

it("canonicalizes valid UUIDs into the same hashed share and rejects invalid IDs before storage", async () => {
  const held = deferred<string>();
  const first = withUploadAdmission(() => held.promise, studentA);
  const second = withUploadAdmission(
    () => held.promise,
    studentA.toUpperCase(),
  );
  await expect(
    withUploadAdmission(async () => "blocked", studentA),
  ).rejects.toMatchObject({ status: 429 });
  const acquisition = mock.eval.mock.calls[0];
  expect(acquisition[1]).toEqual([globalUploads, studentUploads(studentA)]);
  expect(acquisition[1].join(" ")).not.toContain(studentA);
  expect(acquisition[1].join(" ")).not.toContain(studentA.toUpperCase());
  expect(mock.uploads.size).toBe(2);
  const evalCount = mock.eval.mock.calls.length;
  const invalidBody = vi.fn(async () => "never");
  for (const id of ["", "student-a", ` ${studentA}`, `${studentA}:other`])
    await expect(withUploadAdmission(invalidBody, id)).rejects.toMatchObject({
      name: "ZodError",
    });
  expect(mock.eval).toHaveBeenCalledTimes(evalCount);
  expect(invalidBody).not.toHaveBeenCalled();
  held.resolve("done");
  await Promise.all([first, second]);
});

it("expires both upload shares and prevents an old owner from removing newer leases", async () => {
  const oldHeld = deferred<string>();
  const newHeld = deferred<string>();
  const old = withUploadAdmission(() => oldHeld.promise, studentA);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const oldOwner = [...mock.uploads.get(globalUploads)!.keys()][0];
  mock.clock = 100001;
  const newer = withUploadAdmission(() => newHeld.promise, studentA);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const newOwner = [...mock.uploads.get(globalUploads)!.keys()][0];
  expect(newOwner).not.toBe(oldOwner);
  for (const key of [globalUploads, studentUploads(studentA)]) {
    expect([...mock.uploads.get(key)!.keys()]).toEqual([newOwner]);
  }
  oldHeld.resolve("old operation completed late");
  await old;
  for (const key of [globalUploads, studentUploads(studentA)])
    expect([...mock.uploads.get(key)!.keys()]).toEqual([newOwner]);
  newHeld.resolve("new operation completed");
  await newer;
  for (const key of [globalUploads, studentUploads(studentA)])
    expect(mock.uploads.get(key)?.size).toBe(0);
});

it("releases both owned upload members on failure without deleting another student's work", async () => {
  const held = deferred<string>();
  const other = withUploadAdmission(() => held.promise, studentB);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const otherOwner = [...mock.uploads.get(globalUploads)!.keys()][0];
  const failure = new Error("multipart parse failed");
  await expect(
    withUploadAdmission(async () => {
      throw failure;
    }, studentA),
  ).rejects.toBe(failure);
  expect(mock.uploads.get(studentUploads(studentA))?.size).toBe(0);
  expect([...mock.uploads.get(globalUploads)!.keys()]).toEqual([otherOwner]);
  expect([...mock.uploads.get(studentUploads(studentB))!.keys()]).toEqual([
    otherOwner,
  ]);
  const cleanup = mock.eval.mock.calls.find(
    ([script, keys]) =>
      script.includes("'ZREM'") && keys.includes(studentUploads(studentA)),
  );
  expect(cleanup?.[1]).toEqual([globalUploads, studentUploads(studentA)]);
  held.resolve("other student completed");
  await other;
});

it("fails closed before reading a student's body if atomic admission storage fails", async () => {
  const readBody = vi.fn(async () => "never");
  mock.eval.mockRejectedValueOnce(new Error("admission storage failed"));
  await expect(withUploadAdmission(readBody, studentA)).rejects.toMatchObject({
    status: 503,
  });
  expect(readBody).not.toHaveBeenCalled();
  expect(mock.uploads.size).toBe(0);
  expect(mock.rate).not.toHaveBeenCalled();
});

it("keeps failed cleanup bounded and restores both shares after lease expiry", async () => {
  for (let index = 0; index < 2; index++)
    await expect(
      withUploadAdmission(async () => {
        mock.eval.mockRejectedValueOnce(new Error("release storage failed"));
        return "body was read";
      }, studentA),
    ).resolves.toBe("body was read");
  expect(mock.uploads.get(globalUploads)?.size).toBe(2);
  expect(mock.uploads.get(studentUploads(studentA))?.size).toBe(2);
  const blocked = vi.fn(async () => "never");
  await expect(withUploadAdmission(blocked, studentA)).rejects.toMatchObject({
    status: 429,
  });
  expect(blocked).not.toHaveBeenCalled();
  mock.clock = 100001;
  await expect(
    withUploadAdmission(async () => "recovered", studentA),
  ).resolves.toBe("recovered");
  expect(mock.uploads.get(globalUploads)?.size).toBe(0);
  expect(mock.uploads.get(studentUploads(studentA))?.size).toBe(0);
});

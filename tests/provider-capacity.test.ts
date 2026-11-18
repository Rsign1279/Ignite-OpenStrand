import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  zrem: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  fromEnv: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: mocks.fromEnv } }));
import {
  withProviderCapacity,
  providerRateLimit,
  providerRetryAfter,
  providerObservation,
  getProviderCapacitySnapshot,
  providerBudget,
  resetSeconds,
  recordProviderObservation,
  PROVIDER_ADMISSION_SCRIPT,
  PROVIDER_INSPECTION_SCRIPT,
  PROVIDER_COOLDOWN_SCRIPT,
} from "@/lib/ai/capacity";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.UPSTASH_REDIS_REST_URL = "test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  for (const name of [
    "IGNITE_AI_TEXT_CONCURRENCY",
    "IGNITE_AI_TEXT_RPM",
    "IGNITE_AI_AUDIO_CONCURRENCY",
    "IGNITE_AI_AUDIO_RPM",
    "IGNITE_AI_TEXT_USER_CALLS_10M",
    "IGNITE_AI_AUDIO_USER_CALLS_10M",
  ])
    delete process.env[name];
  mocks.fromEnv.mockReturnValue({
    eval: mocks.eval,
    zrem: mocks.zrem,
    set: mocks.set,
    get: mocks.get,
  });
  mocks.eval.mockResolvedValue([1, 0, 0]);
  mocks.zrem.mockResolvedValue(1);
  mocks.set.mockResolvedValue("OK");
  mocks.get.mockResolvedValue(null);
});
it("reserves before calling provider, then releases the exact lease", async () => {
  const work = vi.fn(async () => "evaluation");
  expect(await withProviderCapacity("text", "a-model", work)).toBe(
    "evaluation",
  );
  expect(mocks.eval).toHaveBeenCalledOnce();
  const [script, keys, args] = mocks.eval.mock.calls[0];
  expect(script).toBe(PROVIDER_ADMISSION_SCRIPT);
  expect(keys).toHaveLength(3);
  expect(
    new Set(keys.map((key: string) => key.match(/\{[^}]+\}/)?.[0])).size,
  ).toBe(1);
  expect(args.slice(1)).toEqual([4, 20, 45000]);
  expect(mocks.eval.mock.invocationCallOrder[0]).toBeLessThan(
    work.mock.invocationCallOrder[0],
  );
  expect(mocks.zrem).toHaveBeenCalledWith(keys[0], args[0]);
});
it("releases on provider failure without losing the original failure", async () => {
  const error = new Error("provider failed");
  await expect(
    withProviderCapacity("audio", "whisper", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(mocks.zrem).toHaveBeenCalledOnce();
  expect(mocks.eval.mock.calls[0][2].slice(1)).toEqual([2, 12, 75000]);
});
it("uses disjoint lane/model keys and unique request lease IDs", async () => {
  await withProviderCapacity("text", "model-a", async () => true);
  await withProviderCapacity("audio", "model-a", async () => true);
  await withProviderCapacity("text", "model-b", async () => true);
  expect(new Set(mocks.eval.mock.calls.map((call) => call[1][0])).size).toBe(3);
  expect(new Set(mocks.eval.mock.calls.map((call) => call[2][0])).size).toBe(3);
});
it("atomically supplies a hashed trusted identity with the lane's student budget", async () => {
  const userId = "fb075f6b-9225-4d54-b4dc-5ebc2baf9588";
  await withProviderCapacity("audio", "whisper", async () => true, userId);
  const [, keys, args] = mocks.eval.mock.calls[0];
  expect(keys).toHaveLength(4);
  expect(keys[3]).toMatch(/:requests:student:[0-9a-f]{64}$/);
  expect(keys[3]).not.toContain(userId);
  expect(
    new Set(keys.map((key: string) => key.match(/\{[^}]+\}/)?.[0])).size,
  ).toBe(1);
  expect(args.slice(1)).toEqual([2, 12, 75000, 30]);
  expect(mocks.zrem).toHaveBeenCalledWith(keys[0], args[0]);
});
it("canonicalizes the UUID and isolates student budgets between people and lanes", async () => {
  const userId = "fb075f6b-9225-4d54-b4dc-5ebc2baf9588";
  await withProviderCapacity("text", "model", async () => true, userId);
  await withProviderCapacity(
    "text",
    "model",
    async () => true,
    userId.toUpperCase(),
  );
  await withProviderCapacity("audio", "model", async () => true, userId);
  await withProviderCapacity(
    "text",
    "model",
    async () => true,
    "fb075f6b-9225-4d54-b4dc-5ebc2baf9589",
  );
  const studentKeys = mocks.eval.mock.calls.map((call) => call[1][3]);
  expect(studentKeys[0]).toBe(studentKeys[1]);
  expect(new Set(studentKeys).size).toBe(3);
});
it("returns a non-retrying student allowance denial without executing or releasing work", async () => {
  mocks.eval.mockResolvedValue([0, 576, 3]);
  const work = vi.fn();
  const error = await withProviderCapacity(
    "audio",
    "whisper",
    work,
    "fb075f6b-9225-4d54-b4dc-5ebc2baf9588",
  ).catch((error: unknown) => error);
  expect(error).toMatchObject({ status: 429, retryAfterSeconds: 576 });
  expect(error).not.toHaveProperty("code");
  expect(work).not.toHaveBeenCalled();
  expect(mocks.zrem).not.toHaveBeenCalled();
});
it.each([
  "",
  "student-id",
  "fb075f6b-9225-4d54-b4dc-5ebc2baf9588\n",
  "x".repeat(10000),
])(
  "fails closed when the supplied trusted identity is malformed",
  async (userId) => {
    const work = vi.fn();
    await expect(
      withProviderCapacity("audio", "whisper", work, userId),
    ).rejects.toMatchObject({ status: 503 });
    expect(work).not.toHaveBeenCalled();
    expect(mocks.eval).not.toHaveBeenCalled();
  },
);
it("rejects an impossible student denial instead of accepting malformed quota timing", async () => {
  mocks.eval.mockResolvedValue([0, 601, 3]);
  await expect(
    withProviderCapacity(
      "audio",
      "whisper",
      vi.fn(),
      "fb075f6b-9225-4d54-b4dc-5ebc2baf9588",
    ),
  ).rejects.toMatchObject({ status: 503 });
  mocks.eval.mockResolvedValue([0, 10, 3]);
  await expect(
    withProviderCapacity("audio", "whisper", vi.fn()),
  ).rejects.toMatchObject({ status: 503 });
});
it("uses independent bounded student budgets without changing global defaults", async () => {
  process.env.IGNITE_AI_TEXT_USER_CALLS_10M = "11";
  process.env.IGNITE_AI_AUDIO_USER_CALLS_10M = "7";
  expect(providerBudget("text")).toMatchObject({
    concurrent: 4,
    requestsPerMinute: 20,
    userRequestsPerTenMinutes: 11,
  });
  expect(providerBudget("audio")).toMatchObject({
    concurrent: 2,
    requestsPerMinute: 12,
    userRequestsPerTenMinutes: 7,
  });
  process.env.IGNITE_AI_AUDIO_USER_CALLS_10M = "301";
  expect(() => providerBudget("audio")).toThrow();
});
it.each([
  [0, 4, 0],
  [0, 48, 1],
])(
  "busy admission returns bounded retry metadata without provider work (%s)",
  async (code, wait, reason) => {
    mocks.eval.mockResolvedValue([code, wait, reason]);
    const work = vi.fn();
    await expect(
      withProviderCapacity("text", "model", work),
    ).rejects.toMatchObject({
      status: 429,
      code: "AI_CAPACITY_BUSY",
      retryAfterSeconds: wait,
    });
    expect(work).not.toHaveBeenCalled();
    expect(mocks.zrem).not.toHaveBeenCalled();
  },
);
it("observed provider cooldown blocks a new call without mislabeling it as a short queue wait", async () => {
  mocks.eval.mockResolvedValue([0, 36000, 2]);
  const work = vi.fn();
  await expect(
    withProviderCapacity("text", "model", work),
  ).rejects.toMatchObject({
    status: 429,
    code: "AI_PROVIDER_RATE_LIMIT",
    retryAfterSeconds: 36000,
  });
  expect(work).not.toHaveBeenCalled();
});
it.each([null, [true, 0, 0], [1, 0], [1, -1, 0], [1, 0.2, 0], [0, 5, 99]])(
  "fails closed on malformed admission response %j",
  async (value) => {
    mocks.eval.mockResolvedValue(value);
    const work = vi.fn();
    await expect(
      withProviderCapacity("text", "model", work),
    ).rejects.toMatchObject({ status: 503 });
    expect(work).not.toHaveBeenCalled();
  },
);
it("fails closed for store errors or missing credentials", async () => {
  mocks.eval.mockRejectedValue(new Error("PRIVATE redis details"));
  const work = vi.fn();
  await expect(
    withProviderCapacity("text", "model", work),
  ).rejects.toMatchObject({
    status: 503,
    message: expect.not.stringContaining("PRIVATE"),
  });
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await expect(
    withProviderCapacity("text", "model", work),
  ).rejects.toMatchObject({ status: 503 });
  expect(work).not.toHaveBeenCalled();
});
it("a release failure cannot replace a completed answer; every lease is bounded", async () => {
  mocks.zrem.mockRejectedValue(new Error("offline"));
  expect(
    await withProviderCapacity("text", "model", async () => "saved answer"),
  ).toBe("saved answer");
  expect(mocks.eval.mock.calls[0][2][3]).toBe(45000);
});
it.each(["0", "-1", "Infinity", "2.5", "1000000", "invalid"])(
  "rejects unsafe configured budgets %s",
  (raw) => {
    process.env.IGNITE_AI_TEXT_CONCURRENCY = raw;
    expect(() => providerBudget("text")).toThrow();
  },
);
it.each([
  ["7.66s", 7.66],
  ["2m59.56s", 179.56],
  ["1h2m3s", 3723],
  ["500ms", 0.5],
  ["1d", 86400],
  ["0", 0],
  ["NaN", undefined],
  ["Infinity", undefined],
  ["10 secrets", undefined],
])("parses documented reset interval %s", (value, expected) => {
  expect(resetSeconds(value as string)).toBe(expected);
});
it("honors exact Retry-After seconds and HTTP dates with sensible bounds", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  expect(providerRetryAfter({ "Retry-After": "120" }, now)).toBe(120);
  expect(
    providerRetryAfter(
      new Headers({ "Retry-After": "Tue, 17 Nov 2026 12:02:00 GMT" }),
      now,
    ),
  ).toBe(120);
  expect(providerRetryAfter({ "retry-after": "9999999" }, now)).toBe(86400);
  expect(providerRetryAfter({ "retry-after": "0" }, now)).toBe(1);
  expect(providerRetryAfter({ "retry-after": "PRIVATE INVALID" }, now)).toBe(
    60,
  );
});
it("does not confuse a daily reset with the exhausted per-minute token budget", () => {
  expect(
    providerRetryAfter({
      "x-ratelimit-remaining-requests": "999",
      "x-ratelimit-remaining-tokens": "0",
      "x-ratelimit-reset-requests": "20h",
      "x-ratelimit-reset-tokens": "7.66s",
    }),
  ).toBe(8);
  expect(
    providerRetryAfter({
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-remaining-tokens": "0",
      "x-ratelimit-reset-requests": "20h",
      "x-ratelimit-reset-tokens": "7.66s",
    }),
  ).toBe(72000);
});
it("stores only allowlisted numeric metadata and labels daily versus minute limits correctly", async () => {
  const headers = new Headers({
    "x-ratelimit-limit-requests": "1000",
    "x-ratelimit-remaining-requests": "998",
    "x-ratelimit-limit-tokens": "8000",
    "x-ratelimit-remaining-tokens": "7000",
    "x-ratelimit-reset-tokens": "7.66s",
    authorization: "PRIVATE SECRET",
    "x-request-transcript": "PRIVATE ANSWER",
  });
  const observation = await recordProviderObservation(
    "text",
    "model",
    200,
    headers,
    123.45,
  );
  expect(observation).toMatchObject({
    status: 200,
    latencyMs: 123,
    requestsPerDayLimit: 1000,
    requestsPerDayRemaining: 998,
    tokensPerMinuteLimit: 8000,
    tokensPerMinuteRemaining: 7000,
    tokensResetSeconds: 7.66,
  });
  expect(JSON.stringify(mocks.set.mock.calls)).not.toContain("PRIVATE");
  expect(mocks.set.mock.calls[0][2]).toEqual({ ex: 86400 });
  expect(
    providerObservation(200, { "x-ratelimit-limit-tokens": "Infinity" }, NaN),
  ).not.toHaveProperty("tokensPerMinuteLimit");
});
it("sets a shared cooldown without shortening a longer existing provider wait", async () => {
  mocks.eval.mockResolvedValue(200);
  const error = await providerRateLimit(
    "audio",
    "whisper",
    new Headers({ "retry-after": "120" }),
  );
  expect(error).toMatchObject({
    status: 429,
    code: "AI_PROVIDER_RATE_LIMIT",
    retryAfterSeconds: 200,
  });
  expect(mocks.eval.mock.calls[0][0]).toBe(PROVIDER_COOLDOWN_SCRIPT);
  expect(mocks.eval.mock.calls[0][2]).toEqual([120]);
});
it("returns unknown telemetry honestly instead of inventing account capacity", async () => {
  mocks.eval.mockResolvedValue([0, 0, 0]);
  const snapshot = await getProviderCapacitySnapshot();
  expect(snapshot.available).toBe(true);
  expect(snapshot.lanes).toHaveLength(2);
  expect(snapshot.lanes.every((lane) => lane.latest === null)).toBe(true);
  expect(
    mocks.eval.mock.calls.every(
      (call) => call[0] === PROVIDER_INSPECTION_SCRIPT,
    ),
  ).toBe(true);
});
it("strips untrusted snapshot fields and reports an unreadable store as unavailable", async () => {
  mocks.eval.mockResolvedValue([0, 0, 0]);
  mocks.get.mockResolvedValue({
    observedAt: "2026-11-17T12:00:00Z",
    status: 200,
    latencyMs: 100,
    requestsPerDayLimit: 1000,
    secret: "PRIVATE",
  });
  const snapshot = await getProviderCapacitySnapshot();
  expect(snapshot.lanes[0].latest).toMatchObject({ requestsPerDayLimit: 1000 });
  expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
  mocks.eval.mockRejectedValue(new Error("offline"));
  expect(await getProviderCapacitySnapshot()).toMatchObject({
    available: false,
    lanes: [],
  });
});

it("retains numerical token usage without retaining provider envelope fields", () => {
  const result = providerObservation(200, undefined, 25, {
    prompt_tokens: 321,
    completion_tokens: 99,
    total_tokens: 420,
    secret: "PRIVATE",
    prompt: "PRIVATE ANSWER",
  });
  expect(result).toMatchObject({
    promptTokens: 321,
    completionTokens: 99,
    totalTokens: 420,
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(
    providerObservation(200, undefined, 25, {
      prompt_tokens: -1,
      completion_tokens: Infinity,
      total_tokens: "123",
    }),
  ).not.toHaveProperty("promptTokens");
});
it("shares exhausted token allowance before another provider call even after a successful response", async () => {
  await recordProviderObservation(
    "text",
    "model",
    200,
    {
      "x-ratelimit-remaining-tokens": "0",
      "x-ratelimit-reset-tokens": "7.66s",
      "x-ratelimit-remaining-requests": "999",
      "x-ratelimit-reset-requests": "20h",
    },
    100,
  );
  expect(mocks.eval).toHaveBeenCalledWith(
    PROVIDER_COOLDOWN_SCRIPT,
    expect.any(Array),
    [8],
  );
});

it("attempts quota cooldown even if the independent telemetry write fails", async () => {
  mocks.set.mockRejectedValueOnce(new Error("telemetry write failed"));
  const observation = await recordProviderObservation(
    "text",
    "model",
    200,
    { "x-ratelimit-remaining-tokens": "0", "x-ratelimit-reset-tokens": "8s" },
    100,
  );
  expect(observation.tokensPerMinuteRemaining).toBe(0);
  expect(mocks.eval).toHaveBeenCalledWith(
    PROVIDER_COOLDOWN_SCRIPT,
    expect.any(Array),
    [8],
  );
});

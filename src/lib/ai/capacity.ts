import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { HttpError } from "@/lib/http";
import { getScoringModel } from "./scoring-config";

export type ProviderLane = "text" | "audio";
export type ProviderCapacityCode =
  "AI_CAPACITY_BUSY" | "AI_PROVIDER_RATE_LIMIT";
export class ProviderCapacityError extends HttpError {
  readonly code: ProviderCapacityCode;
  constructor(code: ProviderCapacityCode, wait: number) {
    super(
      429,
      code === "AI_PROVIDER_RATE_LIMIT"
        ? "The interview service has reached its current allowance. Your answer is still here. Please wait before trying again."
        : "Several interviews are being processed. Your answer is still here; please try again shortly.",
      Math.max(1, Math.min(86400, Math.ceil(wait))),
    );
    this.code = code;
  }
}

// All deployments sharing this Redis use one budget. No API-key sharding.
// Redis TIME, rather than a Vercel instance's clock, owns admission and expiry.
export const PROVIDER_ADMISSION_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local cooldown = tonumber(redis.call('GET', KEYS[3]) or '0')
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 60000)
if cooldown > now then return {0, math.ceil((cooldown - now) / 1000), 2} end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return {0, 4, 0} end
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[3]) then
 local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
 return {0, math.max(1, math.ceil((tonumber(oldest[2]) + 60000 - now) / 1000)), 1}
end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[4]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))
redis.call('ZADD', KEYS[2], now, ARGV[1])
redis.call('PEXPIRE', KEYS[2], 60000)
return {1, 0, 0}
`;
export const PROVIDER_COOLDOWN_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local existing = tonumber(redis.call('GET', KEYS[1]) or '0')
local deadline = math.max(existing, now + tonumber(ARGV[1]) * 1000)
redis.call('SET', KEYS[1], deadline, 'PX', math.max(1, deadline - now))
return math.ceil((deadline - now) / 1000)
`;
export const PROVIDER_INSPECTION_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 60000)
local cooldown = tonumber(redis.call('GET', KEYS[3]) or '0')
return {redis.call('ZCARD', KEYS[1]), redis.call('ZCARD', KEYS[2]), math.max(0, math.ceil((cooldown - now) / 1000))}
`;

let client: Redis | undefined;
function configured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
function store() {
  if (!configured()) throw new Error("Capacity store unavailable");
  client ??= Redis.fromEnv({
    retry: { retries: 0 },
    signal: () => AbortSignal.timeout(2000),
  });
  return client;
}
function setting(name: string, fallback: number, maximum: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  )
    throw new Error("Invalid capacity setting");
  return value;
}
export function providerBudget(lane: ProviderLane) {
  return lane === "text"
    ? {
        concurrent: setting("IGNITE_AI_TEXT_CONCURRENCY", 4, 32),
        requestsPerMinute: setting("IGNITE_AI_TEXT_RPM", 20, 1000),
        leaseMs: 45000,
      }
    : {
        concurrent: setting("IGNITE_AI_AUDIO_CONCURRENCY", 2, 8),
        requestsPerMinute: setting("IGNITE_AI_AUDIO_RPM", 12, 200),
        leaseMs: 75000,
      };
}
function keys(lane: ProviderLane, model: string) {
  const hash = createHash("sha256").update(model).digest("hex").slice(0, 24);
  const prefix = `ignite:provider:v1:{${lane}:${hash}}`;
  return {
    leases: `${prefix}:leases`,
    requests: `${prefix}:requests`,
    cooldown: `${prefix}:cooldown`,
    telemetry: `${prefix}:telemetry`,
  };
}
function tuple(value: unknown): [number, number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(
      (v) =>
        typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1e12,
    )
  )
    throw new Error("Invalid capacity response");
  return value as [number, number, number];
}
function unavailable() {
  return new HttpError(
    503,
    "Interview processing is temporarily unavailable. Your answer is still here; please try again.",
  );
}

/** Each actual provider call acquires its own lease and rolling-minute reservation. */
export async function withProviderCapacity<T>(
  lane: ProviderLane,
  model: string,
  operation: () => Promise<T>,
): Promise<T> {
  const id = randomUUID(),
    k = keys(lane, model);
  let redis: Redis;
  try {
    redis = store();
    const budget = providerBudget(lane);
    const result = tuple(
      await redis.eval(
        PROVIDER_ADMISSION_SCRIPT,
        [k.leases, k.requests, k.cooldown],
        [id, budget.concurrent, budget.requestsPerMinute, budget.leaseMs],
      ),
    );
    if (result[0] === 0) {
      if (result[1] < 1 || result[1] > 86400 || ![0, 1, 2].includes(result[2]))
        throw new Error("Invalid admission denial");
      throw new ProviderCapacityError(
        result[2] === 2 ? "AI_PROVIDER_RATE_LIMIT" : "AI_CAPACITY_BUSY",
        result[1],
      );
    }
    if (result[0] !== 1 || result[1] !== 0 || result[2] !== 0)
      throw new Error("Invalid admission result");
  } catch (error) {
    if (error instanceof ProviderCapacityError) throw error;
    throw unavailable();
  }
  try {
    return await operation();
  } finally {
    // A lost release never discards a completed answer. The bounded lease expires.
    await redis.zrem(k.leases, id).catch(() => {});
  }
}

type HeaderSource = Headers | Record<string, unknown> | null | undefined;
function header(source: HeaderSource, name: string): string | undefined {
  try {
    if (source && typeof (source as Headers).get === "function")
      return (source as Headers).get(name) ?? undefined;
    const entry = Object.entries(source ?? {}).find(
      ([key]) => key.toLowerCase() === name,
    );
    return typeof entry?.[1] === "string" ? entry[1] : undefined;
  } catch {
    return undefined;
  }
}
function boundedNumber(value: string | undefined, maximum = 1e12) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= maximum
    ? number
    : undefined;
}
export function resetSeconds(value: string | undefined): number | undefined {
  if (!value || value.length > 100) return undefined;
  const raw = value.trim();
  const plain = boundedNumber(raw, 86400);
  if (plain !== undefined) return plain;
  const parts = [...raw.matchAll(/(\d+(?:\.\d+)?)(ms|d|h|m|s)/g)];
  if (!parts.length || parts.map((match) => match[0]).join("") !== raw)
    return undefined;
  const units: Record<string, number> = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const seconds = parts.reduce(
    (sum, match) => sum + Number(match[1]) * units[match[2]],
    0,
  );
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 86400
    ? seconds
    : undefined;
}
export function providerRetryAfter(
  headers: HeaderSource,
  now = Date.now(),
): number {
  const raw = header(headers, "retry-after");
  let seconds = boundedNumber(raw) ?? resetSeconds(raw);
  if (
    seconds === undefined &&
    raw &&
    raw.length < 100 &&
    /[A-Za-z]/.test(raw)
  ) {
    const date = Date.parse(raw);
    if (Number.isFinite(date)) seconds = (date - now) / 1000;
  }
  // Retry-After is authoritative; otherwise use only documented reset headers.
  if (seconds === undefined) {
    const waits: number[] = [];
    if (boundedNumber(header(headers, "x-ratelimit-remaining-requests")) === 0)
      waits.push(
        resetSeconds(header(headers, "x-ratelimit-reset-requests")) ?? 60,
      );
    if (boundedNumber(header(headers, "x-ratelimit-remaining-tokens")) === 0)
      waits.push(
        resetSeconds(header(headers, "x-ratelimit-reset-tokens")) ?? 60,
      );
    seconds = waits.length ? Math.max(...waits) : 60;
  }
  return Math.max(1, Math.min(86400, Math.ceil(seconds)));
}
export type ProviderObservation = {
  observedAt: string;
  status: number;
  latencyMs: number;
  requestsPerDayLimit?: number;
  requestsPerDayRemaining?: number;
  tokensPerMinuteLimit?: number;
  tokensPerMinuteRemaining?: number;
  requestsResetSeconds?: number;
  tokensResetSeconds?: number;
  retryAfterSeconds?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
/** Whitelist numeric capacity metadata. Never persist requests, prompts, audio, or keys. */
export function providerObservation(
  status: number,
  headers: HeaderSource,
  latencyMs: number,
  usage?: unknown,
): ProviderObservation {
  const observation: ProviderObservation = {
    observedAt: new Date().toISOString(),
    status:
      Number.isInteger(status) && status >= 100 && status <= 599 ? status : 503,
    latencyMs: Number.isFinite(latencyMs)
      ? Math.max(0, Math.min(300000, Math.round(latencyMs)))
      : 0,
  };
  const counts = [
    ["requestsPerDayLimit", "x-ratelimit-limit-requests"],
    ["requestsPerDayRemaining", "x-ratelimit-remaining-requests"],
    ["tokensPerMinuteLimit", "x-ratelimit-limit-tokens"],
    ["tokensPerMinuteRemaining", "x-ratelimit-remaining-tokens"],
  ] as const;
  for (const [field, key] of counts) {
    const value = boundedNumber(header(headers, key));
    if (value !== undefined) observation[field] = value;
  }
  const requestReset = resetSeconds(
    header(headers, "x-ratelimit-reset-requests"),
  );
  const tokenReset = resetSeconds(header(headers, "x-ratelimit-reset-tokens"));
  if (requestReset !== undefined)
    observation.requestsResetSeconds = requestReset;
  if (tokenReset !== undefined) observation.tokensResetSeconds = tokenReset;
  if (header(headers, "retry-after") !== undefined)
    observation.retryAfterSeconds = providerRetryAfter(headers);
  if (usage && typeof usage === "object") {
    const values = usage as Record<string, unknown>;
    for (const [field, key] of [
      ["promptTokens", "prompt_tokens"],
      ["completionTokens", "completion_tokens"],
      ["totalTokens", "total_tokens"],
    ] as const) {
      const value = values[key];
      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 1e9
      )
        observation[field] = value;
    }
  }
  return observation;
}
export async function recordProviderObservation(
  lane: ProviderLane,
  model: string,
  status: number,
  headers: HeaderSource,
  latencyMs: number,
  usage?: unknown,
) {
  const k = keys(lane, model);
  const observation = providerObservation(status, headers, latencyMs, usage);
  try {
    const redis = store();
    // Independent writes run together; failed telemetry must not suppress cooldown.
    const updates: Promise<unknown>[] = [
      redis.set(k.telemetry, observation, { ex: 86400 }),
    ];
    if (
      observation.requestsPerDayRemaining === 0 ||
      observation.tokensPerMinuteRemaining === 0
    ) {
      updates.push(
        redis.eval(
          PROVIDER_COOLDOWN_SCRIPT,
          [k.cooldown],
          [providerRetryAfter(headers)],
        ),
      );
    }
    await Promise.allSettled(updates);
  } catch {
    /* Capacity telemetry is best-effort, never a reason to lose a completed answer. */
  }
  return observation;
}
export async function providerRateLimit(
  lane: ProviderLane,
  model: string,
  headers: HeaderSource,
) {
  let wait = providerRetryAfter(headers);
  try {
    const actual = await store().eval(
      PROVIDER_COOLDOWN_SCRIPT,
      [keys(lane, model).cooldown],
      [wait],
    );
    if (typeof actual === "number" && Number.isFinite(actual))
      wait = Math.max(wait, actual);
  } catch {
    /* New admission still fails closed if Redis is unavailable. */
  }
  return new ProviderCapacityError("AI_PROVIDER_RATE_LIMIT", wait);
}

function cleanObservation(value: unknown): ProviderObservation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.observedAt !== "string" ||
    !Number.isFinite(Date.parse(raw.observedAt)) ||
    typeof raw.status !== "number" ||
    !Number.isInteger(raw.status) ||
    raw.status < 100 ||
    raw.status > 599 ||
    typeof raw.latencyMs !== "number" ||
    !Number.isFinite(raw.latencyMs) ||
    raw.latencyMs < 0 ||
    raw.latencyMs > 300000
  )
    return null;
  const result: ProviderObservation = {
    observedAt: raw.observedAt,
    status: raw.status,
    latencyMs: raw.latencyMs,
  };
  for (const field of [
    "requestsPerDayLimit",
    "requestsPerDayRemaining",
    "tokensPerMinuteLimit",
    "tokensPerMinuteRemaining",
    "requestsResetSeconds",
    "tokensResetSeconds",
    "retryAfterSeconds",
    "promptTokens",
    "completionTokens",
    "totalTokens",
  ] as const) {
    if (
      typeof raw[field] === "number" &&
      Number.isFinite(raw[field]) &&
      raw[field] >= 0 &&
      raw[field] <= 1e12
    )
      result[field] = raw[field];
  }
  return result;
}
export async function getProviderCapacitySnapshot() {
  const profiles = [
    { lane: "text" as const, model: getScoringModel() },
    {
      lane: "audio" as const,
      model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
    },
  ];
  try {
    const redis = store();
    const lanes = await Promise.all(
      profiles.map(async ({ lane, model }) => {
        const k = keys(lane, model);
        const [live, latest] = await Promise.all([
          redis.eval(
            PROVIDER_INSPECTION_SCRIPT,
            [k.leases, k.requests, k.cooldown],
            [],
          ),
          redis.get<unknown>(k.telemetry),
        ]);
        const [active, requestsInMinute, cooldownSeconds] = tuple(live);
        const budget = providerBudget(lane);
        return {
          lane,
          model,
          maxConcurrent: budget.concurrent,
          requestsPerMinute: budget.requestsPerMinute,
          active,
          requestsInMinute,
          cooldownSeconds,
          latest: cleanObservation(latest),
        };
      }),
    );
    return {
      configured: true,
      available: true,
      checkedAt: new Date().toISOString(),
      lanes,
    };
  } catch {
    return {
      configured: configured(),
      available: false,
      checkedAt: new Date().toISOString(),
      lanes: [],
    };
  }
}

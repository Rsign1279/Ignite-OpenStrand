import "server-only";
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { HttpError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

class RequestBusy extends HttpError {
  readonly code = "AI_CAPACITY_BUSY";
  constructor() {
    super(
      429,
      "Reviews are busy. Your answer is safe; we’ll try again shortly.",
      2,
    );
  }
}
const releaseOwned = `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end`;
const acquireUpload = `local t=redis.call('TIME');local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000);redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now);if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[1]) then return 0 end;redis.call('ZADD',KEYS[1],now+tonumber(ARGV[2]),ARGV[3]);redis.call('PEXPIRE',KEYS[1],tonumber(ARGV[2])+1000);return 1`;
function client() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  )
    throw new HttpError(
      503,
      "Processing is temporarily unavailable. Your answer is still here.",
    );
  return Redis.fromEnv({
    retry: { retries: 0 },
    signal: () => AbortSignal.timeout(2000),
  });
}
function unavailable() {
  return new HttpError(
    503,
    "Processing is temporarily unavailable. Your answer is still here. Please try again.",
  );
}

/** One provider workflow at a time for the authenticated student's request ID. */
export async function withAssessmentLock<T>(
  userId: string,
  requestId: string,
  operation: () => Promise<T>,
) {
  const redis = client(),
    owner = randomUUID(),
    key = `ignite:request:${userId}:${requestId}`;
  let acquired: unknown;
  try {
    acquired = await redis.set(key, owner, { nx: true, ex: 120 });
  } catch {
    throw unavailable();
  }
  if (acquired !== "OK") throw new RequestBusy();
  try {
    return await operation();
  } finally {
    // An expired owner must never delete a newer request's lease.
    try {
      await redis.eval(releaseOwned, [key], [owner]);
    } catch {
      /* bounded lease expires */
    }
  }
}

/** Capacity backoff retries count as one logical submission, with bound content. */
export async function limitLogicalSubmission(
  userId: string,
  bucket: string,
  requestId: string,
  fingerprint: string,
) {
  const redis = client(),
    key = `ignite:logical:${bucket}:${userId}:${requestId}`;
  let previous: unknown;
  try {
    previous = await redis.get(key);
  } catch {
    throw unavailable();
  }
  if (previous !== null && previous !== undefined) {
    if (previous !== fingerprint)
      throw new HttpError(
        409,
        "This response changed. Start a new attempt before sending another answer.",
      );
    return;
  }
  await rateLimit(userId, bucket);
  try {
    await redis.set(key, fingerprint, { ex: 600 });
  } catch {
    throw unavailable();
  }
}

/** Bound multipart memory before reading a body, across all function instances. */
export async function withUploadAdmission<T>(operation: () => Promise<T>) {
  const redis = client(),
    owner = randomUUID(),
    key = "ignite:uploads:active";
  let allowed: unknown;
  try {
    allowed = await redis.eval(acquireUpload, [key], [8, 100000, owner]);
  } catch {
    throw unavailable();
  }
  if (Number(allowed) !== 1) throw new RequestBusy();
  try {
    return await operation();
  } finally {
    try {
      await redis.zrem(key, owner);
    } catch {
      /* bounded lease expires */
    }
  }
}

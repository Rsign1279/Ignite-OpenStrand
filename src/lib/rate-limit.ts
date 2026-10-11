import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { HttpError } from "@/lib/http";
let limiter: Ratelimit | undefined;
export async function rateLimit(userId: string, bucket: string) {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  )
    throw new HttpError(
      503,
      "Interview processing is not configured yet. Please contact your advisor.",
    );
  limiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(12, "10 m"),
    analytics: false,
    prefix: "ignite:limit",
  });
  let result;
  try {
    result = await limiter.limit(`${bucket}:${userId}`);
  } catch {
    // Fail closed; never fall back to per-process counters in serverless deployment.
    throw new HttpError(
      503,
      "Interview processing is temporarily unavailable. Please contact your advisor. Your typed answer is still here.",
    );
  }
  if (result.reason === "timeout")
    throw new HttpError(
      503,
      "Interview processing is temporarily unavailable. Your typed answer is still here. Please try again.",
    );
  if (!result.success)
    throw new HttpError(
      429,
      "You're sending requests too quickly. Please wait a moment and try again.",
    );
}

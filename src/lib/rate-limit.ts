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
  const result = await limiter.limit(`${bucket}:${userId}`);
  if (!result.success)
    throw new HttpError(
      429,
      "You're sending requests too quickly. Please wait a moment and try again.",
    );
}

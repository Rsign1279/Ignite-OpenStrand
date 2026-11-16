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
  if (!result.success) {
    const retryAfter =
      typeof result.reset === "number" && Number.isFinite(result.reset)
        ? Math.max(
            1,
            Math.min(600, Math.ceil((result.reset - Date.now()) / 1000)),
          )
        : 600;
    const wait =
      retryAfter < 60
        ? `${retryAfter} second${retryAfter === 1 ? "" : "s"}`
        : `${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? "s" : ""}`;
    throw new HttpError(
      429,
      `Take a short practice break. Please try again in about ${wait}.`,
      retryAfter,
    );
  }
}

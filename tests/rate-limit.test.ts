import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn() } }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = mock.limit;
  },
}));
import { rateLimit } from "@/lib/rate-limit";
import { failure } from "@/lib/http";
beforeEach(() => {
  mock.limit.mockReset();
  vi.restoreAllMocks();
  process.env.UPSTASH_REDIS_REST_URL = "test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
});
it("passes authenticated opaque ID and bucket only", async () => {
  mock.limit.mockResolvedValue({ success: true });
  await rateLimit("uuid", "assessment");
  expect(mock.limit).toHaveBeenCalledWith("assessment:uuid");
});
it("returns 429 when quota exhausted", async () => {
  mock.limit.mockResolvedValue({ success: false });
  await expect(rateLimit("uuid", "assessment")).rejects.toMatchObject({
    status: 429,
  });
});
it("reports the actual quota reset instead of encouraging repeated early retries", async () => {
  const now = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockReturnValue(now);
  mock.limit.mockResolvedValue({ success: false, reset: now + 245_000 });
  try {
    await rateLimit("uuid", "assessment");
    throw new Error("Expected a quota rejection");
  } catch (error) {
    const response = failure(error);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("245");
    expect(await response.json()).toEqual({
      error:
        "Take a short practice break. Please try again in about 5 minutes.",
    });
  }
});
it.each([NaN, Infinity, undefined])(
  "uses a bounded full-window wait for an invalid reset %s",
  async (reset) => {
    mock.limit.mockResolvedValue({ success: false, reset });
    await expect(rateLimit("uuid", "assessment")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 600,
      message: expect.stringContaining("10 minutes"),
    });
  },
);
it("fails closed with safe advisor message for read-only credentials", async () => {
  mock.limit.mockRejectedValue(new Error("NOPERM evalsha PRIVATE"));
  await expect(rateLimit("uuid", "assessment")).rejects.toMatchObject({
    status: 503,
    message: expect.stringContaining("contact your advisor"),
  });
});
it("fails closed when unconfigured", async () => {
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await expect(rateLimit("uuid", "assessment")).rejects.toMatchObject({
    status: 503,
  });
  expect(mock.limit).not.toHaveBeenCalled();
});

it("does not accept library fail-open timeout responses", async () => {
  mock.limit.mockResolvedValue({ success: true, reason: "timeout" });
  await expect(rateLimit("uuid", "assessment")).rejects.toMatchObject({
    status: 503,
  });
});

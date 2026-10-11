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
beforeEach(() => {
  mock.limit.mockReset();
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

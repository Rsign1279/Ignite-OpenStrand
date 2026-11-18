import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HttpError } from "@/lib/http";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/ai/capacity", () => ({
  getProviderCapacitySnapshot: mocks.snapshot,
}));
import { GET } from "@/app/api/staff/capacity/route";
import { PilotCapacity } from "@/components/staff/pilot-capacity";
import { capacityStatusSchema } from "@/lib/ai/capacity-status";
const observedAt = "2026-11-17T12:00:00.000Z";
const snapshot = () => ({
  configured: true,
  available: true,
  checkedAt: observedAt,
  lanes: [
    {
      lane: "text",
      model: "private-model-config",
      maxConcurrent: 4,
      requestsPerMinute: 20,
      active: 2,
      requestsInMinute: 6,
      cooldownSeconds: 0,
      latest: {
        observedAt,
        status: 200,
        latencyMs: 810,
        requestsPerDayLimit: 1000,
        requestsPerDayRemaining: 999,
        tokensPerMinuteLimit: 8000,
        tokensPerMinuteRemaining: 7000,
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        prompt: "private synthetic transcript",
        key: "private-token",
      },
      student_id: "private-id",
    },
  ],
  extra: "private response payload",
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ user: { id: "teacher" } });
  mocks.snapshot.mockResolvedValue(snapshot());
});
it.each([401, 403])(
  "requires verified staff before inspecting Redis (%s)",
  async (status) => {
    mocks.admin.mockRejectedValue(new HttpError(status, "Access denied."));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  },
);
it("strips arbitrary fields and model settings at the authenticated no-store boundary", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.lanes[0].latest.requestsPerDayLimit).toBe(1000);
  expect(data.lanes[0].latest.tokensPerMinuteRemaining).toBe(7000);
  expect(JSON.stringify(data)).not.toContain("private");
  expect(data.lanes[0]).not.toHaveProperty("model");
  expect(mocks.admin.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.snapshot.mock.invocationCallOrder[0],
  );
});
it("returns an explicit unavailable snapshot without inventing provider quotas", async () => {
  mocks.snapshot.mockResolvedValue({
    configured: false,
    available: false,
    checkedAt: observedAt,
    lanes: [],
  });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    configured: false,
    available: false,
    checkedAt: observedAt,
    lanes: [],
  });
});
it.each([NaN, Infinity, -1, 1e15])(
  "does not expose corrupt counter values (%s)",
  async (value) => {
    const data = snapshot();
    data.lanes[0].active = value;
    mocks.snapshot.mockResolvedValue(data);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  },
);
it("does not accept unknown provider lanes or substitute unknown quotas with zero", () => {
  const data = snapshot();
  data.lanes[0].lane = "untrusted";
  expect(capacityStatusSchema.safeParse(data).success).toBe(false);
  const withoutObservation = {
    ...snapshot(),
    lanes: [{ ...snapshot().lanes[0], latest: null }],
  };
  expect(
    capacityStatusSchema.parse(withoutObservation).lanes[0].latest,
  ).toBeNull();
});
it("renders a concise loading state without network or provider calls during server rendering", () => {
  const html = renderToStaticMarkup(<PilotCapacity />);
  expect(html).toContain("Checking capacity");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("not a guarantee of school-wide capacity");
  expect(html).toContain("does not call the AI provider");
  expect(html).not.toContain("0 / 0");
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

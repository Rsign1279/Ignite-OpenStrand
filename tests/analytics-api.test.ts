import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/analytics/data", () => ({ loadAttempts: mocks.load }));
import { GET } from "@/app/api/staff/analytics/route";
import { GET as csv } from "@/app/api/staff/export-csv/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.load.mockResolvedValue([]);
});
it.each([401, 403])(
  "rejects unauthorized %i before reading any attempts",
  async (status) => {
    mocks.admin.mockRejectedValue(new HttpError(status, "Denied"));
    expect(
      (await GET(new Request("http://localhost/api/staff/analytics"))).status,
    ).toBe(status);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(
      (await csv(new Request("http://localhost/api/staff/export-csv"))).status,
    ).toBe(status);
  },
);
it("returns server aggregates only and disables caching", async () => {
  const r = await GET(new Request("http://localhost/api/staff/analytics"));
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("no-store");
  const body = await r.json();
  expect(body.kpis.activeStudents).toBe(0);
  expect(body).not.toHaveProperty("attempts");
});
it("validates filters before database access", async () => {
  expect(
    (
      await GET(
        new Request("http://localhost/api/staff/analytics?minAttempts=-1"),
      )
    ).status,
  ).toBe(400);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("does not expose DB internals on failures", async () => {
  mocks.load.mockRejectedValue(new Error("PRIVATE DATABASE"));
  const r = await GET(new Request("http://localhost/api/staff/analytics"));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("PRIVATE");
});
it("validates student IDs for exports and provides an attachment", async () => {
  expect(
    (await csv(new Request("http://localhost/api/staff/export-csv?id=bad")))
      .status,
  ).toBe(400);
  const r = await csv(new Request("http://localhost/api/staff/export-csv"));
  expect(r.headers.get("content-disposition")).toContain("attachment");
  expect(await r.text()).toContain("first_score");
});

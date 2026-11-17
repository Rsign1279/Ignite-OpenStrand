import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  client: vi.fn(),
  select: vi.fn(),
  range: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ adminClient: mocks.client }));
import { GET } from "@/app/api/admin/profiles/route";
import { registeredProfiles } from "@/lib/analytics/registrations";
const cohort = "44444444-4444-4444-8444-444444444444";
const profiles = [
  {
    user_id: "11111111-1111-4111-8111-111111111111",
    name: "A real learner",
    strand: "aviation",
    ignite_year: 2,
    qa_cohort_id: null,
  },
  {
    user_id: "22222222-2222-4222-8222-222222222222",
    name: "[QA] A real chosen name",
    strand: "technology",
    ignite_year: 1,
    qa_cohort_id: null,
  },
  {
    user_id: "33333333-3333-4333-8333-333333333333",
    name: "Synthetic tester with no attempts",
    strand: "education",
    ignite_year: 1,
    qa_cohort_id: cohort,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.range.mockResolvedValue({ data: profiles, error: null });
  mocks.select.mockReturnValue({ order: () => ({ range: mocks.range }) });
  mocks.client.mockReturnValue({ from: () => ({ select: mocks.select }) });
});
it("ordinary registration API excludes QA while preserving its compact profile response", async () => {
  const response = await GET(
    new Request("https://studio.example/api/admin/profiles"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(
    profiles
      .slice(0, 2)
      .map(({ name, strand, ignite_year }) => ({ name, strand, ignite_year })),
  );
});
it("teacher QA/all queries include zero-attempt identities and their trusted cohort IDs", async () => {
  const qa = await GET(
    new Request("https://studio.example/api/admin/profiles?scope=qa"),
  );
  expect(await qa.json()).toEqual([profiles[2]]);
  const all = await registeredProfiles("all");
  expect(all).toHaveLength(3);
  expect(mocks.select).toHaveBeenCalledWith(
    "user_id,name,strand,ignite_year,qa_cohort_id",
  );
});
it("rejects invalid scope and nonstaff before any privileged profile load", async () => {
  const invalid = await GET(
    new Request("https://studio.example/api/admin/profiles?scope=staff"),
  );
  expect(invalid.status).toBe(400);
  expect(mocks.client).not.toHaveBeenCalled();
  mocks.admin.mockRejectedValue(new HttpError(403, "Forbidden"));
  expect(
    (
      await GET(
        new Request("https://studio.example/api/admin/profiles?scope=all"),
      )
    ).status,
  ).toBe(403);
  expect(mocks.client).not.toHaveBeenCalled();
});

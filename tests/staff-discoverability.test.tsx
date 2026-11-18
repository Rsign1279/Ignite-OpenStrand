import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import type { Attempt } from "@/lib/analytics/model";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/analytics/data", () => ({ loadAttempts: mocks.load }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("@/components/staff/chart-loader", () => ({
  ProgramCharts: () => null,
  StudentCharts: () => null,
}));

import RawData from "@/app/staff/page";
import Dashboard from "@/app/staff/dashboard/page";
import Student from "@/app/staff/student/[id]/page";
import { GET as exportCsv } from "@/app/api/staff/export-csv/route";
import { AdminDashboard } from "@/components/admin-dashboard";
import { StaffShell } from "@/components/staff/shell";
import { AnalyticsFilters } from "@/components/staff/filters";
import { filterQuery, parseFilters } from "@/lib/analytics/model";

const cohort = "44444444-4444-4444-8444-444444444444";
const rows: Attempt[] = [false, true].map((qa, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  student_id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  student_name: qa ? "Synthetic test identity" : "Ordinary learner",
  qa_cohort_id: qa ? cohort : null,
  strand: "business",
  question_id: "business-teamwork-v1",
  question_text: "Tell me about your contribution to a team project.",
  attempt_number: 1,
  total_score: 8,
  scores: { situation: 2, task: 2, action: 2, result: 2 },
  stage: "pre",
  created_at: "2026-11-18T10:00:00Z",
  is_legacy: false,
  answer_text: qa ? "Saved synthetic answer" : "Saved student answer",
  feedback_text: "Saved feedback",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.load.mockResolvedValue(rows);
});

async function raw(params: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await RawData({ searchParams: Promise.resolve(params) }),
  );
}
function displayedExport(html: string) {
  const href = html.match(/href="([^"]*\/api\/staff\/export-csv[^"]*)"/);
  if (!href) throw new Error("No scored CSV link rendered");
  return new Request(
    "https://studio.example" + href[1].replaceAll("&amp;", "&"),
  );
}

it("opens raw data with both session kinds and exports exactly that displayed scope", async () => {
  const html = await raw();
  expect(html).toContain("2 scored attempts");
  expect(html).toContain("Ordinary learner");
  expect(html).toContain("Synthetic test identity");
  expect(html).toContain("All sessions (includes QA)");
  expect(html).toContain("Choose Students only to hide test data.");
  expect(html).toContain('<th scope="col">Session</th>');
  expect(html).toContain('value="all" selected=""');
  const response = await exportCsv(displayedExport(html));
  expect(response.headers.get("content-disposition")).toContain(
    "ignite-all-scored-attempts.csv",
  );
  const csv = await response.text();
  expect(csv).toContain("Saved synthetic answer");
  expect(csv).toContain("Saved student answer");
});

it.each(["students", "qa"] as const)(
  "keeps explicit %s scope in displayed rows, CSV and clear navigation",
  async (scope) => {
    const html = await raw({ scope });
    const included = scope === "qa" ? rows[1] : rows[0];
    const excluded = scope === "qa" ? rows[0] : rows[1];
    expect(html).toContain("1 scored attempt");
    expect(html).toContain(included.student_name);
    expect(html).not.toContain(excluded.student_name);
    expect(html).toContain(`href="/staff?scope=${scope}">Clear</a>`);
    const response = await exportCsv(displayedExport(html));
    const csv = await response.text();
    expect(csv).toContain(included.answer_text);
    expect(csv).not.toContain(excluded.answer_text);
    expect(response.headers.get("content-disposition")).toContain(
      `ignite-${scope === "qa" ? "qa" : "student"}-scored-attempts.csv`,
    );
  },
);

it("preserves explicit student scope in pagination and filter round trips", async () => {
  mocks.load.mockResolvedValue(
    Array.from({ length: 51 }, (_, index) => ({
      ...rows[0],
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      attempt_number: index + 1,
    })).concat(rows[1]),
  );
  const html = await raw({ scope: "students" });
  expect(html).toContain("51 scored attempts");
  expect(html).toContain('href="/staff?scope=students&amp;page=2"');
  expect(html).not.toContain("Synthetic test identity");
  const filters = parseFilters(
    new URLSearchParams("scope=students&student=Ordinary"),
  );
  expect(parseFilters(new URLSearchParams(filterQuery(filters)))).toEqual(
    filters,
  );
  expect(
    renderToStaticMarkup(
      <AnalyticsFilters filters={filters} action="/staff" />,
    ),
  ).toContain('href="/staff?scope=students">Clear</a>');
});

it("keeps student metrics as the default and makes a mixed overview an explicit choice", async () => {
  const rawHtml = await raw();
  expect(rawHtml).toContain('href="/staff/dashboard"');
  expect(rawHtml).toContain('href="/admin"');
  expect(rawHtml).toContain(
    'href="/staff/dashboard?scope=all">Open overview for these sessions</a>',
  );
  const overview = renderToStaticMarkup(
    await Dashboard({ searchParams: Promise.resolve({}) }),
  );
  expect(overview).toContain("Ordinary learner");
  expect(overview).not.toContain("Synthetic test identity");
  expect(overview).toContain('href="/staff"');
});

it("retains explicit student or QA navigation while default entries open all raw attempts", () => {
  const defaultShell = renderToStaticMarkup(<StaffShell>{null}</StaffShell>);
  expect(defaultShell).toContain('href="/staff"');
  for (const scope of ["students", "qa", "all"] as const) {
    const html = renderToStaticMarkup(
      <StaffShell scope={scope}>{null}</StaffShell>,
    );
    expect(html).toContain(`href="/staff?scope=${scope}"`);
  }
});

it("returns from a student detail to the explicitly selected student-only raw scope", async () => {
  mocks.load.mockImplementation(async (id?: string) =>
    id ? rows.filter((row) => row.student_id === id) : rows,
  );
  const html = renderToStaticMarkup(
    await Student({
      params: Promise.resolve({ id: rows[0].student_id }),
      searchParams: Promise.resolve({ scope: "students" }),
    }),
  );
  expect(html).toContain('href="/staff?scope=students"');
  expect(html).not.toContain("Synthetic test identity");
});

it("separates all scored QA downloads from the registration roster", () => {
  const html = renderToStaticMarkup(
    <AdminDashboard profiles={[]} scope="qa" />,
  );
  expect(html).toContain('href="/api/staff/export-csv?scope=qa">');
  expect(html).toContain("Download all scored QA CSV");
  expect(html).toContain("Download QA roster");
  expect(html).toContain("QA registration roster");
  expect(html).toContain("Review QA scores &amp; answers");
  expect(html).toContain("sessions without answers");
});

it("keeps a direct unscoped CSV student-only and rejects invalid scope before loading", async () => {
  const response = await exportCsv(
    new Request("https://studio.example/api/staff/export-csv"),
  );
  expect(await response.text()).not.toContain("Saved synthetic answer");
  mocks.load.mockClear();
  const bad = await exportCsv(
    new Request("https://studio.example/api/staff/export-csv?scope=invalid"),
  );
  expect(bad.status).toBe(400);
  expect(mocks.load).not.toHaveBeenCalled();
});

it("authenticates before loading any mixed raw page or scored CSV", async () => {
  mocks.admin.mockRejectedValue(new HttpError(403, "Access denied."));
  await expect(raw()).rejects.toThrow("REDIRECT:/staff/login");
  const response = await exportCsv(
    new Request("https://studio.example/api/staff/export-csv?scope=all"),
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.load).not.toHaveBeenCalled();
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PdfReport } from "@/components/staff/exports";
import type { Attempt } from "@/lib/analytics/model";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  reports: [] as PdfReport[],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/analytics/pages", async (original) => ({
  ...(await original<typeof import("@/lib/analytics/pages")>()),
  staffPage: vi.fn(),
}));
vi.mock("@/lib/analytics/data", () => ({ loadAttempts: mocks.load }));
vi.mock("@/components/staff/chart-loader", () => ({
  ProgramCharts: () => null,
  StudentCharts: () => null,
}));
vi.mock("@/components/staff/exports", () => ({
  ReportExports: ({ report }: { report: PdfReport }) => {
    mocks.reports.push(report);
    return null;
  },
}));
import RawData from "@/app/staff/page";
import StudentPage from "@/app/staff/student/[id]/page";
import { StaffShell } from "@/components/staff/shell";
import { OverviewContent } from "@/components/staff/overview";
import { aggregate } from "@/lib/analytics/aggregate";
import { attemptsCsv } from "@/lib/analytics/csv";
import { parseFilters } from "@/lib/analytics/model";

const realId = "11111111-1111-4111-8111-111111111111";
const qaId = "22222222-2222-4222-8222-222222222222";
const cohort = "44444444-4444-4444-8444-444444444444";
const filters = parseFilters(new URLSearchParams());
const row = (n: number, qa = false): Attempt => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  student_id: qa ? qaId : realId,
  student_name: qa ? "Synthetic tester" : "[QA] A student's chosen name",
  qa_cohort_id: qa ? cohort : null,
  strand: "business",
  question_id: "business-teamwork-v1",
  question_text: "Tell me about a time you worked with a team.",
  attempt_number: n,
  total_score: 8,
  scores: { situation: 2, task: 2, action: 2, result: 2 },
  stage: n === 1 ? "pre" : "post",
  created_at: `2026-11-17T10:00:0${n}Z`,
  is_legacy: false,
  scoring_version: "saved-scoring-method-v3",
  answer_text: qa ? "PRIVATE SYNTHETIC ANSWER" : "PRIVATE STUDENT ANSWER",
  feedback_text: "Saved feedback",
});
const comparison = {
  improvements: ["<script>alert(1)</script>", "A clearer task."],
  nextStep: "Explain one personal decision.",
  review_version: "saved-comparison-method-v3",
  created_at: "2026-11-17T10:00:05Z",
  pre_attempt_id: row(1).id,
} as NonNullable<Attempt["comparison"]>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reports.length = 0;
  mocks.load.mockResolvedValue([row(1), { ...row(2), comparison }]);
});

it("retains QA or mixed scope across every global staff data tab", () => {
  for (const scope of ["qa", "all"] as const) {
    const html = renderToStaticMarkup(StaffShell({ scope, children: null }));
    expect(html).toContain(`href="/staff/dashboard?scope=${scope}"`);
    expect(html).toContain(`href="/staff?scope=${scope}"`);
    expect(html).toContain(`href="/admin?scope=${scope}"`);
    expect(html).toContain('href="/admin?scope=qa"');
  }
});

it("exposes exact saved score provenance for PRE and POST, outside comparison lists", async () => {
  const html = renderToStaticMarkup(
    await RawData({ searchParams: Promise.resolve({}) }),
  );
  expect(html.match(/saved-scoring-method-v3/g)).toHaveLength(2);
  expect(html).toContain("saved-comparison-method-v3");
  expect(html).toContain(comparison.created_at);
  expect(html).toContain(comparison.pre_attempt_id);
  expect(html).toMatch(
    /<\/ol><h3>Next step<\/h3>[\s\S]*?<details class="attempt-review-details">/,
  );
  expect(html).not.toContain("<ol><details");
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
});

it("marks each mixed-scope PDF row as student or synthetic QA without exporting answers into chart summaries", () => {
  const data = aggregate([row(1), row(3, true)], { ...filters, scope: "all" });
  renderToStaticMarkup(createElement(OverviewContent, { data }));
  const report = mocks.reports[0];
  expect(report.title).toContain("All sessions (includes QA)");
  const kindColumn = report.headers.indexOf("Session kind");
  expect(kindColumn).toBeGreaterThan(-1);
  expect(
    report.rows.find((r) => r[0] === "Synthetic tester")?.[kindColumn],
  ).toBe("Synthetic QA");
  expect(
    report.rows.find((r) => r[0].includes("chosen name"))?.[kindColumn],
  ).toBe("Student");
  expect(report.rows.every((r) => r.length === report.headers.length)).toBe(
    true,
  );
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});

it("identifies an individual synthetic QA PDF even when reached from mixed scope", async () => {
  mocks.load.mockImplementation(async (studentId?: string) =>
    studentId ? [row(3, true)] : [row(1), row(3, true)],
  );
  const page = await StudentPage({
    params: Promise.resolve({ id: qaId }),
    searchParams: Promise.resolve({ scope: "all" }),
  });
  renderToStaticMarkup(page);
  expect(mocks.reports[0].title).toBe(
    "IGNITE · Synthetic QA · Synthetic tester",
  );
  expect(mocks.reports[0].filters).toContain("All sessions (includes QA)");
});

it("keeps synthetic answers out of default exports while preserving exact saved comparison evidence and formula escaping in explicit exports", () => {
  const qa = { ...row(3, true), comparison };
  const allRows = [row(1), qa];
  const studentCsv = attemptsCsv(allRows, filters);
  expect(studentCsv).toContain("PRIVATE STUDENT ANSWER");
  expect(studentCsv).not.toContain("PRIVATE SYNTHETIC ANSWER");
  const qaCsv = attemptsCsv(
    [{ ...qa, answer_text: '=HYPERLINK("https://example.com")' }],
    { ...filters, scope: "qa" },
  );
  expect(qaCsv).toContain("'=");
  expect(qaCsv).toContain("saved-scoring-method-v3");
  expect(qaCsv).toContain(comparison.review_version);
  expect(qaCsv).toContain(comparison.created_at);
  expect(qaCsv).toContain(comparison.pre_attempt_id);
  expect(qaCsv).toContain(cohort);
  expect(qaCsv).not.toContain("PRIVATE STUDENT ANSWER");
});

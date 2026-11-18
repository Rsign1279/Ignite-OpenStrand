import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
import {
  aggregate,
  studentDetail,
  filterAttempts,
} from "@/lib/analytics/aggregate";
import { attemptsCsv } from "@/lib/analytics/csv";
import { parseFilters, filterQuery, type Attempt } from "@/lib/analytics/model";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AnalyticsFilters } from "@/components/staff/filters";
import { profilesCsv } from "@/lib/csv";
const cohort = "44444444-4444-4444-8444-444444444444";
const normal = "11111111-1111-4111-8111-111111111111";
const qa = "22222222-2222-4222-8222-222222222222";
const row = (index: number, synthetic: boolean): Attempt => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  student_id: synthetic ? qa : normal,
  student_name: synthetic
    ? "Synthetic tester"
    : "[QA] A real student's chosen name",
  qa_cohort_id: synthetic ? cohort : null,
  strand: "aviation",
  question_id: "aviation-teamwork-v1",
  question_text: "Tell me about a time you worked with a team.",
  attempt_number: index,
  total_score: synthetic ? 12 : 6,
  scores: synthetic
    ? { situation: 3, task: 3, action: 3, result: 3 }
    : { situation: 2, task: 1, action: 2, result: 1 },
  stage: "practice",
  created_at: `2026-11-17T10:00:0${index}Z`,
  is_legacy: false,
  answer_text: synthetic ? "SYNTHETIC QA ANSWER" : "ACTUAL COHORT ANSWER",
  feedback_text: "Specific feedback",
});
const filters = parseFilters(new URLSearchParams());
it("excludes trusted QA markers by default without relying on a student's chosen name", () => {
  const rows = [row(1, false), row(2, true)];
  const data = aggregate(rows, filters);
  expect(data.kpis.activeStudents).toBe(1);
  expect(data.kpis.totalAttempts).toBe(1);
  expect(data.kpis.avgFirst).toBe(6);
  expect(data.students[0].student_id).toBe(normal);
  expect(studentDetail(rows, qa, filters)).toBeNull();
});
it("explicit QA/all scope reaches the saved QA records and survives URL round-tripping", () => {
  const rows = [row(1, false), row(2, true)];
  const qaFilters = parseFilters(
    new URLSearchParams("scope=qa&strand=aviation&minAttempts=1"),
  );
  expect(filterAttempts(rows, qaFilters).map((a) => a.student_id)).toEqual([
    qa,
  ]);
  expect(
    studentDetail(rows, qa, qaFilters)?.questions[0].attempts[0].answer_text,
  ).toBe("SYNTHETIC QA ANSWER");
  expect(parseFilters(new URLSearchParams(filterQuery(qaFilters)))).toEqual(
    qaFilters,
  );
  expect(filterAttempts(rows, { ...filters, scope: "all" })).toHaveLength(2);
  expect(() => parseFilters(new URLSearchParams("scope=admin"))).toThrow();
});
it("exports only the selected scope with explicit QA provenance and saved comparison text", () => {
  const real = row(1, false),
    synthetic = {
      ...row(2, true),
      comparison: {
        improvements: [
          "The task is clear.",
          '=HYPERLINK("https://example.com")',
        ],
        nextStep: "Keep one truthful example.",
        review_version: "test-method",
        created_at: "2026-11-17T10:00:05Z",
      } as NonNullable<Attempt["comparison"]>,
    };
  expect(attemptsCsv([real, synthetic], filters)).not.toContain(
    "SYNTHETIC QA ANSWER",
  );
  const csv = attemptsCsv([real, synthetic], { ...filters, scope: "qa" });
  expect(csv).not.toContain("ACTUAL COHORT ANSWER");
  expect(csv).toContain("session_kind,qa_cohort_id,comparison_change_1");
  expect(csv).toContain(cohort);
  expect(csv).toContain('"Synthetic QA"');
  expect(csv).toContain("The task is clear.");
  expect(csv).toContain("Keep one truthful example.");
  expect(csv).toContain("'=HYPERLINK");
});
it("teacher QA registrations include zero-attempt identities and link to the QA-filtered history", () => {
  const html = renderToStaticMarkup(
    <AdminDashboard
      scope="qa"
      profiles={[
        {
          user_id: qa,
          name: "QA session with no submitted answers yet",
          strand: "aviation",
          ignite_year: 2,
          qa_cohort_id: cohort,
        },
      ]}
    />,
  );
  expect(html).toContain("QA lab");
  expect(html).toContain("QA registrations");
  expect(html).toContain("no submitted answers");
  expect(html).toContain(`/staff/student/${qa}?scope=qa`);
  expect(html).toContain("not evidence of student improvement");
  expect(html).not.toContain("Completed interviews");
  expect(
    profilesCsv([
      {
        name: "Synthetic",
        strand: "aviation",
        ignite_year: 2,
        qa_cohort_id: cohort,
      },
    ]),
  ).toContain("session_kind,qa_cohort_id");
});
it("clearing other filters keeps the teacher in the QA dataset", () => {
  const html = renderToStaticMarkup(
    <AnalyticsFilters
      filters={{ ...filters, scope: "qa", student: "Tester" }}
      action="/staff"
    />,
  );
  expect(html).toContain('href="/staff?scope=qa"');
  expect(html).toContain('value="qa" selected=""');
});

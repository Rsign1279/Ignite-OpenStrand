import { expect, it } from "vitest";
import {
  aggregate,
  studentDetail,
  filterAttempts,
} from "@/lib/analytics/aggregate";
import { parseFilters, type Attempt } from "@/lib/analytics/model";
import { attemptsCsv } from "@/lib/analytics/csv";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const filters = parseFilters(new URLSearchParams());
export const attempt = (
  n: number,
  overrides: Partial<Attempt> = {},
): Attempt => ({
  id: id(n),
  student_id: id(1001),
  student_name: "Student One",
  strand: "technology",
  question_id: "q1",
  question_text: "Tell me about a time you worked on a project.",
  attempt_number: n,
  total_score: 6,
  scores: {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 1,
    professionalCommunication: 2,
  },
  created_at: `2026-10-${String(Math.min(n, 28)).padStart(2, "0")}T12:00:00Z`,
  stage: "pre",
  answer_text: "PRIVATE ANSWER",
  feedback_text: "PRIVATE FEEDBACK",
  is_legacy: false,
  ...overrides,
});
it("returns meaningful zero states with all ten strands and no fabricated averages", () => {
  const a = aggregate([], filters);
  expect(a.kpis).toEqual({
    activeStudents: 0,
    totalAttempts: 0,
    avgFirst: null,
    avgBest: null,
    avgImprovement: null,
  });
  expect(a.strands).toHaveLength(10);
  expect(a.rubric.every((r) => r.score === null)).toBe(true);
});
it("calculates first, best, latest and nonnegative best-minus-first independently", () => {
  const a = aggregate(
    [
      attempt(3, { total_score: 4 }),
      attempt(1, { total_score: 5 }),
      attempt(2, { total_score: 11 }),
    ],
    filters,
  );
  const q = a.students[0].questions[0];
  expect(q).toMatchObject({
    first_score: 5,
    best_score: 11,
    latest_score: 4,
    delta: 6,
    attempts_count: 3,
  });
  expect(a.kpis.avgImprovement).toBe(6);
  expect(JSON.stringify(a)).not.toContain("PRIVATE");
});
it("averages across questions then students rather than weighting frequent students more", () => {
  const rows = [
    attempt(1, { total_score: 2 }),
    attempt(2, { total_score: 12 }),
    attempt(3, { question_id: "q2", total_score: 4 }),
    attempt(4, { student_id: id(1002), student_name: "Two", total_score: 10 }),
  ];
  const a = aggregate(rows, filters);
  expect(a.kpis.avgFirst).toBe(6.5);
  expect(a.kpis.avgBest).toBe(9);
  expect(a.kpis.avgImprovement).toBe(2.5);
});
it("does not combine students sharing a name", () => {
  expect(
    aggregate([attempt(1), attempt(2, { student_id: id(1002) })], filters).kpis
      .activeStudents,
  ).toBe(2);
});
it("applies multi-strand, inclusive end-date, search and minimum-attempt filters together", () => {
  const f = parseFilters(
    new URLSearchParams(
      "strand=technology&strand=education&from=2026-10-01&to=2026-10-02&student=one&minAttempts=2",
    ),
  );
  expect(filterAttempts([attempt(1), attempt(2), attempt(3)], f)).toHaveLength(
    2,
  );
  expect(filterAttempts([attempt(1)], f)).toHaveLength(0);
});
it("rejects malformed filter values and reversed ranges", () => {
  for (const q of [
    "strand=unknown",
    "from=2026-02-30",
    "minAttempts=0",
    "from=2026-10-02&to=2026-10-01",
  ])
    expect(() => parseFilters(new URLSearchParams(q))).toThrow();
});
it("places scores into exact distribution boundaries and caps practice labels at 4+", () => {
  const rows = [0, 3, 4, 6, 7, 9, 10, 12].map((score, i) =>
    attempt(i + 1, { total_score: score }),
  );
  const a = aggregate(rows, filters);
  expect(a.distribution[0]).toMatchObject({
    "0–3": 2,
    "4–6": 2,
    "7–9": 2,
    "10–12": 2,
  });
  expect(a.practice[3].count).toBe(5);
});
it("fills quiet weeks with zero and handles 300 attempts", () => {
  const rows = Array.from({ length: 300 }, (_, i) =>
    attempt(i + 1, {
      student_id: id(2000 + Math.floor(i / 3)),
      attempt_number: (i % 3) + 1,
      created_at: i < 150 ? "2026-10-01T00:00:00Z" : "2026-10-22T00:00:00Z",
    }),
  );
  const a = aggregate(rows, filters);
  expect(a.kpis.activeStudents).toBe(100);
  expect(a.kpis.totalAttempts).toBe(300);
  expect(a.weeks.some((w) => w.attempts === 0)).toBe(true);
});
it("builds mastery and the selected student history only", () => {
  const d = studentDetail(
    [
      attempt(1, { total_score: 6 }),
      attempt(2, { total_score: 12 }),
      attempt(3, { student_id: id(1002) }),
    ],
    id(1001),
    filters,
  )!;
  expect(d.mastery).toEqual({ count: 1, total: 1 });
  expect(d.timeline).toHaveLength(2);
  expect(d.questions[0].attempts.every((a) => a.student_id === id(1001))).toBe(
    true,
  );
  expect(studentDetail([], id(1001), filters)).toBeNull();
});
it("exports per-question derived fields with formula-injection protection and verbatim quoting", () => {
  const csv = attemptsCsv(
    [
      attempt(1, {
        student_name: '=HYPERLINK("bad")',
        answer_text: "  =cmd()\nline two",
      }),
      attempt(2, { total_score: 12 }),
    ],
    filters,
  );
  expect(csv).toContain(
    "first_score,best_score,latest_score,delta,attempts_count",
  );
  expect(csv).toContain("'  =cmd()");
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain('"6","12"');
});

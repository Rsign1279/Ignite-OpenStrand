import { expect, it } from "vitest";
import {
  aggregate,
  studentDetail,
  filterAttempts,
} from "@/lib/analytics/aggregate";
import { parseFilters, type Attempt } from "@/lib/analytics/model";
import { attemptsCsv, csvCell } from "@/lib/analytics/csv";
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
    avgLatestChange: null,
    pairedStudents: 0,
    pairedQuestions: 0,
    studentsWithoutRepeat: 0,
    versionChangedQuestions: 0,
    improvedStudents: 0,
    unchangedStudents: 0,
    declinedStudents: 0,
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
    latest_delta: -1,
    attempts_count: 3,
  });
  expect(a.kpis.avgImprovement).toBe(6);
  expect(a.kpis.avgLatestChange).toBe(-1);
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
  expect(a.kpis.avgLatestChange).toBe(10);
  expect(a.kpis.pairedStudents).toBe(1);
  expect(a.kpis.studentsWithoutRepeat).toBe(1);
});
it("reports higher, unchanged and lower paired results without turning single attempts into zero growth", () => {
  const rows = [
    attempt(1, { total_score: 4 }),
    attempt(2, { total_score: 7 }),
    attempt(3, { student_id: id(1002), total_score: 6 }),
    attempt(4, { student_id: id(1002), total_score: 6 }),
    attempt(5, { student_id: id(1003), total_score: 9 }),
    attempt(6, { student_id: id(1003), total_score: 6 }),
    attempt(7, { student_id: id(1004), total_score: 12 }),
  ];
  const data = aggregate(rows, filters);
  expect(data.kpis).toMatchObject({
    avgLatestChange: 0,
    pairedStudents: 3,
    pairedQuestions: 3,
    studentsWithoutRepeat: 1,
    improvedStudents: 1,
    unchangedStudents: 1,
    declinedStudents: 1,
  });
  expect(data.students.find((s) => s.student_id === id(1004))).toMatchObject({
    repeated_questions: 0,
    avg_latest_change: null,
    paired_first_score: null,
    paired_latest_score: null,
  });
});
it("weights paired growth by question then student and shows matching strand denominators", () => {
  const rows = [
    attempt(1, { total_score: 1 }),
    attempt(2, { total_score: 5 }),
    attempt(3, { question_id: "q2", total_score: 3 }),
    attempt(4, { question_id: "q2", total_score: 5 }),
    attempt(5, { question_id: "q3", total_score: 12 }),
    attempt(6, { student_id: id(1002), total_score: 9 }),
    attempt(7, { student_id: id(1002), total_score: 8 }),
  ];
  const data = aggregate(rows, filters);
  // Student one: (4 + 2) / 2 = 3. Student two: -1. Equal student mean = 1.
  expect(data.kpis.avgLatestChange).toBe(1);
  expect(data.kpis.pairedQuestions).toBe(3);
  expect(data.strands[0]).toMatchObject({
    pairedFirst: 5.5,
    pairedLatest: 6.5,
    latestChange: 1,
    pairedStudents: 2,
    pairedQuestions: 3,
  });
});
it("does not label practice across different questions as a matched repeat", () => {
  const data = aggregate(
    [attempt(1), attempt(2, { question_id: "q2" })],
    filters,
  );
  expect(data.kpis.avgLatestChange).toBeNull();
  expect(data.kpis.pairedStudents).toBe(0);
  expect(data.kpis.unchangedStudents).toBe(0);
  expect(data.students[0].questions.every((q) => q.latest_delta === null)).toBe(
    true,
  );
});
it("excludes different scoring methods from paired estimates and keeps descriptive scores", () => {
  const data = aggregate(
    [
      attempt(1, { total_score: 2 }),
      attempt(2, { total_score: 11, scoring_version: "new-rubric|model-a" }),
    ],
    filters,
  );
  expect(data.students[0].questions[0]).toMatchObject({
    first_score: 2,
    best_score: 11,
    latest_score: 11,
    latest_delta: null,
    comparison_status: "scoring_version_changed",
    first_scoring_version: "legacy-unversioned",
    latest_scoring_version: "new-rubric|model-a",
  });
  expect(data.kpis).toMatchObject({
    avgLatestChange: null,
    pairedStudents: 0,
    pairedQuestions: 0,
    versionChangedQuestions: 1,
    studentsWithoutRepeat: 0,
    improvedStudents: 0,
    unchangedStudents: 0,
    declinedStudents: 0,
  });
  expect(data.students[0]).toMatchObject({
    repeated_questions: 1,
    comparable_questions: 0,
    version_changed_questions: 1,
  });
  expect(data.strands[0]).toMatchObject({
    pairedFirst: null,
    pairedLatest: null,
    pairedStudents: 0,
    pairedQuestions: 0,
  });
});
it("pairs matching method tags and treats missing historical tags as legacy", () => {
  const data = aggregate(
    [
      attempt(1, { total_score: 8 }),
      attempt(2, { total_score: 7, scoring_version: "legacy-unversioned" }),
      attempt(3, {
        question_id: "q2",
        total_score: 2,
        scoring_version: "rubric-a|model-a",
      }),
      attempt(4, {
        question_id: "q2",
        total_score: 5,
        scoring_version: "rubric-a|model-a",
      }),
      attempt(5, {
        question_id: "q3",
        total_score: 2,
        scoring_version: "rubric-a|model-a",
      }),
      attempt(6, {
        question_id: "q3",
        total_score: 12,
        scoring_version: "rubric-a|model-b",
      }),
    ],
    filters,
  );
  expect(data.kpis).toMatchObject({
    avgLatestChange: 1,
    pairedStudents: 1,
    pairedQuestions: 2,
    versionChangedQuestions: 1,
  });
  expect(data.students[0]).toMatchObject({
    repeated_questions: 3,
    comparable_questions: 2,
    version_changed_questions: 1,
    paired_first_score: 5,
    paired_latest_score: 6,
  });
});
it("can establish a new matched baseline within dates after a scoring-method change", () => {
  const data = aggregate(
    [
      attempt(1, { total_score: 1, scoring_version: "old" }),
      attempt(2, { total_score: 6, scoring_version: "new" }),
      attempt(3, { total_score: 7, scoring_version: "new" }),
    ],
    { ...filters, from: "2026-10-02" },
  );
  expect(data.kpis).toMatchObject({
    avgLatestChange: 1,
    pairedQuestions: 1,
    versionChangedQuestions: 0,
  });
});
it("uses the selected date range for repeat eligibility without borrowing an earlier baseline", () => {
  const data = aggregate(
    [attempt(1, { total_score: 1 }), attempt(2, { total_score: 10 })],
    { ...filters, from: "2026-10-02" },
  );
  expect(data.kpis.pairedQuestions).toBe(0);
  expect(data.kpis.avgLatestChange).toBeNull();
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

it("exports negative paired change as a number and leaves missing repeat evidence blank", () => {
  const csv = attemptsCsv(
    [
      attempt(1, { total_score: 8 }),
      attempt(2, { total_score: 5 }),
      attempt(3, { question_id: "q2", total_score: 8 }),
    ],
    filters,
  );
  expect(csv.split("\r\n")[0]).toContain("latest_minus_first,has_repeat");
  expect(csv.split("\r\n")[1]).toContain(
    ',"-3","true","legacy-unversioned","paired"',
  );
  expect(csv.split("\r\n")[3]).toContain(
    ',"","false","legacy-unversioned","single_attempt"',
  );
  expect(csvCell("-3+cmd()")).toBe('"\'-3+cmd()"');
});

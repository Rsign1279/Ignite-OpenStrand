import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  from: vi.fn(),
  comparisonSelect: vi.fn(),
  ids: vi.fn(),
  comparisonEq: vi.fn(),
  rows: [] as Record<string, unknown>[],
  comparisons: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({ from: mocks.from }),
}));
import { loadAttempts } from "@/lib/analytics/data";
const student = "11111111-1111-4111-8111-111111111111",
  cohort = "44444444-4444-4444-8444-444444444444";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const attempt = (n: number, stage = "post") => ({
  id: id(n),
  student_id: student,
  question_id: "aviation-teamwork-v1",
  question_text: "Tell me about a team project.",
  stage,
  attempt_number: n,
  total_score: 8,
  situation: 2,
  task: 2,
  action: 2,
  result: 2,
  situation_task: null,
  personal_actions: null,
  result_impact: null,
  communication: null,
  created_at: "2026-11-17T10:00:00Z",
  is_legacy: false,
  answer_text: "PRIVATE ANSWER",
  feedback_text: "PRIVATE FEEDBACK",
  scoring_version: "test-method",
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.rows = [attempt(1, "pre"), attempt(2)];
  mocks.comparisons = [
    {
      post_attempt_id: id(2),
      comparison_json: {
        improvements: [
          "The task is clearer.",
          "The result is connected to the action.",
        ],
        nextStep: "Explain one decision.",
      },
      review_version: "test-method",
      created_at: "2026-11-17T10:00:05Z",
    },
  ];
  const profileQuery = {
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi
      .fn()
      .mockResolvedValue({
        data: [
          {
            user_id: student,
            name: "Synthetic tester",
            strand: "aviation",
            qa_cohort_id: cohort,
          },
        ],
        error: null,
      }),
  };
  const attempts = {
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi
      .fn()
      .mockImplementation(() => ({
        returns: async () => ({ data: mocks.rows, error: null }),
      })),
  };
  mocks.ids.mockImplementation(() => {
    const result = Object.assign(
      Promise.resolve({ data: mocks.comparisons, error: null }),
      { eq: mocks.comparisonEq },
    );
    mocks.comparisonEq.mockReturnValue(result);
    return result;
  });
  mocks.comparisonSelect.mockReturnValue({ in: mocks.ids });
  mocks.from.mockImplementation((table: string) => ({
    select:
      table === "student_profiles"
        ? () => profileQuery
        : table === "interview_attempts"
          ? () => attempts
          : mocks.comparisonSelect,
  }));
});
it("loads saved comparisons only for authorized post IDs and the requested identity", async () => {
  const rows = await loadAttempts(student, true);
  expect(rows[0].comparison).toBeUndefined();
  expect(rows[1].comparison).toMatchObject({
    nextStep: "Explain one decision.",
    review_version: "test-method",
  });
  expect(rows[1].qa_cohort_id).toBe(cohort);
  expect(mocks.ids).toHaveBeenCalledWith("post_attempt_id", [id(2)]);
  expect(mocks.comparisonEq).toHaveBeenCalledWith("student_id", student);
  expect(mocks.admin.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.from.mock.invocationCallOrder[0],
  );
});
it("does not query comparison text for overview loads", async () => {
  const rows = await loadAttempts();
  expect(mocks.comparisonSelect).not.toHaveBeenCalled();
  expect(rows.every((row) => !row.comparison)).toBe(true);
});
it("ignores an unexpected comparison for a PRE attempt rather than attaching it", async () => {
  mocks.comparisons.push({ ...mocks.comparisons[0], post_attempt_id: id(1) });
  const rows = await loadAttempts(student, true);
  expect(rows[0].comparison).toBeUndefined();
});
it("batches post IDs so large teacher histories do not exceed request URL limits", async () => {
  mocks.rows = Array.from({ length: 201 }, (_, index) => attempt(index + 1));
  await loadAttempts(undefined, true);
  expect(mocks.ids.mock.calls.map((call) => call[1].length)).toEqual([
    100, 100, 1,
  ]);
});
it("rejects invalid saved comparison JSON instead of displaying fabricated evidence", async () => {
  mocks.comparisons[0].comparison_json = {
    improvements: ["Only one item"],
    nextStep: "Specific",
  };
  await expect(loadAttempts(student, true)).rejects.toThrow();
});

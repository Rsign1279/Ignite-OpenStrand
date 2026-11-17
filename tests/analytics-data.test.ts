import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  from: vi.fn(),
  profileSelect: vi.fn(),
  attemptSelect: vi.fn(),
  rows: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({ from: mocks.from }),
}));
import { loadAttempts } from "@/lib/analytics/data";

const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({});
  mocks.rows = [
    {
      id,
      student_id: id,
      question_id: "technology-teamwork-v1",
      question_text: "Tell me about teamwork.",
      stage: "pre",
      attempt_number: 1,
      total_score: 8,
      situation: null,
      task: null,
      action: null,
      result: null,
      situation_task: 2,
      personal_actions: 2,
      result_impact: 2,
      communication: 2,
      created_at: "2026-11-16T10:00:00Z",
      is_legacy: false,
      scoring_version: "rubric-a|model-a",
    },
  ];
  const profileQuery = {
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: [{ user_id: id, name: "Student", strand: "technology" }],
      error: null,
    }),
  };
  const attemptQuery = {
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => ({
      returns: async () => ({ data: mocks.rows, error: null }),
    })),
  };
  mocks.profileSelect.mockReturnValue(profileQuery);
  mocks.attemptSelect.mockReturnValue(attemptQuery);
  mocks.from.mockImplementation((table) => ({
    select:
      table === "student_profiles" ? mocks.profileSelect : mocks.attemptSelect,
  }));
});

it("loads only the JSON scoring-version alias alongside overview columns", async () => {
  const rows = await loadAttempts();
  const selection = mocks.attemptSelect.mock.calls[0][0] as string;
  expect(selection).toContain(
    "scoring_version:evaluation_json->>scoring_version",
  );
  expect(selection).not.toContain("*");
  expect(selection).not.toContain("answer_text");
  expect(selection).not.toContain("feedback_text");
  expect(selection.split(",")).not.toContain("evaluation_json");
  expect(rows[0].scoring_version).toBe("rubric-a|model-a");
  expect(rows[0]).not.toHaveProperty("evaluation_json");
  expect(mocks.admin.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.from.mock.invocationCallOrder[0],
  );
});

it("normalizes missing historical version metadata without fetching its full evaluation", async () => {
  mocks.rows[0].scoring_version = null;
  expect((await loadAttempts())[0].scoring_version).toBe("legacy-unversioned");
});

it("loads distinct STAR values without filling historical columns", async () => {
  Object.assign(mocks.rows[0], {
    situation: 3,
    task: 0,
    action: 1,
    result: 2,
    situation_task: null,
    personal_actions: null,
    result_impact: null,
    communication: null,
    total_score: 6,
  });
  expect((await loadAttempts())[0].scores).toEqual({
    situation: 3,
    task: 0,
    action: 1,
    result: 2,
  });
});

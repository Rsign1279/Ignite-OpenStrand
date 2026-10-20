import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import {
  saveAssessment,
  saveTransfer,
  recordAttempt,
  validatePreQuestion,
} from "@/lib/learning";
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { eq: mocks.eq, maybeSingle: mocks.single };
  mocks.eq.mockReturnValue(chain);
  mocks.select.mockReturnValue(chain);
  mocks.from.mockReturnValue({ upsert: mocks.upsert, select: mocks.select });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});
it("stores rubric values only, omitting free-text feedback", async () => {
  const scores = {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 3,
    professionalCommunication: 2,
  };
  await saveAssessment("student", "post", {
    scores,
    total: 8,
    strongestPart: "PRIVATE",
    improvementArea: "PRIVATE",
  });
  expect(mocks.from).toHaveBeenCalledWith("learning_results");
  expect(mocks.upsert).toHaveBeenCalledWith({
    user_id: "student",
    post_scores: scores,
    updated_at: expect.any(String),
  });
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain("PRIVATE");
});
it("stores transfer indicators and completion without the observation", async () => {
  await saveTransfer("student", {
    situation: true,
    task: false,
    action: true,
    result: false,
    observation: "PRIVATE",
  });
  expect(mocks.upsert).toHaveBeenCalledWith({
    user_id: "student",
    transfer_star: {
      situation: true,
      task: false,
      action: true,
      result: false,
    },
    updated_at: expect.any(String),
    completed_at: expect.any(String),
  });
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain("PRIVATE");
});
it("fails safely if storage is unavailable", async () => {
  mocks.upsert.mockResolvedValue({ error: { message: "PRIVATE DB ERROR" } });
  await expect(
    saveTransfer("student", {
      situation: true,
      task: true,
      action: true,
      result: true,
      observation: "PRIVATE",
    }),
  ).rejects.toThrow("could not be saved");
});

it("persists canonical selected question metadata instead of the legacy default", async () => {
  const evaluation = {
    scores: {
      situationTask: 1,
      personalActions: 2,
      resultImpact: 2,
      professionalCommunication: 3,
    },
    total: 8,
    strongestPart: "Specific",
    improvementArea: "Outcome",
  };
  await recordAttempt(
    "student",
    "technology",
    "pre",
    evaluation,
    "Answer",
    "11111111-1111-4111-8111-111111111111",
    "technology-teamwork-v1",
  );
  expect(mocks.rpc).toHaveBeenCalledWith(
    "record_interview_attempt",
    expect.objectContaining({
      p_question_id: "technology-teamwork-v1",
      p_question_text: expect.stringContaining("worked with a team"),
    }),
  );
});
it("requires the saved pre answer and question to match before scoring post", async () => {
  mocks.single.mockResolvedValue({
    error: null,
    data: {
      question_id: "technology-teamwork-v1",
      stage: "pre",
      answer_text: "Pre answer",
    },
  });
  await expect(
    validatePreQuestion(
      "student",
      "request",
      "technology-teamwork-v1",
      "Pre answer",
    ),
  ).resolves.toBeUndefined();
  expect(mocks.eq).toHaveBeenCalledWith("student_id", "student");
  await expect(
    validatePreQuestion(
      "student",
      "request",
      "technology-feedback-v1",
      "Pre answer",
    ),
  ).rejects.toThrow("same practice question");
  await expect(
    validatePreQuestion(
      "student",
      undefined,
      "technology-teamwork-v1",
      "Pre answer",
    ),
  ).rejects.toThrow("Complete the pre-assessment");
});

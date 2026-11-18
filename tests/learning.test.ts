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
  findRecordedAssessment,
  findRecordedAssessmentWithMetadata,
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

it.each([
  ["practice", "technology-teamwork-v1", "Pre answer"],
  ["pre", "technology-feedback-v1", "Pre answer"],
  ["pre", "technology-teamwork-v1", "Changed answer"],
] as const)(
  "rejects reuse of a saved request for different stage, question or answer (%s)",
  async (stage, question, answer) => {
    mocks.single.mockResolvedValue({
      error: null,
      data: {
        stage: "pre",
        question_id: "technology-teamwork-v1",
        answer_text: "Pre answer",
        evaluation_json: {
          scores: {
            situation: 2,
            action: 2,
            result: 2,
            task: 2,
          },
          total: 8,
          strongestPart: "Specific",
          improvementArea: "Outcome",
        },
      },
    });
    await expect(
      findRecordedAssessment("student", "request", answer, question, stage),
    ).rejects.toThrow("This answer changed");
    expect(mocks.eq).toHaveBeenCalledWith("student_id", "student");
  },
);

it("recomputes totals when returning a matching saved evaluation", async () => {
  mocks.single.mockResolvedValue({
    error: null,
    data: {
      stage: "pre",
      question_id: "technology-teamwork-v1",
      answer_text: "Pre answer",
      evaluation_json: {
        scores: {
          situation: 2,
          action: 2,
          result: 2,
          task: 2,
        },
        total: 12,
        strongestPart: "Specific",
        improvementArea: "Outcome",
      },
    },
  });
  const result = await findRecordedAssessment(
    "student",
    "request",
    "Pre answer",
    "technology-teamwork-v1",
    "pre",
  );
  expect(result?.total).toBe(8);
});
it("stores rubric values only, omitting free-text feedback", async () => {
  const scores = {
    situation: 1,
    action: 2,
    result: 3,
    task: 2,
  };
  await saveAssessment("student", "post", {
    scores,
    total: 8,
    strongestPart: "PRIVATE",
    improvementArea: "PRIVATE",
  });
  expect(mocks.rpc).toHaveBeenCalledWith("refresh_interview_summary", {
    p_student_id: "student",
  });
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("PRIVATE");
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
      situation: 1,
      action: 2,
      result: 2,
      task: 3,
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
      p_evaluation: expect.objectContaining({
        scoring_version: expect.stringMatching(/^ignite-star-rubric-v3\|groq:/),
      }),
    }),
  );
});
it("reads stored scoring metadata internally while preserving the public evaluation schema", async () => {
  mocks.single.mockResolvedValue({
    error: null,
    data: {
      stage: "pre",
      question_id: "technology-teamwork-v1",
      answer_text: "Answer",
      evaluation_json: {
        scores: {
          situation: 2,
          action: 2,
          result: 2,
          task: 2,
        },
        total: 12,
        strongestPart: "Specific",
        improvementArea: "Outcome",
        scoring_version: "original-method",
      },
    },
  });
  const stored = await findRecordedAssessmentWithMetadata(
    "student",
    "request",
    "Answer",
    "technology-teamwork-v1",
    "pre",
  );
  expect(stored).toMatchObject({
    scoringVersion: "original-method",
    evaluation: { total: 8 },
  });
  expect(stored?.evaluation).not.toHaveProperty("scoring_version");
  await recordAttempt(
    "student",
    "technology",
    "pre",
    stored!.evaluation,
    "Answer",
    "request",
    "technology-teamwork-v1",
    stored!.scoringVersion,
  );
  expect(mocks.rpc.mock.calls[0][1].p_evaluation.scoring_version).toBe(
    "original-method",
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
  ).resolves.toBe("legacy-unversioned");
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

it("preserves a historical request without returning its communication score as Task", async () => {
  mocks.single.mockResolvedValue({
    error: null,
    data: {
      stage: "pre",
      question_id: "technology-teamwork-v1",
      answer_text: "Original answer",
      evaluation_json: {
        scores: {
          situationTask: 2,
          personalActions: 1,
          resultImpact: 3,
          professionalCommunication: 0,
        },
        total: 6,
        strongestPart: "Specific",
        improvementArea: "Outcome",
        scoring_version: "ignite-rubric-anchors-v1",
      },
    },
  });
  await expect(
    findRecordedAssessmentWithMetadata(
      "student",
      "request",
      "Original answer",
      "technology-teamwork-v1",
      "pre",
    ),
  ).rejects.toThrow("original result is still saved");
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
});

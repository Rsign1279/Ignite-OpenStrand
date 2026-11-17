import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  save: vi.fn(),
  record: vi.fn(),
  find: vi.fn(),
  validatePre: vi.fn(),
  findComparison: vi.fn(),
  saveComparison: vi.fn(),
  lock: vi.fn(),
  logicalLimit: vi.fn(),
  structured: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireStudent: mock.auth }));
vi.mock("@/lib/learning", () => ({
  saveAssessment: mock.save,
  recordAttempt: mock.record,
  findRecordedAssessmentWithMetadata: mock.find,
  validatePreQuestion: mock.validatePre,
}));
vi.mock("@/lib/assessment-comparisons", () => ({
  findRecordedComparison: mock.findComparison,
  saveRecordedComparison: mock.saveComparison,
}));
vi.mock("@/lib/request-admission", () => ({
  withAssessmentLock: mock.lock,
  limitLogicalSubmission: mock.logicalLimit,
}));
vi.mock("@/lib/ai/provider", () => ({
  ai: { structured: mock.structured },
}));

import { POST } from "@/app/api/interview/evaluate/route";
import { RUBRIC_SCORING_VERSION } from "@/config/rubric-anchors";
import { getScoringVersion } from "@/lib/ai/scoring-config";
import { HttpError } from "@/lib/http";
import type { Comparison, Evaluation } from "@/lib/validation";

const userId = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const preId = "33333333-3333-4333-8333-333333333333";
const answer = {
  rubricVersion: RUBRIC_SCORING_VERSION,
  questionId: "construction-teamwork-v1",
  stage: "post",
  requestId: postId,
  preRequestId: preId,
  transcript: "I checked the model measurements and recorded the corrections.",
  preTranscript: "We made a model together and fixed it.",
};
const evaluation: Evaluation = {
  scores: { situation: 2, task: 2, action: 3, result: 2 },
  total: 9,
  strongestPart: "You describe your own measurement checks.",
  improvementArea: "Explain what changed after the corrections.",
};
const comparison: Comparison = {
  improvements: [
    "Your own responsibility is clearer.",
    "You name the measurement checks you performed.",
  ],
  nextStep: evaluation.improvementArea,
};
const saved = {
  evaluation,
  scoringVersion: getScoringVersion(),
};

function request(body: unknown = answer, signal?: AbortSignal) {
  return new Request("http://localhost/api/interview/evaluate", {
    method: "POST",
    headers: {
      Origin: "http://localhost",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({
    user: { id: userId },
    profile: {
      name: "[QA Pilot] Pipeline review",
      strand: "construction",
      ignite_year: 2,
    },
  });
  mock.save.mockResolvedValue(undefined);
  mock.record.mockResolvedValue(undefined);
  mock.validatePre.mockResolvedValue(getScoringVersion());
  mock.find.mockResolvedValue(null);
  mock.findComparison.mockResolvedValue(null);
  mock.saveComparison.mockResolvedValue(comparison);
  mock.logicalLimit.mockResolvedValue(undefined);
  mock.lock.mockImplementation(
    async (
      _userId: string,
      _requestId: string,
      operation: () => Promise<unknown>,
    ) => operation(),
  );
  mock.structured.mockImplementation(async (name: string) =>
    name === "comparison" ? comparison : evaluation,
  );
});

describe("independent pilot evaluation recovery review", () => {
  it("returns an immutable completed comparison without provider work or submission quota", async () => {
    mock.find.mockResolvedValue(saved);
    mock.findComparison.mockResolvedValue(comparison);

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      evaluation,
      comparison,
      requestId: postId,
      scoringVersion: saved.scoringVersion,
      comparisonComparable: true,
    });
    expect(mock.validatePre).toHaveBeenCalledWith(
      userId,
      preId,
      answer.questionId,
      answer.preTranscript,
    );
    expect(mock.findComparison).toHaveBeenCalledWith(userId, postId, preId);
    expect(mock.lock).not.toHaveBeenCalled();
    expect(mock.logicalLimit).not.toHaveBeenCalled();
    expect(mock.structured).not.toHaveBeenCalled();
    expect(mock.record).not.toHaveBeenCalled();
    expect(mock.saveComparison).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("checks the saved baseline before returning even a completed cached comparison", async () => {
    mock.find.mockResolvedValue(saved);
    mock.findComparison.mockResolvedValue(comparison);
    mock.validatePre.mockRejectedValue(new HttpError(409, "Baseline conflict"));

    expect((await POST(request())).status).toBe(409);
    expect(mock.find).not.toHaveBeenCalled();
    expect(mock.findComparison).not.toHaveBeenCalled();
    expect(mock.structured).not.toHaveBeenCalled();
  });

  it("resumes only a missing comparison after the score has already been saved", async () => {
    mock.find.mockResolvedValue(saved);

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mock.structured).toHaveBeenCalledTimes(1);
    expect(mock.structured.mock.calls[0][0]).toBe("comparison");
    expect(mock.record).not.toHaveBeenCalled();
    expect(mock.lock).toHaveBeenCalledWith(
      userId,
      postId,
      expect.any(Function),
    );
    expect(mock.logicalLimit).toHaveBeenCalledWith(
      userId,
      "assessment",
      postId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(mock.saveComparison).toHaveBeenCalledWith(
      userId,
      postId,
      preId,
      comparison,
    );
  });

  it("keeps the score after comparison capacity fails and does not grade it again on retry", async () => {
    mock.find
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(saved);
    mock.structured
      .mockResolvedValueOnce(evaluation)
      .mockRejectedValueOnce(new HttpError(429, "Provider quota reached", 120));

    const first = await POST(request());
    expect(first.status).toBe(429);
    expect(first.headers.get("Retry-After")).toBe("120");
    expect(mock.record).toHaveBeenCalledTimes(1);
    expect(mock.record.mock.calls[0][8]).toBe(preId);
    expect(mock.save).toHaveBeenCalledWith(userId, "post", evaluation);

    const second = await POST(request());
    expect(second.status).toBe(200);
    expect(mock.record).toHaveBeenCalledTimes(1);
    expect(mock.structured.mock.calls.map((call) => call[0])).toEqual([
      "assessment",
      "comparison",
      "comparison",
    ]);
    expect((await second.json()).evaluation).toEqual(evaluation);
  });

  it("uses the committed comparison returned by storage, not a losing model response", async () => {
    mock.find.mockResolvedValue(saved);
    const firstCommitted = {
      ...comparison,
      improvements: [
        "The original saved first insight.",
        "The original saved second insight.",
      ],
    };
    mock.saveComparison.mockResolvedValue(firstCommitted);
    mock.structured.mockResolvedValue({
      ...comparison,
      nextStep: "An unrelated model suggestion.",
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).comparison).toEqual(firstCommitted);
    expect(mock.saveComparison.mock.calls[0][3].nextStep).toBe(
      evaluation.improvementArea,
    );
  });

  it("does not pretend success when a completed comparison's summary repair fails", async () => {
    mock.find.mockResolvedValue(saved);
    mock.findComparison.mockResolvedValue(comparison);
    mock.save.mockRejectedValue(new HttpError(503, "Unable to save summary"));

    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mock.structured).not.toHaveBeenCalled();
  });

  it("rechecks storage after taking the lock, so a completed competitor is not rebilled", async () => {
    mock.find.mockResolvedValueOnce(null).mockResolvedValue(saved);
    mock.findComparison.mockResolvedValue(comparison);

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mock.lock).toHaveBeenCalledTimes(1);
    expect(mock.logicalLimit).not.toHaveBeenCalled();
    expect(mock.structured).not.toHaveBeenCalled();
  });

  it("does not start provider work if canceled after admission", async () => {
    const controller = new AbortController();
    mock.logicalLimit.mockImplementation(async () => controller.abort());

    expect((await POST(request(answer, controller.signal))).status).toBe(499);
    expect(mock.structured).not.toHaveBeenCalled();
    expect(mock.record).not.toHaveBeenCalled();
    expect(mock.saveComparison).not.toHaveBeenCalled();
  });

  it("preserves a finished score when cancellation arrives just after provider completion", async () => {
    const controller = new AbortController();
    mock.find
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(saved);
    mock.structured.mockImplementation(async (name: string) => {
      if (name === "assessment") {
        controller.abort();
        return evaluation;
      }
      throw new HttpError(499, "Canceled");
    });

    expect((await POST(request(answer, controller.signal))).status).toBe(499);
    expect(mock.record).toHaveBeenCalledTimes(1);
    expect(mock.save).toHaveBeenCalledWith(userId, "post", evaluation);
    expect(mock.saveComparison).not.toHaveBeenCalled();
    expect(mock.structured.mock.calls[1][4].aborted).toBe(true);
  });

  it("does not generate a comparison when durable score storage fails", async () => {
    mock.record.mockRejectedValue(new HttpError(503, "Storage unavailable"));

    expect((await POST(request())).status).toBe(503);
    expect(mock.structured).toHaveBeenCalledTimes(1);
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.saveComparison).not.toHaveBeenCalled();
  });

  it("rejects an attempt-ID content conflict before admission or provider work", async () => {
    mock.find.mockRejectedValue(new HttpError(409, "This answer changed"));

    expect((await POST(request())).status).toBe(409);
    expect(mock.lock).not.toHaveBeenCalled();
    expect(mock.structured).not.toHaveBeenCalled();
  });

  it("marks scores from a different review method non-comparable without altering their values", async () => {
    mock.validatePre.mockResolvedValue("older-scoring-method");
    mock.find.mockResolvedValue(saved);
    mock.findComparison.mockResolvedValue(comparison);

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      evaluation,
      comparisonComparable: false,
    });
  });
});

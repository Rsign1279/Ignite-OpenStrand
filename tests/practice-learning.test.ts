import { describe, expect, it } from "vitest";
import { getStrand, strands } from "@/config/strands";
import { getQuestionTopic } from "@/config/interview-scenes";
import {
  getPracticeFocus,
  createRevisionGoal,
  recommendPracticeQuestion,
  summarizeQuestionGrowth,
  interviewFollowUps,
  type PracticeAttempt,
} from "@/lib/practice-learning";
import type { Evaluation } from "@/lib/validation";

const score = (values: [number, number, number, number]): Evaluation => ({
  scores: {
    situationTask: values[0],
    personalActions: values[1],
    resultImpact: values[2],
    professionalCommunication: values[3],
  },
  total: 12,
  strongestPart: "A specific action.",
  improvementArea: "State the outcome.",
});

describe("A focused practice goal", () => {
  it("uses actual category scores, ignoring an inconsistent total", () => {
    const focus = getPracticeFocus(score([2, 3, 0, 2]));
    expect(focus.key).toBe("resultImpact");
    expect(focus.score).toBe(0);
    expect(focus.complete).toBe(false);
    expect(focus.action).toContain("A number is optional");
  });
  it("resolves tied gaps consistently, starting with context before actions", () => {
    expect(getPracticeFocus(score([1, 1, 2, 3])).key).toBe("situationTask");
    expect(getPracticeFocus(score([2, 1, 1, 3])).key).toBe("personalActions");
  });
  it("offers transfer instead of an invented weakness after a complete answer", () => {
    const focus = getPracticeFocus(score([3, 3, 3, 3]));
    expect(focus.complete).toBe(true);
    expect(focus.title).toBe("Carry the skill into a new story");
    expect(focus.action).toContain("different question");
  });
  it("snapshots the response-specific next action with its question and stable criterion", () => {
    const evaluation = {
      ...score([2, 3, 1, 2]),
      improvementArea:
        "  Explain what the teacher said about your revised instructions.  ",
    };
    const goal = createRevisionGoal("education-feedback-v1", evaluation);
    evaluation.improvementArea = "Another answer's feedback";
    expect(goal).toMatchObject({
      questionId: "education-feedback-v1",
      criterion: "resultImpact",
      action: "Explain what the teacher said about your revised instructions.",
      complete: false,
    });
    expect(goal).not.toHaveProperty("scores");
    expect(goal).not.toHaveProperty("transcript");
  });
  it("never carries an invented deficit when every rubric category is complete", () => {
    const goal = createRevisionGoal("q1", {
      ...score([3, 3, 3, 3]),
      improvementArea: "Invent a bigger success.",
    });
    expect(goal.complete).toBe(true);
    expect(goal.action).toContain("different question");
    expect(goal.action).not.toContain("Invent");
  });
});

describe("Question recommendations", () => {
  it("targets a weakness with a different canonical question in every strand", () => {
    for (const strand of strands) {
      const current = strand.questions[0];
      const result = recommendPracticeQuestion(
        strand.questions,
        current.id,
        score([3, 3, 1, 3]),
      );
      expect(result?.question).toEqual(strand.questions[9]);
      expect(result?.question.id).not.toBe(current.id);
      expect(result?.reason).toContain("result / impact");
      expect(result?.fresh).toBe(true);
    }
  });
  it("prioritizes unseen topics while preserving a deterministic fallback", () => {
    const questions = getStrand("technology").questions;
    const attempts: PracticeAttempt[] = [
      { questionId: questions[9].id, scores: score([3, 3, 1, 3]).scores },
      { questionId: questions[2].id, scores: score([3, 3, 1, 3]).scores },
    ];
    const result = recommendPracticeQuestion(
      questions,
      questions[0].id,
      score([3, 3, 1, 3]),
      attempts,
    );
    expect(result?.question.id).toBe(questions[5].id);
    const all = questions.map((q) => ({
      questionId: q.id,
      scores: score([2, 2, 2, 2]).scores,
    }));
    const repeat = recommendPracticeQuestion(
      questions,
      questions[0].id,
      score([3, 3, 1, 3]),
      all,
    );
    expect(repeat?.question.id).toBe(questions[9].id);
    expect(repeat?.fresh).toBe(false);
    expect(repeat?.reason).not.toContain("not reviewed");
  });
  it("returns no question when there is no distinct candidate", () => {
    const question = getStrand("education").questions[8];
    expect(
      recommendPracticeQuestion([question], question.id, score([1, 1, 1, 1])),
    ).toBeUndefined();
    expect(
      recommendPracticeQuestion([], question.id, score([1, 1, 1, 1])),
    ).toBeUndefined();
  });
  it("provides optional follow-up rehearsal for every canonical bank entry", () => {
    for (const strand of strands) {
      for (const question of strand.questions) {
        expect(interviewFollowUps[getQuestionTopic(question)]).toMatch(/\?$/);
      }
    }
  });
});

describe("Honest same-question growth", () => {
  const attempt = (
    questionId: string,
    points: [number, number, number, number],
  ): PracticeAttempt => ({ questionId, scores: score(points).scores });
  it("never compares different questions or reports change from one attempt", () => {
    expect(
      summarizeQuestionGrowth(
        [attempt("q1", [1, 1, 1, 1]), attempt("q2", [3, 3, 3, 3])],
        "q1",
      ),
    ).toBeUndefined();
    expect(summarizeQuestionGrowth([], "q1")).toBeUndefined();
  });
  it("uses first and latest, including regression from an intervening high score", () => {
    const result = summarizeQuestionGrowth(
      [
        attempt("q1", [2, 2, 2, 2]),
        attempt("q2", [0, 0, 0, 0]),
        attempt("q1", [3, 3, 3, 3]),
        attempt("q1", [1, 1, 2, 2]),
      ],
      "q1",
    );
    expect(result).toMatchObject({
      before: 8,
      after: 6,
      change: -2,
      direction: "down",
      attempts: 3,
    });
    expect(result?.title).toContain("regroup");
    expect(result?.explanation).toContain("lower");
  });
  it("shows category movement even when total stays flat", () => {
    const result = summarizeQuestionGrowth(
      [attempt("q1", [1, 3, 1, 3]), attempt("q1", [2, 2, 2, 2])],
      "q1",
    );
    expect(result).toMatchObject({
      before: 8,
      after: 8,
      change: 0,
      direction: "steady",
    });
    expect(result?.categories.map((c) => c.change)).toEqual([1, -1, 1, -1]);
    expect(result?.explanation).toContain("individual skills change");
  });
  it("identifies improved responses without calling the student job-ready", () => {
    const result = summarizeQuestionGrowth(
      [attempt("q1", [1, 1, 1, 1]), attempt("q1", [3, 2, 2, 3])],
      "q1",
    );
    expect(result).toMatchObject({
      before: 4,
      after: 10,
      change: 6,
      direction: "up",
    });
    expect(result?.explanation).toContain("this question");
    expect(result?.explanation).not.toMatch(/mastered|job.ready|guaranteed/i);
  });
  it("uses only the latest scoring method and waits for two comparable responses", () => {
    const first = {
      ...attempt("q1", [0, 0, 0, 0]),
      scoringVersion: "previous",
    };
    const next = { ...attempt("q1", [2, 2, 2, 2]), scoringVersion: "current" };
    expect(summarizeQuestionGrowth([first, next], "q1")).toBeUndefined();
    expect(
      summarizeQuestionGrowth(
        [
          first,
          next,
          { ...attempt("q1", [2, 3, 2, 2]), scoringVersion: "current" },
        ],
        "q1",
      ),
    ).toMatchObject({
      before: 8,
      after: 9,
      change: 1,
      attempts: 2,
      excludedAttempts: 1,
    });
  });
});

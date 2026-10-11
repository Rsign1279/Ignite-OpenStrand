import { describe, it, expect } from "vitest";
import { strands, getStrand, rubric } from "@/config/strands";
import {
  profileSchema,
  evaluationSchema,
  parseEvaluation,
  totalScore,
  scoreChange,
  transferSchema,
  answerSchema,
} from "@/lib/validation";
import { transition } from "@/lib/machine";
import { isAdmin } from "@/lib/auth";
import { profilesCsv } from "@/lib/csv";
import {
  buildPreAssessmentPrompt,
  buildPostAssessmentPrompt,
} from "@/lib/ai/prompts";
const value = {
  scores: {
    situationTask: 2,
    personalActions: 3,
    resultImpact: 1,
    professionalCommunication: 2,
  },
  total: 8,
  strongestPart: "Specific personal actions.",
  improvementArea: "Explain the outcome.",
};
describe("Rubric and validation", () => {
  it("recomputes an incorrect model total", () =>
    expect(parseEvaluation({ ...value, total: 12 }).total).toBe(8));
  it("calculates totals and negative score changes", () => {
    expect(totalScore(value.scores)).toBe(8);
    expect(
      scoreChange(value, {
        ...value,
        scores: { ...value.scores, resultImpact: 0 },
      }),
    ).toBe(-1);
  });
  it.each([-1, 4, 1.5])("rejects invalid rubric point %s", (point) =>
    expect(
      evaluationSchema.safeParse({
        ...value,
        scores: { ...value.scores, personalActions: point },
      }).success,
    ).toBe(false),
  );
  it("rejects malformed output and extra fields", () => {
    expect(() => parseEvaluation({ scores: {} })).toThrow();
    expect(
      evaluationSchema.safeParse({ ...value, rewrite: "bad" }).success,
    ).toBe(false);
  });
  it("accepts only permitted profile fields", () => {
    const profile = { name: "Student", strand: "education", ignite_year: 1 };
    expect(profileSchema.parse(profile)).toEqual(profile);
    expect(
      profileSchema.safeParse({ ...profile, email: "x@example.com" }).success,
    ).toBe(false);
  });
  it.each([0, 3, 11, 12, "1"])("rejects incorrect year %s", (year) =>
    expect(
      profileSchema.safeParse({
        name: "Student",
        strand: "education",
        ignite_year: year,
      }).success,
    ).toBe(false),
  );
  it.each([1, 2])("accepts participation year %s", (year) =>
    expect(
      profileSchema.safeParse({
        name: "Student",
        strand: "education",
        ignite_year: year,
      }).success,
    ).toBe(true),
  );
  it("rejects invalid names, strands and answer sizes", () => {
    expect(
      profileSchema.safeParse({ name: "", strand: "bad", ignite_year: 1 })
        .success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({ transcript: "x".repeat(16001), stage: "pre" })
        .success,
    ).toBe(false);
    expect(
      answerSchema.safeParse({
        transcript: "An actual response",
        stage: "post",
      }).success,
    ).toBe(false);
  });
  it("transfer does not accept a score", () =>
    expect(
      transferSchema.safeParse({
        situation: true,
        task: true,
        action: true,
        result: true,
        observation: "All present",
        total: 12,
      }).success,
    ).toBe(false));
});
describe("Configuration and deterministic navigation", () => {
  it("has all 10 unique strands and four categories", () => {
    expect(strands).toHaveLength(10);
    expect(new Set(strands.map((s) => s.id)).size).toBe(10);
    expect(rubric).toHaveLength(4);
    strands.forEach((s) => {
      expect(s.primaryQuestion.length).toBeGreaterThan(20);
      expect(s.transferPrompt).toContain("high-school");
    });
  });
  it("preserves the exact Education question", () =>
    expect(getStrand("education").primaryQuestion).toBe(
      "Tell me about a time when a lesson, activity, project, or plan did not go as expected. What did you do?",
    ));
  it("pre/post prompts use identical rubric and question", () => {
    for (const prompt of [
      buildPreAssessmentPrompt("education"),
      buildPostAssessmentPrompt("education"),
    ]) {
      expect(prompt).toContain(getStrand("education").primaryQuestion);
      rubric.forEach((r) => expect(prompt).toContain(r.definition));
      expect(prompt).toContain("untrusted DATA");
    }
  });
  it("rejects stage skipping", () => {
    expect(() => transition("PRE_QUESTION", "COMPLETE")).toThrow();
    expect(transition("PRE_PROCESSING", "PRE_QUESTION")).toBe("PRE_QUESTION");
  });
  it("disallows anonymous and non-allowlisted admins", () => {
    expect(
      isAdmin(
        { email: "advisor@example.com", is_anonymous: false },
        "advisor@example.com",
      ),
    ).toBe(true);
    expect(
      isAdmin(
        { email: "advisor@example.com", is_anonymous: true },
        "advisor@example.com",
      ),
    ).toBe(false);
    expect(isAdmin({ email: "other@example.com" }, "advisor@example.com")).toBe(
      false,
    );
  });
  it("CSV permits only profiles and neutralizes formula injection", () => {
    const csv = profilesCsv([
      { name: "=SUM(1)", strand: "education", ignite_year: 1 },
    ]);
    expect(csv).toContain("'=SUM(1)");
    expect(csv).toContain("IGNITE Education");
    expect(csv.split("\r\n")[0]).toBe("name,strand,IGNITE year");
  });
});

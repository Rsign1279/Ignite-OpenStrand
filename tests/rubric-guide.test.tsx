import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RubricGuide } from "@/components/rubric-guide";
import {
  rubricAnchorInstructions,
  rubricLevels,
  rubricScoringGuide,
} from "@/config/rubric-anchors";
import { getPracticeQuestion, rubric, type StrandId } from "@/config/strands";
import {
  buildPreAssessmentPrompt,
  buildPostAssessmentPrompt,
  buildPracticeAssessmentPrompt,
} from "@/lib/ai/prompts";
import calibration from "./fixtures/feedback-calibration.json";

it("keeps the established four criteria and score bounds in the shared guide", () => {
  expect(rubricScoringGuide.map((entry) => entry.key)).toEqual(
    rubric.map((entry) => entry.key),
  );
  expect(rubricLevels.map((level) => level.score)).toEqual([0, 1, 2, 3]);
  for (const entry of rubricScoringGuide) {
    expect(entry.levels).toHaveLength(4);
    expect(new Set(entry.levels.map((level) => level.description)).size).toBe(
      4,
    );
  }
});

it("gives every assessment stage the complete student-visible scoring anchors", () => {
  for (const builder of [
    buildPreAssessmentPrompt,
    buildPostAssessmentPrompt,
    buildPracticeAssessmentPrompt,
  ]) {
    const prompt = builder("education", "education-teamwork-v1", 1);
    expect(prompt).toContain(rubricAnchorInstructions);
    for (const criterion of rubricScoringGuide) {
      for (const level of criterion.levels) {
        expect(prompt).toContain(`${level.score} — ${level.description}`);
      }
    }
  }
});

it("exposes optional native disclosure and explains score limits without requiring extra interaction", () => {
  const html = renderToStaticMarkup(<RubricGuide />);
  expect(html).toContain('<details class="rubric-guide">');
  expect(html).not.toContain("<details open");
  expect(html).toContain("How your answer is reviewed");
  expect(html).toContain(
    "not a judgment of you or a prediction of hiring success",
  );
  expect(html).toContain("AI feedback can miss context");
  expect(html).toContain("Numbers and successful outcomes are optional");
  expect(html).toContain("one clear personal action can be sufficient");
  for (const criterion of rubricScoringGuide) {
    expect(html).toContain(
      `aria-label="${criterion.label.replaceAll("&", "&amp;")} scoring anchors"`,
    );
  }
});

it("keeps synthetic calibration examples bound to canonical questions without inventing provider results", () => {
  expect(calibration.purpose).toContain("not student data or evidence");
  expect(calibration.cases.map((example) => example.id)).toEqual([
    "truthful-unsuccessful-outcome",
    "team-success-without-own-actions",
    "modest-school-example-one-clear-action",
    "identical-first-and-latest",
    "instruction-injection-without-answer",
  ]);
  for (const example of calibration.cases) {
    const question = getPracticeQuestion(
      example.strand as StrandId,
      example.questionId,
    );
    expect(question.id).toBe(example.questionId);
    expect(example.transcript.length).toBeLessThanOrEqual(16000);
    expect(example.reviewChecks.length).toBeGreaterThanOrEqual(3);
    expect(example).not.toHaveProperty("providerResult");
    expect(example).not.toHaveProperty("measuredImprovement");
  }
});

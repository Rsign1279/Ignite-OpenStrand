import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { rubric, strands, getPracticeQuestion } from "@/config/strands";
import {
  RUBRIC_SCORING_VERSION,
  rubricAnchorInstructions,
  rubricScoringGuide,
} from "@/config/rubric-anchors";
import {
  StarLesson,
  emptyStoryNotes,
  starParts,
} from "@/components/star-lesson";
import { RubricGuide } from "@/components/rubric-guide";
import { Rubric } from "@/components/assessment";
import {
  buildPreAssessmentPrompt,
  buildPostAssessmentPrompt,
  buildPracticeAssessmentPrompt,
} from "@/lib/ai/prompts";
import { getPracticeFocus } from "@/lib/practice-learning";
import { parseEvaluation } from "@/lib/validation";
import taskOwnership from "./fixtures/star-task-ownership.json";

it("uses the screenshot's four content elements while keeping equal /3 scores and /12 total", () => {
  expect(rubric.map((r) => r.key)).toEqual([
    "situation",
    "task",
    "action",
    "result",
  ]);
  expect(RUBRIC_SCORING_VERSION).toBe("ignite-star-rubric-v3");
  const evaluation = parseEvaluation({
    scores: { situation: 3, task: 0, action: 2, result: 1 },
    total: 12,
    strongestPart: "The setting is specific.",
    improvementArea: "Explain your own responsibility.",
  });
  expect(evaluation.total).toBe(6);
  expect(getPracticeFocus(evaluation).key).toBe("task");
  const html = renderToStaticMarkup(<Rubric value={evaluation} />);
  expect(html.match(/class="rubric-row"/g)).toHaveLength(4);
  expect(html).toContain("T — Task");
  expect(html).not.toContain("Communication");
  expect(html).not.toMatch(/(?:20|10|60)%/);
});

it("keeps context separate from the responsibility or goal and does not require every detail", () => {
  const situation = rubricScoringGuide.find((r) => r.key === "situation")!;
  const task = rubricScoringGuide.find((r) => r.key === "task")!;
  expect(situation.definition).toContain("understands the context");
  expect(situation.levels[3].description).toContain(
    "Every detail is not required",
  );
  expect(task.definition).toContain("took responsibility for, or the goal");
  expect(task.levels[3].description).toContain(
    "distinct from the surrounding situation",
  );
  expect(task.levels[0].description).toContain("personal responsibility");
});

it("scores demonstrated personal actions and relevant skills rather than unsupported trait labels", () => {
  const action = rubricScoringGuide.find((r) => r.key === "action")!;
  expect(action.definition).toContain("actions you personally took");
  expect(action.definition).toContain(
    "skills or character traits relevant to the question",
  );
  expect(action.levels[1].description).toContain(
    "cannot identify a personal action",
  );
  expect(action.levels[3].description).toContain(
    "naming a trait is not required",
  );
  expect(rubricAnchorInstructions).toContain(
    "not unsupported labels or inferred personality",
  );
});

it("defines absent Task evidence for a situation-only problem resolved by someone else", () => {
  const example = taskOwnership.cases[0];
  expect(example.transcript).toBe(
    "At coding club the demo page failed before class. The teacher fixed it.",
  );
  expect(example).not.toHaveProperty("scores");
  expect(example).not.toHaveProperty("providerResult");
  expect(taskOwnership.purpose).toContain("not provider grading");
  const task = rubricScoringGuide.find((r) => r.key === "task")!;
  expect(task.levels[0].description).toContain("belonging to the student");
  expect(task.levels[0].description).toContain(
    "A situation's problem alone is not the student's task",
  );
  expect(task.levels[1].description).toContain("belonging to the student");
  expect(task.levels[1].description).toContain("vague or unclear");
  expect(rubricAnchorInstructions).toContain(
    "Another person's action does not establish the student's task",
  );
  expect(getPracticeQuestion("technology", example.questionId).id).toBe(
    example.questionId,
  );
});

it("asks for real measurable outcomes when available without fabricating figures or excluding honest learning", () => {
  const result = rubricScoringGuide.find((r) => r.key === "result")!;
  expect(result.definition).toContain("quantifiable evidence when available");
  expect(result.definition).toContain("learning or key takeaways");
  expect(result.levels[3].description).toContain(
    "even when the outcome was unsuccessful",
  );
  expect(rubricAnchorInstructions).toContain(
    "Numbers and successful outcomes are optional",
  );
  expect(rubricAnchorInstructions).toContain(
    "never invent results or require numbers they do not have",
  );
});

it("gives all three assessment stages the same screenshot-based guide in every strand and participation year", () => {
  for (const strand of strands) {
    const question = strand.questions[0];
    for (const year of [1, 2] as const) {
      for (const build of [
        buildPreAssessmentPrompt,
        buildPostAssessmentPrompt,
        buildPracticeAssessmentPrompt,
      ]) {
        const prompt = build(strand.id, question.id, year);
        expect(prompt).toContain(`Exact question: ${question.text}`);
        expect(prompt).toContain(rubricAnchorInstructions);
        expect(prompt).toContain("Total /12");
        expect(prompt).toContain("situation, task, action, result");
        expect(prompt).toContain("never as a separate score");
        expect(prompt).toContain("Do not penalize accent");
        expect(prompt).not.toMatch(/(?:20|10|60)%/);
      }
    }
  }
});

it("renders the same source guidance in the lesson and optional score guide", () => {
  expect(starParts).toEqual(
    rubric.map((r) => ({
      letter: r.letter,
      title: r.title,
      question: r.lessonQuestion,
      text: r.lessonText,
    })),
  );
  const lesson = renderToStaticMarkup(
    <StarLesson
      question={getPracticeQuestion(
        "health-sciences",
        "health-sciences-teamwork-v1",
      )}
      notes={emptyStoryNotes}
      onNotes={() => {}}
      onContinue={() => {}}
    />,
  );
  const guide = renderToStaticMarkup(<RubricGuide />);
  expect(lesson).toContain("up to 3 points each");
  expect(guide).toContain("for 12 total");
  for (const criterion of rubric) {
    expect(lesson).toContain(renderToStaticMarkup(<>{criterion.lessonText}</>));
    expect(guide).toContain(renderToStaticMarkup(<>{criterion.definition}</>));
  }
  expect(guide).toContain("Clear communication is expected throughout");
  expect(guide).not.toMatch(/(?:20|10|60)%/);
});

import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  PracticeReflection,
  QuestionGrowth,
} from "@/components/practice-reflection";
import { getStrand } from "@/config/strands";
import type { Evaluation } from "@/lib/validation";

const evaluation: Evaluation = {
  scores: {
    situation: 2,
    action: 2,
    result: 1,
    task: 2,
  },
  total: 7,
  strongestPart: "Specific action.",
  improvementArea: "Explain the result.",
};
const question = getStrand("education").questions[8];

it("renders submitted text safely and labels reflection as unscored", () => {
  const html = renderToStaticMarkup(
    <PracticeReflection
      evaluation={evaluation}
      question={question}
      answer={'I wrote <script>alert("x")</script> in my project.'}
    />,
  );
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain('<script>alert("x")</script>');
  expect(html).toContain("not scored or saved");
  expect(html).toContain("Unscored");
  expect(html).toContain("Nothing is recorded or scored");
  expect(html).toContain("Finish with an outcome");
  expect(html).toContain("Explain the result.");
  expect(html).toContain("honestly");
  expect(html).toContain("A setback is valid");
});
it("does not invent a submitted transcript or a growth result", () => {
  expect(
    renderToStaticMarkup(
      <PracticeReflection evaluation={evaluation} question={question} />,
    ),
  ).not.toContain("Review the answer you submitted");
  expect(
    renderToStaticMarkup(
      <QuestionGrowth
        attempts={[{ questionId: question.id, scores: evaluation.scores }]}
        question={question}
      />,
    ),
  ).toBe("");
});

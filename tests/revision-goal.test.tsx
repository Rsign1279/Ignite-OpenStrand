import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RevisionGoalReminder } from "@/components/revision-goal-reminder";
import { InterviewScene } from "@/components/interview-scene";
import { createRevisionGoal } from "@/lib/practice-learning";
import { getPracticeQuestion } from "@/config/strands";

const question = getPracticeQuestion("education", "education-teamwork-v1");
const goal = createRevisionGoal(question.id, {
  scores: {
    situation: 2,
    action: 2,
    result: 1,
    task: 2,
  },
  total: 7,
  strongestPart: "Your own action was clear.",
  improvementArea:
    "Describe the feedback on your <script>example</script> activity.",
});

it("renders the actual revision goal safely with an optional rehearsal", () => {
  const html = renderToStaticMarkup(<RevisionGoalReminder goal={goal} />);
  expect(html).toContain('aria-label="Your focus for this take"');
  expect(html).toContain(
    "Describe the feedback on your &lt;script&gt;example&lt;/script&gt; activity.",
  );
  expect(html).not.toContain("<script>example</script>");
  expect(html).toContain("A quick rehearsal");
  expect(
    renderToStaticMarkup(<RevisionGoalReminder goal={goal} compact />),
  ).not.toContain("A quick rehearsal");
});

it("shows a matching retry goal in the scene without coaching the PRE baseline or another question", () => {
  const scene = (round: "PRE" | "POST", questionId = question.id) =>
    renderToStaticMarkup(
      <InterviewScene
        strand="education"
        question={question}
        round={round}
        revisionGoal={{ ...goal, questionId }}
        onEnter={() => {}}
      />,
    );
  expect(scene("POST")).toContain("Your focus for this take");
  expect(scene("PRE")).not.toContain("Your focus for this take");
  expect(scene("POST", "education-feedback-v1")).not.toContain(
    "Your focus for this take",
  );
});

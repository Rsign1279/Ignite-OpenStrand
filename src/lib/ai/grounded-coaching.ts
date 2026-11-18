import { getPracticeFocus } from "@/lib/practice-learning";
import type { Evaluation } from "@/lib/validation";

export function groundImprovementFeedback(
  evaluation: Evaluation,
  transcript: string,
): Evaluation {
  // Quoting words the student actually said is useful evidence.
  const advice = evaluation.improvementArea.replace(
    /"([^"\n]+)"|“([^”\n]+)”/gu,
    (quote, straight, curly) =>
      transcript.includes(straight ?? curly) ? "" : quote,
  );
  const suppliesExample =
    /\b(?:(?:for example|for instance|such as|you could say|try saying)\b|e\.g\.)/iu.test(
      advice,
    ) ||
    /\b(?:I\s+(?:was|am|took|led|decided|did|would|helped|learned)|my\s+(?:role|task|responsibility)\s+was)\b/iu.test(
      advice,
    );
  if (!suppliesExample) return evaluation;
  return {
    ...evaluation,
    improvementArea: getPracticeFocus(evaluation).action,
  };
}

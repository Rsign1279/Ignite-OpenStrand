import { rubric } from "@/config/strands";

// Bump when anchors or scoring policy change; historical scores keep their tag.
export const RUBRIC_SCORING_VERSION = "ignite-star-rubric-v2";
export const LEGACY_SCORING_VERSION = "legacy-unversioned";

type CriterionKey = (typeof rubric)[number]["key"];

export const rubricLevels = [
  { score: 0, label: "Not yet shown" },
  { score: 1, label: "Vague or limited" },
  { score: 2, label: "Clear, with a gap" },
  { score: 3, label: "Specific and complete" },
] as const;

const anchors: Record<CriterionKey, readonly [string, string, string, string]> =
  {
    situation: [
      "No identifiable setting or problem is described.",
      "A setting or problem is mentioned vaguely; the listener must guess what was happening.",
      "The setting and problem are understandable, but one relevant context detail is unclear or missing.",
      "The specific setting and problem are clearly explained, with enough relevant context to follow the example.",
    ],
    task: [
      "No goal, task, or personal responsibility is described.",
      "A goal or task is mentioned vaguely; what the student was responsible for is unclear.",
      "The goal and personal responsibility are understandable, but one important detail needs clarification.",
      "The specific goal and the student's personal responsibility are clearly explained, distinct from the surrounding situation.",
    ],
    action: [
      "No action taken by the student is described.",
      "Effort or teamwork is claimed, but the listener cannot identify what the student personally did.",
      "A personal action is clear, but how or why it was taken needs more detail.",
      "A personal action and how or why it was taken are specific enough to follow. The student's role can be distinguished from a team's contribution.",
    ],
    result: [
      "No outcome, impact, feedback, or learning is described.",
      "A result or lesson is asserted vaguely, without saying what happened or what was learned.",
      "An outcome, feedback, or lesson is clear, but its connection to the actions or what it means needs more detail.",
      "A specific outcome, feedback, impact, or lesson is connected to the actions. What changed or was learned is clear, even when the outcome was unsuccessful.",
    ],
  };

export const rubricReviewPrinciples = [
  "Score the evidence in this response, not the student's personality, confidence, seniority, or employability.",
  "School, community, home, and supervised learning examples are valid. Professional credentials and work experience are not required.",
  "A short response or one clear personal action can be sufficient. Do not use word counts, a required number of actions, or STAR headings as scoring requirements.",
  "Numbers and successful outcomes are optional. Truthful setbacks, feedback, and specific learning can demonstrate a complete result.",
  "Do not penalize accent, speech differences, filler words, pauses, or transcription punctuation. Judge whether the meaning is understandable.",
  "Assess clear, relevant communication within each STAR element, never as a separate score. Apply a clarity gap only to the element it obscures; do not deduct across all four for the same issue.",
  "Use the same standards for first answers, retries, and both IGNITE participation years. Score each category independently; do not infer missing evidence.",
] as const;

/** One source supplies both the student-facing guide and the model instructions. */
export const rubricScoringGuide = rubric.map((criterion) => ({
  ...criterion,
  levels: rubricLevels.map((level) => ({
    ...level,
    description: anchors[criterion.key][level.score],
  })),
}));

export const rubricAnchorInstructions = [
  "Choose the best-fitting observable anchor for each category using only the response evidence:",
  ...rubricScoringGuide.map(
    (criterion) =>
      `${criterion.key} (${criterion.label}): ${criterion.definition}. ${criterion.levels.map((level) => `${level.score} — ${level.description}`).join(" ")}`,
  ),
  ...rubricReviewPrinciples,
].join("\n");

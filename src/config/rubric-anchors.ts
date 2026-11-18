import { rubric } from "@/config/strands";

// Bump when anchors or scoring policy change; historical scores keep their tag.
export const RUBRIC_SCORING_VERSION = "ignite-star-rubric-v3";
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
      "A situation is mentioned vaguely; the interviewer must guess the context of the example.",
      "The situation is understandable, but one relevant context detail is unclear or missing.",
      "The specific situation is clearly explained with enough context for a new interviewer to follow the example. Every detail is not required.",
    ],
    task: [
      "No identifiable task, personal responsibility, or goal belonging to the student is described. A situation's problem alone is not the student's task.",
      "A task, personal responsibility, or goal belonging to the student is mentioned, but it is vague or unclear.",
      "The student's own task, responsibility, or goal is understandable, but one important detail needs clarification.",
      "The task, problem, or challenge the student personally took responsibility for, or the goal of their own efforts, is specific and clearly explained, distinct from the surrounding situation.",
    ],
    action: [
      "No action taken by the student is described.",
      "Effort, teamwork, or a skill is claimed, but the listener cannot identify a personal action toward the task or goal.",
      "A personal action toward the task or goal is clear, but how or why it was taken, or what relevant skill it demonstrates, needs more detail.",
      "A specific personal action and how or why it was taken clearly show how the student worked toward the task or goal. The action demonstrates skills or character traits relevant to the question; naming a trait is not required.",
    ],
    result: [
      "No outcome, impact, feedback, or learning is described.",
      "A result or lesson is asserted vaguely, without saying what happened or what was learned.",
      "An outcome, feedback, or lesson is clear, but its connection to the actions or supporting evidence needs more detail.",
      "A specific outcome, feedback, impact, or lesson is clearly connected to the student's actions, supported by observed or quantifiable evidence when available. What changed or was learned is clear, even when the outcome was unsuccessful.",
    ],
  };

export const rubricReviewPrinciples = [
  "Score the evidence in this response, not the student's personality, confidence, seniority, or employability.",
  "School, community, home, and supervised learning examples are valid. Professional credentials and work experience are not required.",
  "A short response or one clear personal action can be sufficient. Do not use word counts, a required number of actions, or STAR headings as scoring requirements.",
  "Numbers and successful outcomes are optional. Truthful setbacks, feedback, and specific learning can demonstrate a complete result.",
  "Use real measurements when the student has them; never invent results or require numbers they do not have. Judge relevant skills or character traits through the actions described, not unsupported labels or inferred personality.",
  "Do not penalize accent, speech differences, filler words, pauses, or transcription punctuation. Judge whether the meaning is understandable.",
  "Assess clear, relevant communication within each STAR element, never as a separate score. Apply a clarity gap only to the element it obscures; do not deduct across all four for the same issue.",
  "Use the same standards for first answers, retries, and both IGNITE participation years. Score each category independently; do not infer missing evidence.",
  "A problem or challenge is Task evidence only when linked to the student's own responsibility or goal. Another person's action does not establish the student's task.",
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

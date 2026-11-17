import type { PracticeQuestion } from "@/config/question-bank";
import { getQuestionTopic, type TopicKey } from "@/config/interview-scenes";
import { rubric } from "@/config/strands";
import { totalScore, type Evaluation } from "@/lib/validation";
import { LEGACY_SCORING_VERSION } from "@/config/rubric-anchors";

export type PracticeSkill = keyof Evaluation["scores"];
export type PracticeAttempt = {
  questionId: string;
  scores: Evaluation["scores"];
  scoringVersion?: string;
};

export const practiceSkills: Record<
  PracticeSkill,
  {
    title: string;
    action: string;
    selfCheck: string;
    rehearsal: string;
    nextTopics: readonly TopicKey[];
  }
> = {
  situation: {
    title: "Set the scene",
    action: "Name the moment and the problem so a new listener can follow.",
    selfCheck: "Is it clear where I was and what was happening?",
    rehearsal: "Open with one true sentence about the setting and problem.",
    nextTopics: ["adaptability", "challenge", "learning"],
  },
  task: {
    title: "Make your role clear",
    action: "Explain your goal and what you were personally responsible for.",
    selfCheck: "Could a listener explain what was mine to do?",
    rehearsal: "Finish “My responsibility was…” with a specific, true goal.",
    nextTopics: ["priorities", "initiative", "teamwork"],
  },
  action: {
    title: "Show your own contribution",
    action:
      "Explain one action you took and how or why. Give teammates fair credit.",
    selfCheck: "Is my own contribution clear, beyond the team’s work?",
    rehearsal: "Finish “I decided to…” and “I did that by…” with true details.",
    nextTopics: ["teamwork", "initiative", "achievement"],
  },
  result: {
    title: "Finish with an outcome",
    action:
      "Connect your actions to an observed outcome, feedback, or lesson. A number is optional.",
    selfCheck: "Does my ending show what changed or what I learned?",
    rehearsal:
      "Finish “As a result…” or “I learned…” honestly. A setback is valid.",
    nextTopics: ["achievement", "feedback", "mistake"],
  },
};

/** Use the actual rubric, not a model's declared total or invented mastery label. */
export function getPracticeFocus(evaluation: Evaluation) {
  const key = rubric.reduce<PracticeSkill>(
    (lowest, category) =>
      evaluation.scores[category.key] < evaluation.scores[lowest]
        ? category.key
        : lowest,
    rubric[0].key,
  );
  const complete = rubric.every(
    (category) => evaluation.scores[category.key] === 3,
  );
  return {
    key,
    score: evaluation.scores[key],
    label: rubric.find((category) => category.key === key)!.label,
    ...practiceSkills[key],
    complete,
    ...(complete
      ? {
          title: "Carry the skill into a new story",
          action:
            "This answer met all four criteria. Try a different question and experience with fewer notes.",
          selfCheck:
            "Can I use this structure with a new question and experience?",
          rehearsal:
            "Put notes aside. Keep the structure; use a fresh experience and your own words.",
        }
      : {}),
  };
}

export type PracticeRevisionGoal = {
  questionId: string;
  criterion: PracticeSkill;
  label: string;
  title: string;
  action: string;
  rehearsal: string;
  complete: boolean;
};

/** Snapshot before leaving feedback so a retry retains its own response-specific goal. */
export function createRevisionGoal(
  questionId: string,
  evaluation: Evaluation,
): PracticeRevisionGoal {
  const focus = getPracticeFocus(evaluation);
  return {
    questionId,
    criterion: focus.key,
    label: focus.label,
    title: focus.title,
    action: focus.complete
      ? focus.action
      : evaluation.improvementArea.trim() || focus.action,
    rehearsal: focus.rehearsal,
    complete: focus.complete,
  };
}

/** Stable recommendations are explainable. They never change the canonical question. */
export function recommendPracticeQuestion(
  questions: readonly PracticeQuestion[],
  currentId: string,
  evaluation: Evaluation,
  attempts: readonly PracticeAttempt[] = [],
) {
  const focus = getPracticeFocus(evaluation);
  const candidates = questions.filter((question) => question.id !== currentId);
  if (candidates.length === 0) return undefined;
  const attempted = new Set(attempts.map((attempt) => attempt.questionId));
  const untried = candidates.filter((question) => !attempted.has(question.id));
  const pool = untried.length ? untried : candidates;
  const question = !focus.complete
    ? (focus.nextTopics.flatMap((topic) =>
        pool.filter((candidate) => getQuestionTopic(candidate) === topic),
      )[0] ?? pool[0])
    : pool[0];
  const fresh = !attempted.has(question.id);
  return {
    question,
    focus,
    fresh,
    reason: focus.complete
      ? `${fresh ? "New topic" : "Another topic"}: practice the same skills with a different experience.`
      : `${question.topic} practices ${focus.label.replace(/^[STAR] — /, "").toLowerCase()}.${fresh ? " New in this session." : " Use your current improvement goal."}`,
  };
}

/** Compares the first and latest attempt at ONE question. Never compares unrelated topics. */
export function summarizeQuestionGrowth(
  attempts: readonly PracticeAttempt[],
  questionId: string,
) {
  const questionAttempts = attempts.filter(
    (attempt) => attempt.questionId === questionId,
  );
  const currentVersion =
    questionAttempts.at(-1)?.scoringVersion ?? LEGACY_SCORING_VERSION;
  const matching = questionAttempts.filter(
    (attempt) =>
      (attempt.scoringVersion ?? LEGACY_SCORING_VERSION) === currentVersion,
  );
  if (matching.length < 2) return undefined;
  const first = matching[0];
  const latest = matching[matching.length - 1];
  const before = totalScore(first.scores);
  const after = totalScore(latest.scores);
  const change = after - before;
  return {
    before,
    after,
    change,
    attempts: matching.length,
    excludedAttempts: questionAttempts.length - matching.length,
    direction:
      change > 0
        ? ("up" as const)
        : change < 0
          ? ("down" as const)
          : ("steady" as const),
    title:
      change > 0
        ? "More of your story came through."
        : change < 0
          ? "A useful moment to regroup."
          : "Same score. Keep refining.",
    explanation:
      change > 0
        ? "Your latest response scored higher on this question. Apply the same approach to a new experience."
        : change < 0
          ? "Your latest response scored lower on this question. Check category feedback; keep what worked and strengthen one detail."
          : "Your total is unchanged. Check each category: a total can stay the same while individual skills change.",
    categories: rubric.map((category) => ({
      key: category.key,
      label: category.label,
      before: first.scores[category.key],
      after: latest.scores[category.key],
      change: latest.scores[category.key] - first.scores[category.key],
    })),
  };
}

/** Follow-up prompts are optional rehearsal, separate from the scored bank. */
export const interviewFollowUps: Record<TopicKey, string> = {
  teamwork: "What did you notice about the effect of your contribution?",
  challenge: "What did you consider before choosing that response?",
  feedback: "What specific change did you make after the feedback?",
  learning: "How did you check that you understood the new skill?",
  priorities: "How did you communicate when two responsibilities competed?",
  mistake: "What would you do differently if that happened again?",
  initiative: "How did you decide this improvement was worth trying?",
  perspectives: "What did you learn from the other person's perspective?",
  adaptability: "What helped you decide how to change the plan?",
  achievement: "Why does that accomplishment matter to you?",
};

import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPracticeQuestion, type StrandId } from "@/config/strands";
import { adminClient } from "@/lib/supabase/server";
import {
  evaluationSchema,
  parseEvaluation,
  storedScoresSchema,
  isStarScores,
} from "@/lib/validation";
import type { Evaluation, Transfer } from "@/lib/validation";
import { HttpError } from "@/lib/http";
import { getScoringVersion } from "@/lib/ai/scoring-config";
import { LEGACY_SCORING_VERSION } from "@/config/rubric-anchors";

const storedEvaluationSchema = evaluationSchema.extend({
  scores: storedScoresSchema,
  scoring_version: z.string().min(1).max(300).optional(),
});
export async function saveAssessment(
  userId: string,
  stage: "pre" | "post",
  evaluation: Evaluation,
) {
  const { error } = await adminClient()
    .from("learning_results")
    .upsert({
      user_id: userId,
      ...(stage === "pre"
        ? { pre_scores: evaluation.scores }
        : { post_scores: evaluation.scores }),
      updated_at: new Date().toISOString(),
    });
  if (error)
    throw new HttpError(
      503,
      "Your results could not be saved. Your answer is still here; please try again.",
    );
}
export async function saveTransfer(userId: string, result: Transfer) {
  const { situation, task, action, result: outcome } = result;
  const now = new Date().toISOString();
  const { error } = await adminClient()
    .from("learning_results")
    .upsert({
      user_id: userId,
      transfer_star: { situation, task, action, result: outcome },
      updated_at: now,
      completed_at: now,
    });
  if (error)
    throw new HttpError(
      503,
      "Your results could not be saved. Please try again.",
    );
}

export async function recordAttempt(
  userId: string,
  strand: StrandId,
  stage: "pre" | "post" | "practice",
  evaluation: Evaluation,
  transcript: string,
  requestId: string = randomUUID(),
  questionId?: string,
  scoringVersion: string = getScoringVersion(),
) {
  const { error } = await adminClient().rpc("record_interview_attempt", {
    p_student_id: userId,
    p_request_id: requestId,
    p_question_id: getPracticeQuestion(strand, questionId).id,
    p_question_text: getPracticeQuestion(strand, questionId).text,
    p_stage: stage,
    p_scores: evaluation.scores,
    p_answer: transcript,
    p_evaluation: { ...evaluation, scoring_version: scoringVersion },
    p_feedback: `Strongest part: ${evaluation.strongestPart}\nMost important improvement: ${evaluation.improvementArea}`,
  });
  if (error)
    throw new HttpError(
      error.code === "23505" ? 409 : 503,
      error.code === "23505"
        ? "This submission was already saved with different details. Start a new attempt before submitting another answer."
        : "Your interview results could not be saved. Your answer is still here; please try again.",
    );
}

export async function findRecordedAssessmentWithMetadata(
  userId: string,
  requestId: string | undefined,
  transcript: string,
  questionId: string,
  stage: "pre" | "post" | "practice",
): Promise<{ evaluation: Evaluation; scoringVersion: string } | null> {
  if (!requestId) return null;
  const { data, error } = await adminClient()
    .from("interview_attempts")
    .select("evaluation_json,answer_text,question_id,stage")
    .eq("id", requestId)
    .eq("student_id", userId)
    .maybeSingle();
  if (error)
    throw new HttpError(
      503,
      "Interview storage is temporarily unavailable. Please try again.",
    );
  if (!data) return null;
  if (
    data.answer_text !== transcript ||
    data.question_id !== questionId ||
    data.stage !== stage
  )
    throw new HttpError(
      409,
      "This answer changed. Please refresh your interview before submitting a new response.",
    );
  if (!data.evaluation_json) return null;
  const stored = storedEvaluationSchema.parse(data.evaluation_json);
  if (!isStarScores(stored.scores))
    throw new HttpError(
      409,
      "This answer used the earlier scoring guide. Copy your answer and start a new STAR round; your original result is still saved.",
    );
  // Strip storage metadata from the public evaluation.
  return {
    evaluation: parseEvaluation({
      scores: stored.scores,
      total: stored.total,
      strongestPart: stored.strongestPart,
      improvementArea: stored.improvementArea,
    }),
    scoringVersion: stored.scoring_version ?? LEGACY_SCORING_VERSION,
  };
}

export async function findRecordedAssessment(
  ...args: Parameters<typeof findRecordedAssessmentWithMetadata>
): Promise<Evaluation | null> {
  return (
    (await findRecordedAssessmentWithMetadata(...args))?.evaluation ?? null
  );
}

export async function validatePreQuestion(
  userId: string,
  requestId: string | undefined,
  questionId: string,
  transcript: string | undefined,
) {
  if (!requestId)
    throw new HttpError(
      409,
      "Complete the pre-assessment for this question before the post-assessment.",
    );
  const { data, error } = await adminClient()
    .from("interview_attempts")
    .select(
      "question_id,stage,answer_text,scoring_version:evaluation_json->>scoring_version",
    )
    .eq("id", requestId)
    .eq("student_id", userId)
    .maybeSingle();
  if (error)
    throw new HttpError(
      503,
      "Interview storage is temporarily unavailable. Please try again.",
    );
  if (
    !data ||
    data.stage !== "pre" ||
    data.question_id !== questionId ||
    data.answer_text !== transcript
  )
    throw new HttpError(
      409,
      "Pre- and post-assessments must use the same practice question and session. Start a new practice round to choose a different question.",
    );
  return data.scoring_version ?? LEGACY_SCORING_VERSION;
}

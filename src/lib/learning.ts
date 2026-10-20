import "server-only";
import { randomUUID } from "node:crypto";
import { getPracticeQuestion, type StrandId } from "@/config/strands";
import { adminClient } from "@/lib/supabase/server";
import { parseEvaluation } from "@/lib/validation";
import type { Evaluation, Transfer } from "@/lib/validation";
import { HttpError } from "@/lib/http";
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
  stage: "pre" | "post",
  evaluation: Evaluation,
  transcript: string,
  requestId: string = randomUUID(),
  questionId?: string,
) {
  const { error } = await adminClient().rpc("record_interview_attempt", {
    p_student_id: userId,
    p_request_id: requestId,
    p_question_id: getPracticeQuestion(strand, questionId).id,
    p_question_text: getPracticeQuestion(strand, questionId).text,
    p_stage: stage,
    p_scores: evaluation.scores,
    p_answer: transcript,
    p_evaluation: evaluation,
    p_feedback: `Strongest part: ${evaluation.strongestPart}\nMost important improvement: ${evaluation.improvementArea}`,
  });
  if (error)
    throw new HttpError(
      503,
      "Your interview results could not be saved. Your answer is still here; please try again.",
    );
}

export async function findRecordedAssessment(
  userId: string,
  requestId: string | undefined,
  transcript: string,
  questionId?: string,
): Promise<Evaluation | null> {
  if (!requestId) return null;
  const { data, error } = await adminClient()
    .from("interview_attempts")
    .select("evaluation_json,answer_text,question_id")
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
    (questionId && data.question_id !== questionId)
  )
    throw new HttpError(
      409,
      "This answer changed. Please refresh your interview before submitting a new response.",
    );
  return data.evaluation_json ? parseEvaluation(data.evaluation_json) : null;
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
    .select("question_id,stage,answer_text")
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
}

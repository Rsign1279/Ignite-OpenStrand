import "server-only";
import { adminClient } from "@/lib/supabase/server";
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

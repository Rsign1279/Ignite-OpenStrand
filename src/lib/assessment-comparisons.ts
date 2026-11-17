import "server-only";
import { adminClient } from "@/lib/supabase/server";
import { comparisonSchema, type Comparison } from "@/lib/validation";
import { getScoringVersion } from "@/lib/ai/scoring-config";
import { HttpError } from "@/lib/http";

function storageError(code?: string) {
  return new HttpError(
    ["23505", "23514", "23503", "22023"].includes(code ?? "") ? 409 : 503,
    ["23505", "23514", "23503", "22023"].includes(code ?? "")
      ? "These saved answers cannot be compared together. Start a new practice round."
      : "Your comparison could not be loaded. Your saved answers are still available; please try again.",
  );
}

/** A comparison belongs to one verified student's exact first/second attempt pair. */
export async function findRecordedComparison(
  userId: string,
  postRequestId: string,
  preRequestId: string,
): Promise<Comparison | null> {
  const { data, error } = await adminClient().rpc("find_interview_comparison", {
    p_student_id: userId,
    p_post_attempt_id: postRequestId,
    p_pre_attempt_id: preRequestId,
  });
  if (error) throw storageError(error.code);
  if (data === null) return null;
  const parsed = comparisonSchema.safeParse(data);
  if (!parsed.success) throw storageError();
  return parsed.data;
}

/** Returns the immutable first stored comparison, even when a retry generated another. */
export async function saveRecordedComparison(
  userId: string,
  postRequestId: string,
  preRequestId: string,
  comparison: Comparison,
  reviewVersion: string = getScoringVersion(),
): Promise<Comparison> {
  const payload = comparisonSchema.parse(comparison);
  const { data, error } = await adminClient().rpc(
    "record_interview_comparison",
    {
      p_student_id: userId,
      p_post_attempt_id: postRequestId,
      p_pre_attempt_id: preRequestId,
      p_comparison: payload,
      p_review_version: reviewVersion,
    },
  );
  if (error) throw storageError(error.code);
  const parsed = comparisonSchema.safeParse(data);
  if (!parsed.success) throw storageError();
  return parsed.data;
}

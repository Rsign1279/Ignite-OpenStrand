import "server-only";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import { comparisonSchema } from "@/lib/validation";
import type { AttemptRow } from "@/types/database";
import { attemptSchema, type Attempt } from "./model";
// React cache is request-scoped. No persistent/shared cache of student data.
export const loadAttempts = cache(
  async (studentId?: string, includeText = false): Promise<Attempt[]> => {
    await requireAdmin();
    const client = adminClient();
    const profiles = new Map<
      string,
      { name: string; strand: string; qa_cohort_id?: string | null }
    >();
    for (let offset = 0; ; offset += 1000) {
      let query = client
        .from("student_profiles")
        .select("user_id,name,strand,qa_cohort_id")
        .order("user_id");
      if (studentId) query = query.eq("user_id", studentId);
      const { data, error } = await query.range(offset, offset + 999);
      if (error)
        throw new HttpError(503, "Student data is temporarily unavailable.");
      data.forEach((p) => profiles.set(p.user_id, p));
      if (data.length < 1000) break;
    }
    const rows: Attempt[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = client
        .from("interview_attempts")
        .select(
          includeText
            ? "*,scoring_version:evaluation_json->>scoring_version"
            : "id,student_id,question_id,question_text,stage,attempt_number,total_score,situation,task,action,result,situation_task,personal_actions,result_impact,communication,created_at,is_legacy,scoring_version:evaluation_json->>scoring_version",
        )
        .order("created_at")
        .order("id");
      if (studentId) query = query.eq("student_id", studentId);
      const { data, error } = await query.range(offset, offset + 999).returns<
        (Omit<AttemptRow, "answer_text" | "feedback_text"> &
          Partial<Pick<AttemptRow, "answer_text" | "feedback_text">> & {
            scoring_version?: string | null;
          })[]
      >();
      if (error)
        throw new HttpError(
          503,
          "Interview analytics are temporarily unavailable. Please try again.",
        );
      for (const row of data) {
        const p = profiles.get(row.student_id);
        if (!p) continue;
        rows.push(
          attemptSchema.parse({
            ...row,
            student_name: p.name,
            qa_cohort_id: p.qa_cohort_id ?? null,
            strand: p.strand,
            scores:
              row.situation !== null
                ? {
                    situation: row.situation,
                    task: row.task,
                    action: row.action,
                    result: row.result,
                  }
                : {
                    situationTask: row.situation_task,
                    personalActions: row.personal_actions,
                    resultImpact: row.result_impact,
                    professionalCommunication: row.communication,
                  },
          }),
        );
      }
      if (data.length < 1000) break;
    }
    // Verbatim comparisons stay in authorized detail/export loads, never overview.
    if (includeText) {
      const postRows = new Map(
        rows.filter((row) => row.stage === "post").map((row) => [row.id, row]),
      );
      const postIds = [...postRows.keys()];
      for (let offset = 0; offset < postIds.length; offset += 100) {
        let query = client
          .from("interview_comparisons")
          .select(
            "post_attempt_id,pre_attempt_id,comparison_json,review_version,created_at",
          )
          .in("post_attempt_id", postIds.slice(offset, offset + 100));
        if (studentId) query = query.eq("student_id", studentId);
        const { data, error } = await query;
        if (error)
          throw new HttpError(
            503,
            "Saved comparisons are temporarily unavailable. Please try again.",
          );
        for (const comparison of data) {
          const attempt = postRows.get(comparison.post_attempt_id);
          if (attempt)
            attempt.comparison = attemptSchema.shape.comparison.parse({
              ...comparisonSchema.parse(comparison.comparison_json),
              pre_attempt_id: comparison.pre_attempt_id,
              review_version: comparison.review_version,
              created_at: comparison.created_at,
            });
        }
      }
    }
    return rows;
  },
);

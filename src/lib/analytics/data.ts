import "server-only";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import type { AttemptRow } from "@/types/database";
import { attemptSchema, type Attempt } from "./model";
// React cache is request-scoped. No persistent/shared cache of student data.
export const loadAttempts = cache(
  async (studentId?: string, includeText = false): Promise<Attempt[]> => {
    await requireAdmin();
    const client = adminClient();
    const profiles = new Map<string, { name: string; strand: string }>();
    for (let offset = 0; ; offset += 1000) {
      let query = client
        .from("student_profiles")
        .select("user_id,name,strand")
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
            ? "*"
            : "id,student_id,question_id,question_text,stage,attempt_number,total_score,situation_task,personal_actions,result_impact,communication,created_at,is_legacy",
        )
        .order("created_at")
        .order("id");
      if (studentId) query = query.eq("student_id", studentId);
      const { data, error } = await query
        .range(offset, offset + 999)
        .returns<
          (Omit<AttemptRow, "answer_text" | "feedback_text"> &
            Partial<Pick<AttemptRow, "answer_text" | "feedback_text">>)[]
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
            strand: p.strand,
            scores: {
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
    return rows;
  },
);

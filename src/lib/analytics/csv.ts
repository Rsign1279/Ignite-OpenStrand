import { isStarScores } from "@/lib/validation";
import { getStrand } from "@/config/strands";
import { filterAttempts, studentSummaries } from "./aggregate";
import type { Attempt, Filters } from "./model";
import { LEGACY_SCORING_VERSION } from "./model";
export const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  // Derived negative scores remain numbers; untrusted text is formula-escaped.
  const safe =
    typeof value === "number" && Number.isFinite(value)
      ? text
      : text.replace(/^[\s]*[=+@\-\t\r]/, "'$&");
  return `"${safe.replaceAll('"', '""')}"`;
};
export function attemptsCsv(attempts: Attempt[], filters: Filters) {
  const rows = filterAttempts(attempts, filters);
  const derived = new Map(
    studentSummaries(rows).flatMap((s) =>
      s.questions.map((q) => [s.student_id + ":" + q.question_id, q] as const),
    ),
  );
  return [
    "id,student_id,student_name,strand,question_id,question_text,stage,attempt_number,total_score,situation_task,personal_actions,result_impact,communication,created_at,answer_text,feedback_text,first_score,best_score,latest_score,delta,attempts_count,is_legacy,latest_minus_first,has_repeat,scoring_version,comparison_status,first_scoring_version,latest_scoring_version,situation,task,action,result,rubric_format,session_kind,qa_cohort_id,comparison_change_1,comparison_change_2,comparison_next_step,comparison_review_version,comparison_saved_at,comparison_pre_attempt_id",
    ...rows.map((a) => {
      const q = derived.get(a.student_id + ":" + a.question_id)!;
      return [
        a.id,
        a.student_id,
        a.student_name,
        getStrand(a.strand).name,
        a.question_id,
        a.question_text,
        a.stage,
        a.attempt_number,
        a.total_score,
        ...(!isStarScores(a.scores)
          ? [
              a.scores.situationTask,
              a.scores.personalActions,
              a.scores.resultImpact,
              a.scores.professionalCommunication,
            ]
          : [null, null, null, null]),
        a.created_at,
        a.answer_text,
        a.feedback_text,
        q.first_score,
        q.best_score,
        q.latest_score,
        q.delta,
        q.attempts_count,
        a.is_legacy,
        q.latest_delta,
        q.attempts_count > 1,
        a.scoring_version ?? LEGACY_SCORING_VERSION,
        q.comparison_status,
        q.first_scoring_version,
        q.latest_scoring_version,
        ...(isStarScores(a.scores)
          ? [
              a.scores.situation,
              a.scores.task,
              a.scores.action,
              a.scores.result,
            ]
          : [null, null, null, null]),
        isStarScores(a.scores) ? "STAR" : "Earlier rubric",
        a.qa_cohort_id ? "Synthetic QA" : "Student",
        a.qa_cohort_id ?? "",
        a.comparison?.improvements[0] ?? "",
        a.comparison?.improvements[1] ?? "",
        a.comparison?.nextStep ?? "",
        a.comparison?.review_version ?? "",
        a.comparison?.created_at ?? "",
        a.comparison?.pre_attempt_id ?? "",
      ]
        .map(csvCell)
        .join(",");
    }),
  ].join("\r\n");
}

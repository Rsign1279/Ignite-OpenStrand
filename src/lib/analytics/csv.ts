import { getStrand } from "@/config/strands";
import { filterAttempts, studentSummaries } from "./aggregate";
import type { Attempt, Filters } from "./model";
export const csvCell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^[\s]*[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
export function attemptsCsv(attempts: Attempt[], filters: Filters) {
  const rows = filterAttempts(attempts, filters);
  const derived = new Map(
    studentSummaries(rows).flatMap((s) =>
      s.questions.map((q) => [s.student_id + ":" + q.question_id, q] as const),
    ),
  );
  return [
    "id,student_id,student_name,strand,question_id,question_text,stage,attempt_number,total_score,situation_task,personal_actions,result_impact,communication,created_at,answer_text,feedback_text,first_score,best_score,latest_score,delta,attempts_count,is_legacy",
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
        ...Object.values(a.scores),
        a.created_at,
        a.answer_text,
        a.feedback_text,
        q.first_score,
        q.best_score,
        q.latest_score,
        q.delta,
        q.attempts_count,
        a.is_legacy,
      ]
        .map(csvCell)
        .join(",");
    }),
  ].join("\r\n");
}

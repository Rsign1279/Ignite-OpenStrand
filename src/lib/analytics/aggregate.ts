import { isStarScores } from "@/lib/validation";
import { strands, rubric } from "@/config/strands";
import {
  LEGACY_SCORING_VERSION,
  matchesScope,
  type QuestionSummary,
} from "./model";
import type {
  Analytics,
  Attempt,
  Filters,
  RubricAverage,
  StudentSummary,
  StudentDetail,
} from "./model";
export const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const meanObserved = (values: (number | null)[]) =>
  mean(values.filter((value): value is number => value !== null));
export const chronological = (a: Attempt, b: Attempt) =>
  a.created_at.localeCompare(b.created_at) ||
  a.attempt_number - b.attempt_number ||
  a.id.localeCompare(b.id);
export function filterAttempts(attempts: Attempt[], filters: Filters) {
  const from = filters.from
    ? Date.parse(filters.from + "T00:00:00Z")
    : -Infinity;
  const to = filters.to
    ? Date.parse(filters.to + "T00:00:00Z") + 86400000
    : Infinity;
  let selected = attempts.filter(
    (a) =>
      matchesScope(a, filters.scope) &&
      (!filters.strand.length || filters.strand.includes(a.strand)) &&
      (!filters.student ||
        a.student_name
          .toLocaleLowerCase()
          .includes(filters.student.toLocaleLowerCase())) &&
      Date.parse(a.created_at) >= from &&
      Date.parse(a.created_at) < to,
  );
  const counts = new Map<string, number>();
  selected.forEach((a) =>
    counts.set(a.student_id, (counts.get(a.student_id) ?? 0) + 1),
  );
  selected = selected.filter(
    (a) => (counts.get(a.student_id) ?? 0) >= filters.minAttempts,
  );
  return selected.sort(chronological);
}
export function studentSummaries(attempts: Attempt[]): StudentSummary[] {
  const groups = Map.groupBy(attempts, (a) => a.student_id);
  return [...groups]
    .map(([id, rows]) => {
      const sorted = [...rows].sort(chronological);
      const questions = [...Map.groupBy(sorted, (a) => a.question_id)].map(
        ([question_id, attempts]) => {
          const first_score = attempts[0].total_score,
            best_score = Math.max(...attempts.map((a) => a.total_score)),
            first_scoring_version =
              attempts[0].scoring_version ?? LEGACY_SCORING_VERSION,
            latest_scoring_version =
              attempts.at(-1)!.scoring_version ?? LEGACY_SCORING_VERSION;
          const comparison_status: QuestionSummary["comparison_status"] =
            attempts.length < 2
              ? "single_attempt"
              : first_scoring_version === latest_scoring_version &&
                  isStarScores(attempts[0].scores) ===
                    isStarScores(attempts.at(-1)!.scores)
                ? "paired"
                : "scoring_version_changed";
          return {
            question_id,
            question_text: attempts[0].question_text,
            first_score,
            best_score,
            latest_score: attempts.at(-1)!.total_score,
            delta: best_score - first_score,
            latest_delta:
              comparison_status === "paired"
                ? attempts.at(-1)!.total_score - first_score
                : null,
            attempts_count: attempts.length,
            comparison_status,
            first_scoring_version,
            latest_scoring_version,
          };
        },
      );
      const paired = questions.filter(
        (question) => question.comparison_status === "paired",
      );
      return {
        student_id: id,
        student_name: sorted.at(-1)!.student_name,
        qa_cohort_id: sorted.at(-1)!.qa_cohort_id ?? null,
        strand: sorted.at(-1)!.strand,
        total_attempts: sorted.length,
        unique_questions: questions.length,
        avg_first_score: mean(questions.map((q) => q.first_score))!,
        avg_best_score: mean(questions.map((q) => q.best_score))!,
        avg_delta: mean(questions.map((q) => q.delta))!,
        paired_first_score: mean(paired.map((q) => q.first_score)),
        paired_latest_score: mean(paired.map((q) => q.latest_score)),
        avg_latest_change: meanObserved(paired.map((q) => q.latest_delta)),
        repeated_questions: questions.filter((q) => q.attempts_count > 1)
          .length,
        comparable_questions: paired.length,
        version_changed_questions: questions.filter(
          (q) => q.comparison_status === "scoring_version_changed",
        ).length,
        last_active: sorted.at(-1)!.created_at,
        questions,
      };
    })
    .sort(
      (a, b) =>
        (b.avg_latest_change ?? -Infinity) -
          (a.avg_latest_change ?? -Infinity) ||
        a.student_name.localeCompare(b.student_name) ||
        a.student_id.localeCompare(b.student_id),
    );
}
export function rubricAverages(attempts: Attempt[]): RubricAverage[] {
  const scores = attempts.map((a) => a.scores).filter(isStarScores);
  return rubric.map((r) => ({
    criterion: r.label,
    key: r.key,
    score: mean(scores.map((score) => score[r.key])),
  }));
}
export function aggregate(attempts: Attempt[], filters: Filters): Analytics {
  const rows = filterAttempts(attempts, filters),
    students = studentSummaries(rows);
  const strandStats = strands.map((s) => {
    const group = students.filter((a) => a.strand === s.id);
    return {
      id: s.id,
      name: s.shortName,
      students: group.length,
      attempts: group.reduce((sum, s) => sum + s.total_attempts, 0),
      uniqueQuestions: group.reduce((sum, s) => sum + s.unique_questions, 0),
      first: mean(group.map((s) => s.avg_first_score)),
      best: mean(group.map((s) => s.avg_best_score)),
      delta: mean(group.map((s) => s.avg_delta)),
      pairedFirst: meanObserved(group.map((s) => s.paired_first_score)),
      pairedLatest: meanObserved(group.map((s) => s.paired_latest_score)),
      latestChange: meanObserved(group.map((s) => s.avg_latest_change)),
      pairedStudents: group.filter((s) => s.comparable_questions > 0).length,
      pairedQuestions: group.reduce(
        (sum, s) => sum + s.comparable_questions,
        0,
      ),
      lastActive:
        group
          .map((s) => s.last_active)
          .sort()
          .at(-1) ?? null,
    };
  });
  const weeks = new Map<string, number>();
  rows.forEach((a) => {
    const d = new Date(a.created_at);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = d.toISOString().slice(0, 10);
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  });
  const sortedWeeks = [...weeks.keys()].sort();
  // Fill gaps so a quiet rotation week is visible rather than connected over.
  if (sortedWeeks.length) {
    for (
      let d = Date.parse(sortedWeeks[0]), end = Date.parse(sortedWeeks.at(-1)!);
      d <= end;
      d += 604800000
    ) {
      const key = new Date(d).toISOString().slice(0, 10);
      if (!weeks.has(key)) weeks.set(key, 0);
    }
  }
  return {
    filters,
    generatedAt: new Date().toISOString(),
    kpis: {
      activeStudents: students.length,
      totalAttempts: rows.length,
      avgFirst: mean(students.map((s) => s.avg_first_score)),
      avgBest: mean(students.map((s) => s.avg_best_score)),
      avgImprovement: mean(students.map((s) => s.avg_delta)),
      avgLatestChange: meanObserved(students.map((s) => s.avg_latest_change)),
      pairedStudents: students.filter((s) => s.comparable_questions > 0).length,
      pairedQuestions: students.reduce(
        (sum, s) => sum + s.comparable_questions,
        0,
      ),
      studentsWithoutRepeat: students.filter((s) => s.repeated_questions === 0)
        .length,
      versionChangedQuestions: students.reduce(
        (sum, s) => sum + s.version_changed_questions,
        0,
      ),
      improvedStudents: students.filter(
        (s) => s.avg_latest_change !== null && s.avg_latest_change > 0,
      ).length,
      unchangedStudents: students.filter((s) => s.avg_latest_change === 0)
        .length,
      declinedStudents: students.filter(
        (s) => s.avg_latest_change !== null && s.avg_latest_change < 0,
      ).length,
    },
    strands: strandStats,
    practice: [1, 2, 3, 4].map((n) => {
      const group = rows.filter((a) =>
        n === 4 ? a.attempt_number >= 4 : a.attempt_number === n,
      );
      return {
        attempt: n === 4 ? "4+" : String(n),
        score: mean(group.map((a) => a.total_score)),
        count: group.length,
      };
    }),
    rubric: rubricAverages(rows),
    distribution: strands.map((s) => {
      const group = rows.filter((a) => a.strand === s.id);
      return {
        id: s.id,
        name: s.shortName,
        "0–3": group.filter((a) => a.total_score <= 3).length,
        "4–6": group.filter((a) => a.total_score >= 4 && a.total_score <= 6)
          .length,
        "7–9": group.filter((a) => a.total_score >= 7 && a.total_score <= 9)
          .length,
        "10–12": group.filter((a) => a.total_score >= 10).length,
      };
    }),
    weeks: [...weeks]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, attempts]) => ({ week, attempts })),
    students,
  };
}
export function studentDetail(
  attempts: Attempt[],
  id: string,
  filters: Filters,
): StudentDetail | null {
  const rows = filterAttempts(attempts, filters),
    mine = rows.filter((a) => a.student_id === id),
    student = studentSummaries(mine)[0];
  if (!student) return null;
  const strandRows = rows.filter((a) => a.strand === student.strand),
    cohort = rubricAverages(strandRows);
  return {
    student,
    filters,
    generatedAt: new Date().toISOString(),
    timeline: mine.map((a) => ({
      id: a.id,
      at: a.created_at,
      date: a.created_at.slice(0, 10),
      score: a.total_score,
      question_id: a.question_id,
      question: a.question_text,
      attempt: a.attempt_number,
    })),
    questions: student.questions.map((q) => ({
      ...q,
      attempts: mine.filter((a) => a.question_id === q.question_id),
    })),
    rubric: rubricAverages(mine).map((r, i) => ({
      ...r,
      strandScore: cohort[i].score,
    })),
    mastery: {
      count: student.questions.filter((q) => q.best_score === 12).length,
      total: student.unique_questions,
    },
  };
}

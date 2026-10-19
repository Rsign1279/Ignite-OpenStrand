import { strands, rubric } from "@/config/strands";
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
            best_score = Math.max(...attempts.map((a) => a.total_score));
          return {
            question_id,
            question_text: attempts[0].question_text,
            first_score,
            best_score,
            latest_score: attempts.at(-1)!.total_score,
            delta: best_score - first_score,
            attempts_count: attempts.length,
          };
        },
      );
      return {
        student_id: id,
        student_name: sorted.at(-1)!.student_name,
        strand: sorted.at(-1)!.strand,
        total_attempts: sorted.length,
        unique_questions: questions.length,
        avg_first_score: mean(questions.map((q) => q.first_score))!,
        avg_best_score: mean(questions.map((q) => q.best_score))!,
        avg_delta: mean(questions.map((q) => q.delta))!,
        last_active: sorted.at(-1)!.created_at,
        questions,
      };
    })
    .sort(
      (a, b) =>
        b.avg_delta - a.avg_delta ||
        a.student_name.localeCompare(b.student_name) ||
        a.student_id.localeCompare(b.student_id),
    );
}
export function rubricAverages(attempts: Attempt[]): RubricAverage[] {
  return rubric.map((r) => ({
    criterion: r.label,
    key: r.key,
    score: mean(attempts.map((a) => a.scores[r.key])),
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

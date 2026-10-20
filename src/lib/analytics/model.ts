import { z } from "zod";
import { strandIds } from "@/config/strands";
import { evaluationSchema } from "@/lib/validation";
export const attemptSchema = z.object({
  id: z.uuid(),
  student_id: z.uuid(),
  student_name: z.string(),
  strand: z.enum(strandIds),
  question_id: z.string(),
  question_text: z.string(),
  attempt_number: z.number().int().positive(),
  total_score: z.number().int().min(0).max(12),
  scores: evaluationSchema.shape.scores,
  created_at: z.iso.datetime({ offset: true }),
  stage: z.enum(["pre", "post", "practice"]),
  answer_text: z.string().nullable().optional(),
  feedback_text: z.string().nullable().optional(),
  is_legacy: z.boolean().default(false),
});
export type Attempt = z.infer<typeof attemptSchema>;
export type Filters = {
  strand: string[];
  student: string;
  from: string;
  to: string;
  minAttempts: number;
};
export const filterSchema = z
  .object({
    strand: z.array(z.enum(strandIds)).max(10).default([]),
    student: z.string().trim().max(80).default(""),
    from: z.union([z.literal(""), z.iso.date()]).default(""),
    to: z.union([z.literal(""), z.iso.date()]).default(""),
    minAttempts: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must precede end date",
  );
export function parseFilters(params: URLSearchParams): Filters {
  return filterSchema.parse({
    strand: params
      .getAll("strand")
      .flatMap((v) => v.split(","))
      .filter(Boolean),
    student: params.get("student") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    minAttempts: params.get("minAttempts") ?? params.get("min_attempts") ?? 1,
  });
}
export const filterQuery = (filters: Filters) => {
  const query = new URLSearchParams();
  filters.strand.forEach((s) => query.append("strand", s));
  if (filters.student) query.set("student", filters.student);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.minAttempts > 1)
    query.set("minAttempts", String(filters.minAttempts));
  return query.toString();
};
export type QuestionSummary = {
  question_id: string;
  question_text: string;
  first_score: number;
  best_score: number;
  latest_score: number;
  delta: number;
  attempts_count: number;
};
export type StudentSummary = {
  student_id: string;
  student_name: string;
  strand: Attempt["strand"];
  total_attempts: number;
  unique_questions: number;
  avg_first_score: number;
  avg_best_score: number;
  avg_delta: number;
  last_active: string;
  questions: QuestionSummary[];
};
export type RubricAverage = {
  criterion: string;
  key: keyof Attempt["scores"];
  score: number | null;
  strandScore?: number | null;
};
export type Analytics = {
  filters: Filters;
  generatedAt: string;
  kpis: {
    activeStudents: number;
    totalAttempts: number;
    avgFirst: number | null;
    avgBest: number | null;
    avgImprovement: number | null;
  };
  strands: {
    id: string;
    name: string;
    students: number;
    attempts: number;
    uniqueQuestions: number;
    first: number | null;
    best: number | null;
    delta: number | null;
    lastActive: string | null;
  }[];
  practice: { attempt: string; score: number | null; count: number }[];
  rubric: RubricAverage[];
  distribution: ({ id: string; name: string } & Record<
    "0–3" | "4–6" | "7–9" | "10–12",
    number
  >)[];
  weeks: { week: string; attempts: number }[];
  students: StudentSummary[];
};
export type StudentDetail = {
  student: StudentSummary;
  timeline: {
    id: string;
    at: string;
    date: string;
    score: number;
    question_id: string;
    question: string;
    attempt: number;
  }[];
  questions: (QuestionSummary & { attempts: Attempt[] })[];
  rubric: RubricAverage[];
  mastery: { count: number; total: number };
  filters: Filters;
  generatedAt: string;
};

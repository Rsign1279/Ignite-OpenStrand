import { z } from "zod";
import { strandIds } from "@/config/strands";
export const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(
        /^[^\p{Cc}<>]+$/u,
        "Use a name without special control characters",
      ),
    strand: z.enum(strandIds),
    ignite_year: z.union([z.literal(1), z.literal(2)]),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
const point = z.number().int().min(0).max(3);
export const evaluationSchema = z
  .object({
    scores: z
      .object({
        situationTask: point,
        personalActions: point,
        resultImpact: point,
        professionalCommunication: point,
      })
      .strict(),
    total: z.number().int().min(0).max(12),
    strongestPart: z.string().min(1).max(600),
    improvementArea: z.string().min(1).max(600),
  })
  .strict();
export type Evaluation = z.infer<typeof evaluationSchema>;
export const comparisonSchema = z
  .object({
    improvements: z.array(z.string().min(1).max(600)).length(2),
    nextStep: z.string().min(1).max(600),
  })
  .strict();
export type Comparison = z.infer<typeof comparisonSchema>;
export const transferSchema = z
  .object({
    situation: z.boolean(),
    task: z.boolean(),
    action: z.boolean(),
    result: z.boolean(),
    observation: z.string().min(1).max(600),
  })
  .strict();
export type Transfer = z.infer<typeof transferSchema>;
export const questionSchema = z
  .object({ question: z.string().min(20).max(500) })
  .strict();
export const answerSchema = z
  .object({
    transcript: z.string().trim().min(10).max(16000),
    stage: z.enum(["pre", "post"]),
    preTranscript: z.string().trim().min(10).max(16000).optional(),
  })
  .strict()
  .refine(
    (x) => x.stage !== "post" || !!x.preTranscript,
    "Post comparison needs the pre response",
  );
export const transferAnswerSchema = z
  .object({
    transcript: z.string().trim().min(10).max(16000),
    question: z.string().min(20).max(500),
  })
  .strict();
export const totalScore = (s: Evaluation["scores"]) =>
  s.situationTask +
  s.personalActions +
  s.resultImpact +
  s.professionalCommunication;
export const parseEvaluation = (value: unknown) => {
  const result = evaluationSchema.parse(value);
  return { ...result, total: totalScore(result.scores) };
};
export const scoreChange = (pre: Evaluation, post: Evaluation) =>
  totalScore(post.scores) - totalScore(pre.scores);

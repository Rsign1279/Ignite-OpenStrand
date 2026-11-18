import { createHash, randomUUID } from "node:crypto";
import { getPracticeQuestion } from "@/config/strands";
import {
  saveAssessment,
  recordAttempt,
  findRecordedAssessmentWithMetadata,
  validatePreQuestion,
} from "@/lib/learning";
import {
  findRecordedComparison,
  saveRecordedComparison,
} from "@/lib/assessment-comparisons";
import {
  withAssessmentLock,
  limitLogicalSubmission,
} from "@/lib/request-admission";
import { requireStudent } from "@/lib/auth";
import {
  profileSchema,
  answerSchema,
  evaluationSchema,
  comparisonSchema,
  parseEvaluation,
  type Comparison,
} from "@/lib/validation";
import { ai } from "@/lib/ai/provider";
import {
  buildPreAssessmentPrompt,
  buildPracticeAssessmentPrompt,
  buildPostAssessmentPrompt,
  buildComparisonPrompt,
} from "@/lib/ai/prompts";
import { getScoringVersion } from "@/lib/ai/scoring-config";
import { groundImprovementFeedback } from "@/lib/ai/grounded-coaching";
import {
  LEGACY_SCORING_VERSION,
  RUBRIC_SCORING_VERSION,
} from "@/config/rubric-anchors";
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent(request);
    const student = profileSchema.parse(profile);
    const answer = answerSchema.parse(await readJson(request));
    if (answer.rubricVersion !== RUBRIC_SCORING_VERSION)
      throw new HttpError(
        409,
        "The scoring guide has changed. Copy your answer, then refresh to start a new STAR round.",
      );
    let question;
    try {
      question = getPracticeQuestion(student.strand, answer.questionId);
    } catch {
      throw new HttpError(
        400,
        "Choose a valid practice question for your strand.",
      );
    }
    const preVersion =
      answer.stage === "post"
        ? await validatePreQuestion(
            user.id,
            answer.preRequestId,
            question.id,
            answer.preTranscript,
          )
        : undefined;
    const requestId = answer.requestId ?? randomUUID();
    const lookup = () =>
      findRecordedAssessmentWithMetadata(
        user.id,
        answer.requestId,
        answer.transcript,
        question.id,
        answer.stage,
        answer.preRequestId,
      );
    const cachedComparison = () =>
      answer.stage === "post" && answer.requestId && answer.preRequestId
        ? findRecordedComparison(user.id, answer.requestId, answer.preRequestId)
        : Promise.resolve(null);
    type Saved = NonNullable<Awaited<ReturnType<typeof lookup>>>;
    const respond = async (
      saved: Saved,
      comparison?: Comparison,
      summaryWritten = false,
    ) => {
      if (!summaryWritten && answer.stage !== "practice")
        await saveAssessment(user.id, answer.stage, saved.evaluation);
      return json({
        evaluation: saved.evaluation,
        scoringVersion: saved.scoringVersion,
        requestId,
        ...(comparison ? { comparison } : {}),
        ...(answer.stage === "post"
          ? {
              comparisonComparable:
                (preVersion ?? LEGACY_SCORING_VERSION) === saved.scoringVersion,
            }
          : {}),
      });
    };
    // Completed replays need no quota or provider calls, including comparisons.
    const existing = await lookup();
    if (existing) {
      const comparison = await cachedComparison();
      if (answer.stage !== "post" || comparison)
        return await respond(existing, comparison ?? undefined);
    }
    return await withAssessmentLock(user.id, requestId, async () => {
      const recorded = await lookup();
      const comparison = recorded ? await cachedComparison() : null;
      if (recorded && (answer.stage !== "post" || comparison))
        return await respond(recorded, comparison ?? undefined);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            questionId: question.id,
            stage: answer.stage,
            transcript: answer.transcript,
            preRequestId: answer.preRequestId,
            preTranscript: answer.preTranscript,
          }),
        )
        .digest("hex");
      await limitLogicalSubmission(
        user.id,
        "assessment",
        requestId,
        fingerprint,
      );
      if (request.signal.aborted)
        throw new HttpError(499, "Review canceled. Your answer is still here.");
      const evaluateNewAnswer = async () => {
        const generated = parseEvaluation(
          await ai.structured(
            "assessment",
            answer.stage === "pre"
              ? buildPreAssessmentPrompt(
                  student.strand,
                  answer.questionId,
                  student.ignite_year,
                )
              : answer.stage === "practice"
                ? buildPracticeAssessmentPrompt(
                    student.strand,
                    answer.questionId,
                    student.ignite_year,
                  )
                : buildPostAssessmentPrompt(
                    student.strand,
                    answer.questionId,
                    student.ignite_year,
                  ),
            { transcript: answer.transcript },
            evaluationSchema,
            request.signal,
            user.id,
          ),
        );
        return groundImprovementFeedback(generated, answer.transcript);
      };
      const evaluation = recorded?.evaluation ?? (await evaluateNewAnswer());
      if (!recorded)
        await recordAttempt(
          user.id,
          student.strand,
          answer.stage,
          evaluation,
          answer.transcript,
          requestId,
          answer.questionId,
          undefined,
          answer.preRequestId,
        );
      // A generated server ID cannot race another caller; client IDs are re-read.
      const saved =
        recorded ??
        (answer.requestId
          ? await lookup()
          : { evaluation, scoringVersion: getScoringVersion() });
      if (!saved)
        throw new HttpError(
          503,
          "Your saved results could not be confirmed. Please try again.",
        );
      // Keep the completed score even if quota prevents the comparison for now.
      if (answer.stage !== "post") return await respond(saved);
      await saveAssessment(user.id, "post", saved.evaluation);
      if (!answer.preRequestId)
        throw new HttpError(
          409,
          "Start with a first answer before comparing responses.",
        );
      const storedComparison = await findRecordedComparison(
        user.id,
        requestId,
        answer.preRequestId,
      );
      if (storedComparison) return await respond(saved, storedComparison, true);
      const generated = await ai.structured(
        "comparison",
        buildComparisonPrompt(student.strand, answer.questionId),
        { pre: answer.preTranscript, post: answer.transcript },
        comparisonSchema,
        request.signal,
        user.id,
      );
      const persisted = await saveRecordedComparison(
        user.id,
        requestId,
        answer.preRequestId,
        { ...generated, nextStep: saved.evaluation.improvementArea },
      );
      return await respond(saved, persisted, true);
    });
  } catch (error) {
    return failure(error);
  }
}

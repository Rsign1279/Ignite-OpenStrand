import { getPracticeQuestion } from "@/config/strands";
import {
  saveAssessment,
  recordAttempt,
  findRecordedAssessmentWithMetadata,
  validatePreQuestion,
} from "@/lib/learning";
import { requireStudent } from "@/lib/auth";
import {
  profileSchema,
  answerSchema,
  evaluationSchema,
  comparisonSchema,
  parseEvaluation,
} from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai/provider";
import {
  buildPreAssessmentPrompt,
  buildPracticeAssessmentPrompt,
  buildPostAssessmentPrompt,
  buildComparisonPrompt,
} from "@/lib/ai/prompts";
import { getScoringVersion } from "@/lib/ai/scoring-config";
import {
  LEGACY_SCORING_VERSION,
  RUBRIC_SCORING_VERSION,
} from "@/config/rubric-anchors";
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent(request);
    const studentProfile = profileSchema.parse(profile);
    const id = studentProfile.strand;
    await rateLimit(user.id, "assessment");
    const answer = answerSchema.parse(await readJson(request));
    if (answer.rubricVersion !== RUBRIC_SCORING_VERSION)
      throw new HttpError(
        409,
        "The scoring guide has changed. Copy your answer, then refresh to start a new STAR round.",
      );
    try {
      getPracticeQuestion(id, answer.questionId);
    } catch {
      throw new HttpError(
        400,
        "Choose a valid practice question for your strand.",
      );
    }
    const practiceQuestion = getPracticeQuestion(id, answer.questionId);
    // Legacy callers may omit questionId, but may never invent a PRE response.
    const preScoringVersion =
      answer.stage === "post"
        ? await validatePreQuestion(
            user.id,
            answer.preRequestId,
            practiceQuestion.id,
            answer.preTranscript,
          )
        : undefined;
    const recorded = await findRecordedAssessmentWithMetadata(
      user.id,
      answer.requestId,
      answer.transcript,
      practiceQuestion.id,
      answer.stage,
    );
    const evaluation =
      recorded?.evaluation ??
      parseEvaluation(
        await ai.structured(
          "assessment",
          answer.stage === "pre"
            ? buildPreAssessmentPrompt(
                id,
                answer.questionId,
                studentProfile.ignite_year,
              )
            : answer.stage === "practice"
              ? buildPracticeAssessmentPrompt(
                  id,
                  answer.questionId,
                  studentProfile.ignite_year,
                )
              : buildPostAssessmentPrompt(
                  id,
                  answer.questionId,
                  studentProfile.ignite_year,
                ),
          { transcript: answer.transcript },
          evaluationSchema,
        ),
      );
    await recordAttempt(
      user.id,
      id,
      answer.stage,
      evaluation,
      answer.transcript,
      answer.requestId,
      answer.questionId,
      recorded?.scoringVersion,
    );
    // Two simultaneous identical submissions can both reach the provider.
    // The database accepts only one. Return and summarize that saved score.
    const saved = answer.requestId
      ? await findRecordedAssessmentWithMetadata(
          user.id,
          answer.requestId,
          answer.transcript,
          practiceQuestion.id,
          answer.stage,
        )
      : { evaluation, scoringVersion: getScoringVersion() };
    if (!saved)
      throw new HttpError(
        503,
        "Your saved results could not be confirmed. Please try again.",
      );
    const comparison =
      answer.stage === "post"
        ? {
            ...(await ai.structured(
              "comparison",
              buildComparisonPrompt(id, answer.questionId),
              { pre: answer.preTranscript, post: answer.transcript },
              comparisonSchema,
            )),
            // One coaching goal, bound to the saved assessment even after retries.
            nextStep: saved.evaluation.improvementArea,
          }
        : undefined;
    if (answer.stage !== "practice")
      await saveAssessment(user.id, answer.stage, saved.evaluation);
    return json({
      evaluation: saved.evaluation,
      scoringVersion: saved.scoringVersion,
      comparison,
      ...(answer.stage === "post"
        ? {
            comparisonComparable:
              (preScoringVersion ?? LEGACY_SCORING_VERSION) ===
              saved.scoringVersion,
          }
        : {}),
    });
  } catch (e) {
    return failure(e);
  }
}

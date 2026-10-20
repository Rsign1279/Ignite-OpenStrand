import { getPracticeQuestion } from "@/config/strands";
import {
  saveAssessment,
  recordAttempt,
  findRecordedAssessment,
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
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent();
    const id = profileSchema.parse(profile).strand;
    await rateLimit(user.id, "assessment");
    const answer = answerSchema.parse(await readJson(request));
    try {
      getPracticeQuestion(id, answer.questionId);
    } catch {
      throw new HttpError(
        400,
        "Choose a valid practice question for your strand.",
      );
    }
    const practiceQuestion = getPracticeQuestion(id, answer.questionId);
    if (answer.stage === "post" && answer.questionId)
      await validatePreQuestion(
        user.id,
        answer.preRequestId,
        practiceQuestion.id,
        answer.preTranscript,
      );
    const recorded = await findRecordedAssessment(
      user.id,
      answer.requestId,
      answer.transcript,
      practiceQuestion.id,
    );
    const evaluation =
      recorded ??
      parseEvaluation(
        await ai.structured(
          "assessment",
          answer.stage === "pre"
            ? buildPreAssessmentPrompt(id, answer.questionId)
            : answer.stage === "practice"
              ? buildPracticeAssessmentPrompt(id, answer.questionId)
              : buildPostAssessmentPrompt(id, answer.questionId),
          { transcript: answer.transcript },
          evaluationSchema,
        ),
      );
    const comparison =
      answer.stage === "post"
        ? await ai.structured(
            "comparison",
            buildComparisonPrompt(id, answer.questionId),
            { pre: answer.preTranscript, post: answer.transcript },
            comparisonSchema,
          )
        : undefined;
    if (answer.stage !== "practice")
      await saveAssessment(user.id, answer.stage, evaluation);
    await recordAttempt(
      user.id,
      id,
      answer.stage,
      evaluation,
      answer.transcript,
      answer.requestId,
      answer.questionId,
    );
    return json({ evaluation, comparison });
  } catch (e) {
    return failure(e);
  }
}

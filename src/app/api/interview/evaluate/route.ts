import { saveAssessment } from "@/lib/learning";
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
  buildPostAssessmentPrompt,
  buildComparisonPrompt,
} from "@/lib/ai/prompts";
import { sameOrigin, readJson, json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent();
    const id = profileSchema.parse(profile).strand;
    await rateLimit(user.id, "assessment");
    const answer = answerSchema.parse(await readJson(request));
    const evaluation = parseEvaluation(
      await ai.structured(
        "assessment",
        answer.stage === "pre"
          ? buildPreAssessmentPrompt(id)
          : buildPostAssessmentPrompt(id),
        { transcript: answer.transcript },
        evaluationSchema,
      ),
    );
    const comparison =
      answer.stage === "post"
        ? await ai.structured(
            "comparison",
            buildComparisonPrompt(id),
            { pre: answer.preTranscript, post: answer.transcript },
            comparisonSchema,
          )
        : undefined;
    await saveAssessment(user.id, answer.stage, evaluation);
    return json({ evaluation, comparison });
  } catch (e) {
    return failure(e);
  }
}

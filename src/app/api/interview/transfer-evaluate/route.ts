import { saveTransfer } from "@/lib/learning";
import { getStrand } from "@/config/strands";
import { requireStudent } from "@/lib/auth";
import {
  profileSchema,
  transferSchema,
  transferAnswerSchema,
} from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai/provider";
import { buildTransferEvaluationPrompt } from "@/lib/ai/prompts";
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent(request);
    await rateLimit(user.id, "assessment");
    const answer = transferAnswerSchema.parse(await readJson(request));
    const strand = getStrand(profileSchema.parse(profile).strand);
    const question = strand.questions.find(
      (entry) => entry.text === answer.question,
    );
    // This legacy endpoint still accepts question text, but only canonical
    // wording from the student's bank may influence stored learning results.
    if (!question)
      throw new HttpError(
        400,
        "Choose a valid practice question for your strand.",
      );
    const result = await ai.structured(
      "transfer",
      buildTransferEvaluationPrompt(strand.id, question.id),
      { transcript: answer.transcript },
      transferSchema,
      request.signal,
      user.id,
    );
    await saveTransfer(user.id, result);
    return json(result);
  } catch (e) {
    return failure(e);
  }
}

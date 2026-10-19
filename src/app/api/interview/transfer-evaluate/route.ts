import { saveTransfer } from "@/lib/learning";
import { requireStudent } from "@/lib/auth";
import {
  profileSchema,
  transferSchema,
  transferAnswerSchema,
} from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai/provider";
import { buildTransferEvaluationPrompt } from "@/lib/ai/prompts";
import { sameOrigin, readJson, json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent();
    await rateLimit(user.id, "assessment");
    const answer = transferAnswerSchema.parse(await readJson(request));
    const result = await ai.structured(
      "transfer",
      buildTransferEvaluationPrompt(profileSchema.parse(profile).strand),
      answer,
      transferSchema,
    );
    await saveTransfer(user.id, result);
    return json(result);
  } catch (e) {
    return failure(e);
  }
}

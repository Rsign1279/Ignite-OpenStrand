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
    return json(
      await ai.structured(
        "transfer",
        buildTransferEvaluationPrompt(profileSchema.parse(profile).strand),
        answer,
        transferSchema,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}

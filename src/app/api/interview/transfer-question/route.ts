import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { profileSchema, questionSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai/provider";
import { buildTransferQuestionPrompt } from "@/lib/ai/prompts";
import { sameOrigin, readJson, json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent();
    await rateLimit(user.id, "question");
    z.object({})
      .strict()
      .parse(await readJson(request, 1000));
    return json(
      await ai.structured(
        "question",
        buildTransferQuestionPrompt(profileSchema.parse(profile).strand),
        {},
        questionSchema,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}

import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { getStrand, getPracticeQuestion } from "@/config/strands";
import { profileSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user, profile } = await requireStudent();
    await rateLimit(user.id, "question");
    const { questionId } = z
      .object({ questionId: z.string().min(1).max(100).optional() })
      .strict()
      .parse(await readJson(request, 1000));
    const strand = profileSchema.parse(profile).strand;
    let current;
    try {
      current = getPracticeQuestion(strand, questionId);
    } catch {
      throw new HttpError(
        400,
        "Choose a valid practice question for your strand.",
      );
    }
    const available = getStrand(strand).questions.filter(
      (q) => q.id !== current.id && q.text !== current.text,
    );
    const selected = available[randomInt(available.length)];
    return json({ question: selected.text, questionId: selected.id });
  } catch (error) {
    return failure(error);
  }
}

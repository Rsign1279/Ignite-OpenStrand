import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import { HttpError } from "@/lib/http";
export interface AIProvider {
  structured<T>(
    name: string,
    prompt: string,
    data: unknown,
    schema: z.ZodType<T>,
  ): Promise<T>;
  transcribe(file: File): Promise<string>;
}
export class GroqProvider implements AIProvider {
  private client(timeout = 12000) {
    if (!process.env.GROQ_API_KEY) throw new Error("AI configuration missing");
    return new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout,
      maxRetries: 0,
    });
  }
  async structured<T>(
    name: string,
    prompt: string,
    data: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await this.client().chat.completions.create({
          model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
          temperature: 0.1,
          max_completion_tokens: 4096,
          ...(process.env.GROQ_MODEL?.startsWith("openai/gpt-oss-") ||
          !process.env.GROQ_MODEL
            ? { reasoning_effort: "low" as const }
            : {}),
          messages: [
            { role: "system", content: prompt },
            {
              role: "user",
              content: JSON.stringify({ untrustedInterviewData: data }),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name,
              strict: true,
              schema: z.toJSONSchema(schema) as Record<string, unknown>,
            },
          },
        });
        if (result.choices[0]?.finish_reason === "length")
          throw new Error("Incomplete structured output");
        return schema.parse(
          JSON.parse(result.choices[0]?.message.content ?? ""),
        );
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : undefined;
        if (status === 429)
          throw new HttpError(
            429,
            "Interview processing is busy. Please wait a moment and try again. Your typed answer is still here.",
          );
        if (
          attempt === 1 ||
          (status && status >= 400 && status < 500 && status !== 408)
        )
          throw new HttpError(
            503,
            "We couldn't review your answer right now. Your typed answer is still here. Please try again.",
          );
      }
    }
    throw new Error("Invalid AI output");
  }
  async transcribe(file: File) {
    let result;
    try {
      result = await this.client(45000).audio.transcriptions.create({
        file,
        model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
        response_format: "json",
      });
    } catch {
      throw new HttpError(
        503,
        "We couldn't transcribe your recording. It has not been saved. Please record again or type your answer.",
      );
    }
    const parsed = z.string().trim().min(1).max(16000).safeParse(result.text);
    if (!parsed.success)
      throw new HttpError(
        422,
        "No usable speech was detected. Please record again or type your answer.",
      );
    return parsed.data;
  }
}
export const ai: AIProvider = new GroqProvider();

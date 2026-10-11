import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
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
  private client() {
    if (!process.env.GROQ_API_KEY) throw new Error("AI configuration missing");
    return new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 25000,
      maxRetries: 1,
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
          max_completion_tokens: 1800,
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
        return schema.parse(
          JSON.parse(result.choices[0]?.message.content ?? ""),
        );
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Invalid AI output");
  }
  async transcribe(file: File) {
    const result = await this.client().audio.transcriptions.create({
      file,
      model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
      response_format: "json",
    });
    return z.string().trim().min(10).max(16000).parse(result.text);
  }
}
export const ai: AIProvider = new GroqProvider();

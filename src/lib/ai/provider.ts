import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import { HttpError } from "@/lib/http";
import { getScoringModel, SCORING_TEMPERATURE } from "./scoring-config";
import {
  withProviderCapacity,
  recordProviderObservation,
  providerRateLimit,
  type ProviderLane,
} from "./capacity";

const statusOf = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : undefined;
const headersOf = (error: unknown) =>
  typeof error === "object" && error !== null && "headers" in error
    ? (error.headers as Headers | Record<string, unknown> | undefined)
    : undefined;
export interface AIProvider {
  structured<T>(
    name: string,
    prompt: string,
    data: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    userId?: string,
  ): Promise<T>;
  transcribe(
    file: File,
    signal?: AbortSignal,
    userId?: string,
  ): Promise<string>;
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
  private async request<T>(
    lane: ProviderLane,
    model: string,
    run: () => Promise<{ data: T; response: Response }>,
    signal?: AbortSignal,
    userId?: string,
  ): Promise<T> {
    const cancelled = () =>
      new HttpError(
        499,
        "Your interview request was cancelled. Your answer is still here.",
      );
    if (signal?.aborted) throw cancelled();
    return withProviderCapacity(
      lane,
      model,
      async () => {
        if (signal?.aborted) throw cancelled();
        const started = Date.now();
        try {
          const { data, response } = await run();
          await recordProviderObservation(
            lane,
            model,
            response.status,
            response.headers,
            Date.now() - started,
            typeof data === "object" && data !== null && "usage" in data
              ? data.usage
              : undefined,
          );
          // Once a score completes, the route may persist it for retry-safe retrieval.
          return data;
        } catch (error) {
          const providerStatus = statusOf(error);
          const aborted = signal?.aborted && providerStatus === undefined;
          const status = aborted ? 499 : providerStatus;
          const headers = headersOf(error);
          await recordProviderObservation(
            lane,
            model,
            status ?? 503,
            headers,
            Date.now() - started,
          );
          if (aborted) throw cancelled();
          if (status === 429)
            throw await providerRateLimit(lane, model, headers);
          throw error;
        }
      },
      userId,
    );
  }
  async structured<T>(
    name: string,
    prompt: string,
    data: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    userId?: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = getScoringModel();
        const result = await this.request(
          "text",
          model,
          () =>
            this.client()
              .chat.completions.create(
                {
                  model,
                  temperature: SCORING_TEMPERATURE,
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
                },
                { signal },
              )
              .withResponse(),
          signal,
          userId,
        );
        if (result.choices[0]?.finish_reason === "length")
          throw new Error("Incomplete structured output");
        return schema.parse(
          JSON.parse(result.choices[0]?.message.content ?? ""),
        );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const status = statusOf(error);
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
  async transcribe(file: File, signal?: AbortSignal, userId?: string) {
    let result;
    try {
      const model =
        process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo";
      result = await this.request(
        "audio",
        model,
        () =>
          this.client(45000)
            .audio.transcriptions.create(
              {
                file,
                model,
                response_format: "json",
              },
              { signal },
            )
            .withResponse(),
        signal,
        userId,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
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

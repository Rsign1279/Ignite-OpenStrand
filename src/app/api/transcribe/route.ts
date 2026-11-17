import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { ai } from "@/lib/ai/provider";
import {
  withUploadAdmission,
  withAssessmentLock,
  limitLogicalSubmission,
} from "@/lib/request-admission";
import { sameOrigin, json, failure, HttpError } from "@/lib/http";

async function readAudioBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Recording is missing.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => {
    const stop = (status: number, message: string) => {
      void reader.cancel().catch(() => {});
      reject(new HttpError(status, message));
    };
    timer = setTimeout(
      () =>
        stop(
          408,
          "Recording upload took too long. Your recording is still here; retry or use text.",
        ),
      30000,
    );
    abort = () =>
      stop(499, "Transcription canceled. Your answer is still here.");
    if (request.signal.aborted) abort();
    else request.signal.addEventListener("abort", abort, { once: true });
  });
  const reading = (async () => {
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_000_000) {
        await reader.cancel();
        throw new HttpError(
          413,
          "Recording is too large. Please use text answer mode.",
        );
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  })();
  try {
    return await Promise.race([reading, stopped]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await requireStudent(request);
    if (
      !request.headers.get("content-type")?.startsWith("multipart/form-data;")
    )
      throw new HttpError(
        415,
        "Send a microphone recording or use text answer mode.",
      );
    if (Number(request.headers.get("content-length")) > 4_000_000)
      throw new HttpError(
        413,
        "Recording is too large. Please use a shorter recording or type your answer.",
      );
    const rawId = request.headers.get("X-Transcription-Request");
    const requestId = rawId ? z.uuid().parse(rawId) : randomUUID();
    return await withUploadAdmission(async () => {
      const bytes = await readAudioBody(request);
      let form: FormData;
      try {
        form = await new Response(bytes, {
          headers: {
            "content-type": request.headers.get("content-type") ?? "",
          },
        }).formData();
      } catch {
        throw new HttpError(
          400,
          "Recording upload was incomplete. Please record again or type your answer.",
        );
      }
      if ([...form.keys()].length !== 1)
        throw new HttpError(400, "Send one recording at a time.");
      const file = form.get("audio");
      if (
        !(file instanceof File) ||
        file.size < 100 ||
        file.size > 3_900_000 ||
        !["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"].includes(
          file.type.split(";")[0],
        )
      )
        throw new HttpError(
          400,
          "Unsupported recording. Please use text answer mode.",
        );
      const fingerprint = createHash("sha256")
        .update(file.type)
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex");
      return withAssessmentLock(user.id, `audio:${requestId}`, async () => {
        await limitLogicalSubmission(
          user.id,
          "transcribe",
          requestId,
          fingerprint,
        );
        if (request.signal.aborted)
          throw new HttpError(
            499,
            "Transcription canceled. Your answer is still here.",
          );
        return json({
          transcript: await ai.transcribe(file, request.signal, user.id),
        });
      });
    });
  } catch (error) {
    return failure(error);
  }
}

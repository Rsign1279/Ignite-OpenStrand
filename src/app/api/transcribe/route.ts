import { requireStudent } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ai } from "@/lib/ai/provider";
import { sameOrigin, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { user } = await requireStudent();
    await rateLimit(user.id, "transcribe");
    const max = 4_000_000;
    const length = Number(request.headers.get("content-length"));
    if (
      !request.headers.get("content-type")?.startsWith("multipart/form-data;")
    )
      throw new HttpError(
        415,
        "Send a microphone recording or use text answer mode.",
      );
    if (length > max)
      throw new HttpError(
        413,
        "Recording is too large. Please use a shorter recording or type your answer.",
      );
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Recording is missing.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(
          413,
          "Recording is too large. Please use text answer mode.",
        );
      }
      chunks.push(value);
    }
    let form: FormData;
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { "content-type": request.headers.get("content-type") ?? "" },
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
    return json({ transcript: await ai.transcribe(file) });
  } catch (e) {
    return failure(e);
  }
}

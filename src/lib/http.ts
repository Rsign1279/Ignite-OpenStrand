import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Request not allowed.");
}
export async function readJson(request: Request, max = 70000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request is empty.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Your response is too long.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export function failure(error: unknown) {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 503;
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "Please check your response and try again."
            : "We couldn't process your interview response right now. Your recording has not been saved. Please try again.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
export const json = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "no-store" } });

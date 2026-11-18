import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    site === "cross-site" ||
    site === "same-site"
  )
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
  const code =
    error instanceof HttpError &&
    "code" in error &&
    (error.code === "AI_CAPACITY_BUSY" ||
      error.code === "AI_PROVIDER_RATE_LIMIT")
      ? error.code
      : undefined;
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 503;
  const requestedWait =
    error instanceof HttpError ? error.retryAfterSeconds : undefined;
  const retryAfter =
    typeof requestedWait === "number" && Number.isFinite(requestedWait)
      ? Math.max(
          1,
          Math.min(
            code === "AI_PROVIDER_RATE_LIMIT" ? 86400 : 3600,
            Math.ceil(requestedWait),
          ),
        )
      : 60;
  return Response.json(
    {
      ...(code ? { code } : {}),
      error:
        error instanceof HttpError
          ? error.message
          : status === 400
            ? "Please check your response and try again."
            : "We couldn't process your interview response right now. Your answer is still here. Please try again.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}
export const json = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "no-store" } });

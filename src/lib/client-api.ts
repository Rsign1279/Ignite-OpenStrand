export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestContext = {
  studentSessionId?: string;
  transcriptionRequestId?: string;
  onResponse?: (response: Response) => void;
  onCapacityWait?: (seconds: number) => void;
  onAttempt?: () => void;
};

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  context?: RequestContext,
): Promise<T> {
  if (signal?.aborted)
    throw new DOMException("Request canceled.", "AbortError");
  // Retried requests keep the original student's identity and payload.
  const identity = context?.studentSessionId;
  const transcriptionId = context?.transcriptionRequestId;
  const payload =
    body instanceof FormData
      ? (() => {
          const copy = new FormData();
          for (const [name, value] of body.entries()) copy.append(name, value);
          return copy;
        })()
      : body === undefined
        ? undefined
        : JSON.stringify(body);
  const headers: Record<string, string> = {
    ...(payload instanceof FormData || payload === undefined
      ? {}
      : { "Content-Type": "application/json" }),
    ...(identity ? { "X-Student-Session": identity } : {}),
    ...(path === "/api/transcribe" && transcriptionId
      ? { "X-Transcription-Request": transcriptionId }
      : {}),
  };
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const canWaitForCapacity =
    path === "/api/interview/evaluate" || path === "/api/transcribe";
  const deadline = Date.now() + (canWaitForCapacity ? 120000 : 65000);
  const timeout = setTimeout(
    () => controller.abort(),
    canWaitForCapacity ? 120000 : 65000,
  );
  let retries = 0;
  const canceled = () =>
    signal?.aborted
      ? new DOMException("Request canceled.", "AbortError")
      : new Error(
          "Processing took too long. Your typed answer is still here. Please try again.",
        );
  try {
    for (;;) {
      if (controller.signal.aborted) throw canceled();
      context?.onAttempt?.();
      let response: Response;
      try {
        response = await fetch(path, {
          method: body === undefined ? "GET" : "POST",
          headers: Object.keys(headers).length ? headers : undefined,
          body: payload,
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (signal?.aborted)
          throw new DOMException("Request canceled.", "AbortError");
        throw new Error(
          controller.signal.aborted
            ? "Processing took too long. Your typed answer is still here. Please try again."
            : "Connection interrupted. Your typed answer is still here. Check your connection and try again.",
        );
      }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        if (signal?.aborted)
          throw new DOMException("Request canceled.", "AbortError");
        throw new Error(
          "Processing is temporarily unavailable. Your typed answer is still here. Please try again.",
        );
      }
      if (!response.ok) {
        const code =
          typeof result === "object" &&
          result !== null &&
          "code" in result &&
          typeof result.code === "string"
            ? result.code
            : undefined;
        const rawRetryAfter = response.headers.get("Retry-After");
        const seconds = rawRetryAfter === null ? NaN : Number(rawRetryAfter);
        const retryAfterSeconds =
          Number.isFinite(seconds) && seconds >= 1
            ? Math.min(86400, Math.ceil(seconds))
            : undefined;
        const delay =
          (retryAfterSeconds ?? 2) * 1000 + Math.floor(Math.random() * 400);
        if (
          canWaitForCapacity &&
          response.status === 429 &&
          code === "AI_CAPACITY_BUSY" &&
          retryAfterSeconds !== undefined &&
          retries < 4 &&
          retryAfterSeconds <= 60 &&
          Date.now() + delay + 1000 < deadline
        ) {
          retries++;
          context?.onCapacityWait?.(Math.ceil(delay / 1000));
          await new Promise<void>((resolve, reject) => {
            const cancelWait = () => {
              clearTimeout(timer);
              controller.signal.removeEventListener("abort", cancelWait);
              reject(canceled());
            };
            const timer = setTimeout(() => {
              controller.signal.removeEventListener("abort", cancelWait);
              resolve();
            }, delay);
            if (controller.signal.aborted) cancelWait();
            else
              controller.signal.addEventListener("abort", cancelWait, {
                once: true,
              });
          });
          if (controller.signal.aborted) throw canceled();
          continue;
        }
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : undefined;
        throw new ApiError(
          response.status,
          message ??
            (response.status === 401
              ? "Your session expired. Refresh this page to reconnect."
              : response.status === 429
                ? "You're sending requests too quickly. Please wait a moment and try again."
                : "Processing is temporarily unavailable. Please try again."),
          code,
          retryAfterSeconds,
        );
      }
      context?.onResponse?.(response);
      return result as T;
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

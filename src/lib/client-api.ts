export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestContext = {
  studentSessionId?: string;
  onResponse?: (response: Response) => void;
};

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  context?: RequestContext,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    if (signal?.aborted)
      throw new DOMException("Request canceled.", "AbortError");
    let response: Response;
    try {
      response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body instanceof FormData || body === undefined
            ? context?.studentSessionId
              ? { "X-Student-Session": context.studentSessionId }
              : undefined
            : {
                "Content-Type": "application/json",
                ...(context?.studentSessionId
                  ? { "X-Student-Session": context.studentSessionId }
                  : {}),
              },
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
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
      );
    }
    context?.onResponse?.(response);
    return result as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

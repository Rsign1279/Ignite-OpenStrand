export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    let response: Response;
    try {
      response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body instanceof FormData || body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
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
      throw new Error(
        message ??
          (response.status === 401
            ? "Your session expired. Refresh this page to reconnect."
            : response.status === 429
              ? "You're sending requests too quickly. Please wait a moment and try again."
              : "Processing is temporarily unavailable. Please try again."),
      );
    }
    return result as T;
  } finally {
    clearTimeout(timeout);
  }
}

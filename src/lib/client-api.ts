export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body instanceof FormData
        ? undefined
        : body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result as T;
}

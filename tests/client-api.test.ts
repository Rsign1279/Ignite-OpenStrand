import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/client-api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("handles successful JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ok: true })),
  );
  expect(await api("/api", { answer: "test" })).toEqual({ ok: true });
});
it.each([401, 429, 503])("shows safe server errors %s", async (status) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ error: "Safe error" }, { status })),
  );
  await expect(api("/api", {})).rejects.toThrow("Safe error");
});
it("handles HTML gateway failures without JSON syntax errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>Bad Gateway</html>", { status: 502 }),
      ),
  );
  await expect(api("/api", {})).rejects.toThrow("typed answer is still here");
});
it("handles lost connection without automatically duplicating paid POSTs", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("Network"));
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api", {})).rejects.toThrow("Connection interrupted");
  expect(fetch).toHaveBeenCalledOnce();
});
it("aborts hung requests", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new Error("Abort")),
          ),
        ),
    ),
  );
  const result = expect(api("/api", {})).rejects.toThrow(
    "Processing took too long",
  );
  await vi.advanceTimersByTimeAsync(65000);
  await result;
});
it("does not override browser multipart boundaries", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ transcript: "test" }));
  vi.stubGlobal("fetch", fetch);
  const f = new FormData();
  await api("/api/transcribe", f);
  expect(fetch.mock.calls[0][1].headers).toBeUndefined();
  expect(fetch.mock.calls[0][1].body).toBe(f);
});

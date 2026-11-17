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
  expect(fetch.mock.calls[0][1].body).not.toBe(f);
  expect([...fetch.mock.calls[0][1].body.entries()]).toEqual([...f.entries()]);
});
it("aborts transcription when its recorder session ends", async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const fetch = vi.fn(
    (_path, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        requestSignal = options.signal;
        options.signal.addEventListener("abort", () =>
          reject(new Error("Abort")),
        );
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = expect(
    api("/api/transcribe", new FormData(), controller.signal),
  ).rejects.toMatchObject({ name: "AbortError", message: "Request canceled." });
  controller.abort();
  await pending;
  expect(requestSignal?.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
});
it("never sends a request for an already canceled session", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api", {}, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("removes the session abort listener when a request completes", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ok: true })),
  );
  await api("/api", undefined, controller.signal);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
it("pins JSON and audio requests to the initiating student's identity", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
  vi.stubGlobal("fetch", fetch);
  const context = { studentSessionId: "student-A" };
  await api(
    "/api/interview/evaluate",
    { transcript: "A's answer" },
    undefined,
    context,
  );
  await api("/api/transcribe", new FormData(), undefined, context);
  expect(fetch.mock.calls[0][1].headers).toEqual({
    "Content-Type": "application/json",
    "X-Student-Session": "student-A",
  });
  expect(fetch.mock.calls[1][1].headers).toEqual({
    "X-Student-Session": "student-A",
  });
});

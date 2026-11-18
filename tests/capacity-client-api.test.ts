import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/client-api";
import { failure, HttpError } from "@/lib/http";

const busy = (seconds = "2", code = "AI_CAPACITY_BUSY", status = 429) =>
  Response.json(
    { error: "Your answer is safe. Please wait.", code },
    { status, headers: { "Retry-After": seconds } },
  );
const settle = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (error: unknown) => ({ status: "rejected" as const, error }),
  );
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each(["/api/interview/evaluate", "/api/transcribe"])(
  "waits for explicit short capacity admission before retrying %s",
  async (path) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const onCapacityWait = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const pending = api(path, { answer: "original" }, undefined, {
      onCapacityWait,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(onCapacityWait).toHaveBeenCalledWith(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each([
  ["/api/interview/evaluate", 429, "AI_PROVIDER_RATE_LIMIT"],
  ["/api/interview/evaluate", 429, "STUDENT_LIMIT"],
  ["/api/interview/evaluate", 503, "AI_CAPACITY_BUSY"],
  ["/api/interview/evaluate", 401, "AI_CAPACITY_BUSY"],
  ["/api/profile", 429, "AI_CAPACITY_BUSY"],
  ["/api/interview/transfer-question", 429, "AI_CAPACITY_BUSY"],
] as const)(
  "does not silently retry non-admission response %s %s %s",
  async (path, status, code) => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(busy("2", code, status)));
    vi.stubGlobal("fetch", fetch);
    const result = await settle(api(path, {}));
    expect(result.status).toBe("rejected");
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("does not retry a generic student 429 or an interrupted paid request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { error: "Take a practice break." },
        { status: 429, headers: { "Retry-After": "600" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api/interview/evaluate", {})).rejects.toMatchObject({
    status: 429,
    retryAfterSeconds: 600,
  });
  fetch.mockRejectedValueOnce(new TypeError("Network interrupted"));
  await expect(api("/api/interview/evaluate", {})).rejects.toThrow(
    "Connection interrupted",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([
  undefined,
  "NaN",
  "Infinity",
  "0",
  "-1",
  "Wed, 18 Nov 2026 00:00:00 GMT",
])(
  "does not guess an early retry when admission Retry-After is invalid (%s)",
  async (value) => {
    const headers: Record<string, string> =
      value === undefined ? {} : { "Retry-After": value };
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: "Busy", code: "AI_CAPACITY_BUSY" },
          { status: 429, headers },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const onCapacityWait = vi.fn();
    await expect(
      api("/api/interview/evaluate", {}, undefined, { onCapacityWait }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledOnce();
    expect(onCapacityWait).not.toHaveBeenCalled();
  },
);

it("honors a full sixty-second admission wait without an early request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(busy("60"))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const pending = api("/api/interview/evaluate", {});
  await vi.advanceTimersByTimeAsync(59999);
  expect(fetch).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toEqual({ ok: true });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("preserves a provider's day-long Retry-After without automatic resubmission", async () => {
  const quota = Object.assign(
    new HttpError(429, "Daily provider quota reached.", 86400),
    { code: "AI_PROVIDER_RATE_LIMIT" },
  );
  const response = failure(quota);
  expect(response.headers.get("Retry-After")).toBe("86400");
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  await expect(api("/api/interview/evaluate", {})).rejects.toMatchObject({
    status: 429,
    code: "AI_PROVIDER_RATE_LIMIT",
    retryAfterSeconds: 86400,
  });
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([
  ["/api/interview/evaluate", "888", "Scoring", "15 minutes"],
  ["/api/transcribe", "8", "Voice transcription", "8 seconds"],
])(
  "shows the provider wait in plain language for %s",
  async (path, seconds, label, wait) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(busy(seconds, "AI_PROVIDER_RATE_LIMIT"));
    vi.stubGlobal("fetch", fetch);
    await expect(api(path, {})).rejects.toMatchObject({
      message: `${label} is temporarily at capacity. Keep this tab open and try again in about ${wait}.`,
      retryAfterSeconds: Number(seconds),
    });
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("bounds repeated short admission failures instead of retrying forever", async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(busy("1")));
  vi.stubGlobal("fetch", fetch);
  const pending = settle(api("/api/interview/evaluate", {}));
  await vi.advanceTimersByTimeAsync(10000);
  const result = await pending;
  expect(result.status).toBe("rejected");
  expect(fetch).toHaveBeenCalledTimes(5);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not schedule another wait that would exceed the overall deadline", async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(busy("60")));
  vi.stubGlobal("fetch", fetch);
  const pending = settle(api("/api/interview/evaluate", {}));
  await vi.advanceTimersByTimeAsync(60000);
  expect((await pending).status).toBe("rejected");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("the monotonic timer cancels a capacity sleep even if the wall clock stops advancing", async () => {
  vi.spyOn(Date, "now").mockReturnValue(0);
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(busy("60")));
  vi.stubGlobal("fetch", fetch);
  const pending = settle(api("/api/interview/evaluate", {}));
  await vi.advanceTimersByTimeAsync(120000);
  const result = await pending;
  expect(result).toMatchObject({
    status: "rejected",
    error: { message: expect.stringContaining("Processing took too long") },
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a pending wait and never submits another student's queued answer", async () => {
  const controller = new AbortController();
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(busy()));
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  vi.stubGlobal("fetch", fetch);
  const pending = settle(
    api(
      "/api/interview/evaluate",
      { transcript: "Student A's answer" },
      controller.signal,
      { studentSessionId: "A" },
    ),
  );
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  expect(await pending).toMatchObject({
    status: "rejected",
    error: { name: "AbortError" },
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

it("also cancels when the wait notification immediately aborts the initiating session", async () => {
  const controller = new AbortController();
  const fetch = vi.fn().mockResolvedValue(busy());
  vi.stubGlobal("fetch", fetch);
  const pending = settle(
    api("/api/transcribe", new FormData(), controller.signal, {
      onCapacityWait: () => controller.abort(),
    }),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(await pending).toMatchObject({
    status: "rejected",
    error: { name: "AbortError" },
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("sends nothing when the session was canceled before the call", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    api("/api/transcribe", new FormData(), controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("freezes the original JSON payload and student identity across a capacity wait", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(busy())
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const body = { transcript: "Original A answer", requestId: "attempt-A" };
  const context = { studentSessionId: "student-A" };
  const pending = api("/api/interview/evaluate", body, undefined, context);
  await vi.advanceTimersByTimeAsync(0);
  body.transcript = "Later B answer";
  body.requestId = "attempt-B";
  context.studentSessionId = "student-B";
  await vi.advanceTimersByTimeAsync(2000);
  await pending;
  for (const [, options] of fetch.mock.calls) {
    expect(options.headers).toMatchObject({ "X-Student-Session": "student-A" });
    expect(JSON.parse(options.body)).toEqual({
      transcript: "Original A answer",
      requestId: "attempt-A",
    });
  }
});

it("snapshots the clip and UUID while letting the browser generate multipart boundaries", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(busy())
    .mockResolvedValueOnce(Response.json({ transcript: "Initial clip" }));
  vi.stubGlobal("fetch", fetch);
  const form = new FormData();
  form.append(
    "audio",
    new File(["Initial clip bytes"], "initial.webm", { type: "audio/webm" }),
  );
  const context = {
    studentSessionId: "student-A",
    transcriptionRequestId: "11111111-1111-4111-8111-111111111111",
  };
  const pending = api("/api/transcribe", form, undefined, context);
  await vi.advanceTimersByTimeAsync(0);
  form.set(
    "audio",
    new File(["Different clip"], "other.mp4", { type: "audio/mp4" }),
  );
  context.studentSessionId = "student-B";
  context.transcriptionRequestId = "22222222-2222-4222-8222-222222222222";
  await vi.advanceTimersByTimeAsync(2000);
  expect(await pending).toEqual({ transcript: "Initial clip" });
  for (const [, options] of fetch.mock.calls) {
    expect(options.headers).toEqual({
      "X-Student-Session": "student-A",
      "X-Transcription-Request": "11111111-1111-4111-8111-111111111111",
    });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body).not.toBe(form);
    const file = options.body.get("audio") as File;
    expect(file.name).toBe("initial.webm");
    expect(await file.text()).toBe("Initial clip bytes");
    expect(options.headers).not.toHaveProperty("Content-Type");
  }
});

it("notifies admission waits and successful response exactly once, with cleanup if a UI hook throws", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(busy())
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const onCapacityWait = vi.fn(),
    onResponse = vi.fn();
  const pending = api("/api/interview/evaluate", {}, undefined, {
    onCapacityWait,
    onResponse,
  });
  await vi.advanceTimersByTimeAsync(2000);
  await pending;
  expect(onCapacityWait).toHaveBeenCalledOnce();
  expect(onResponse).toHaveBeenCalledOnce();
  fetch.mockResolvedValueOnce(busy());
  await expect(
    api("/api/interview/evaluate", {}, undefined, {
      onCapacityWait: () => {
        throw new Error("UI hook failed");
      },
    }),
  ).rejects.toThrow("UI hook failed");
  expect(vi.getTimerCount()).toBe(0);
});

it("cleans timer and caller listener if JSON serialization fails before a request", async () => {
  const controller = new AbortController();
  const add = vi.spyOn(controller.signal, "addEventListener"),
    remove = vi.spyOn(controller.signal, "removeEventListener");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const body: Record<string, unknown> = {};
  body.self = body;
  await expect(
    api("/api/interview/evaluate", body, controller.signal),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  if (add.mock.calls.length)
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});

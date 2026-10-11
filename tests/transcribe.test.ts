import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  transcribe: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireStudent: mock.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mock.limit }));
vi.mock("@/lib/ai/provider", () => ({ ai: { transcribe: mock.transcribe } }));
import { POST } from "@/app/api/transcribe/route";
import { HttpError } from "@/lib/http";
function recording(type = "audio/webm", size = 256) {
  const form = new FormData();
  form.append("audio", new File([new Uint8Array(size)], "answer", { type }));
  return new Request("https://school.test/api/transcribe", {
    method: "POST",
    body: form,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ user: { id: "opaque-id" } });
  mock.limit.mockResolvedValue(undefined);
  mock.transcribe.mockResolvedValue("A short answer.");
});
it.each([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm;codecs=opus",
])("accepts browser %s multipart without content-length", async (type) => {
  const r = await POST(recording(type));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ transcript: "A short answer." });
  expect(mock.transcribe).toHaveBeenCalledOnce();
});
it.each([
  ["text/plain", 256],
  ["audio/webm", 0],
  ["audio/webm", 99],
])("rejects invalid audio %s/%s without provider usage", async (type, size) => {
  expect((await POST(recording(type, size))).status).toBe(400);
  expect(mock.transcribe).not.toHaveBeenCalled();
});
it("rejects oversized streamed upload even without length", async () => {
  expect((await POST(recording("audio/webm", 4_000_001))).status).toBe(413);
  expect(mock.transcribe).not.toHaveBeenCalled();
});
it("rejects oversized declared upload", async () => {
  const r = recording();
  r.headers.set("content-length", "5000000");
  expect((await POST(r)).status).toBe(413);
});
it("rejects missing multipart body", async () => {
  expect(
    (
      await POST(
        new Request("https://school.test/api/transcribe", {
          method: "POST",
          body: "hello",
        }),
      )
    ).status,
  ).toBe(415);
});
it("rejects incomplete multipart safely", async () => {
  const r = new Request("https://school.test/api/transcribe", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=missing" },
    body: "broken",
  });
  expect((await POST(r)).status).toBe(400);
});
it("rejects multiple recordings", async () => {
  const f = new FormData();
  f.append(
    "audio",
    new File([new Uint8Array(256)], "a", { type: "audio/webm" }),
  );
  f.append(
    "audio",
    new File([new Uint8Array(256)], "b", { type: "audio/webm" }),
  );
  expect(
    (
      await POST(
        new Request("https://school.test/api/transcribe", {
          method: "POST",
          body: f,
        }),
      )
    ).status,
  ).toBe(400);
});
it.each([401, 429, 503])(
  "rejects unavailable authentication/limit %s without provider usage",
  async (status) => {
    mock.limit.mockRejectedValue(new HttpError(status, "Safe failure"));
    expect((await POST(recording())).status).toBe(status);
    expect(mock.transcribe).not.toHaveBeenCalled();
  },
);
it("hides provider details", async () => {
  mock.transcribe.mockRejectedValue(new Error("PRIVATE RECORDING DETAIL"));
  const r = await POST(recording());
  expect(r.status).toBe(503);
  expect(JSON.stringify(await r.json())).not.toContain("PRIVATE");
});

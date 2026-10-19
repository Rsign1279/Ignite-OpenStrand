import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  setSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: { setSession: mocks.setSession, signOut: mocks.signOut },
  }),
}));
import { POST } from "@/app/api/staff/login/route";
const request = (body: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public");
  vi.stubEnv("ADMIN_EMAILS", "staff@example.org");
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.signIn.mockResolvedValue({
    error: null,
    data: {
      user: { email: "staff@example.org", is_anonymous: false },
      session: {
        access_token: "PRIVATE_ACCESS",
        refresh_token: "PRIVATE_REFRESH",
      },
    },
  });
});
it("normalizes email, validates staff authority, establishes cookie session and never returns tokens", async () => {
  const r = await POST(
    request({ email: " STAFF@EXAMPLE.ORG ", password: "correct-password" }),
  );
  expect(r.status).toBe(200);
  expect(mocks.signIn).toHaveBeenCalledWith({
    email: "staff@example.org",
    password: "correct-password",
  });
  expect(mocks.setSession).toHaveBeenCalledWith({
    access_token: "PRIVATE_ACCESS",
    refresh_token: "PRIVATE_REFRESH",
  });
  expect(await r.json()).toEqual({ success: true });
});
it("rejects nonstaff accounts before creating a browser session", async () => {
  mocks.signIn.mockResolvedValue({
    error: null,
    data: {
      user: { email: "student@example.org" },
      session: { access_token: "PRIVATE", refresh_token: "PRIVATE" },
    },
  });
  expect(
    (
      await POST(
        request({ email: "student@example.org", password: "password" }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.setSession).not.toHaveBeenCalled();
  expect(mocks.signOut).toHaveBeenCalled();
});
it.each([
  ["invalid_credentials", 400, 401],
  ["email_provider_disabled", 422, 503],
  ["over_request_rate_limit", 429, 429],
  ["email_not_confirmed", 400, 403],
])(
  "distinguishes %s without exposing provider internals",
  async (code, status, expected) => {
    mocks.signIn.mockResolvedValue({
      data: {},
      error: { code, status, message: "PRIVATE DETAILS" },
    });
    const r = await POST(
      request({ email: "staff@example.org", password: "password" }),
    );
    expect(r.status).toBe(expected);
    expect(await r.text()).not.toContain("PRIVATE");
  },
);
it("rejects cross-origin and malformed submissions before auth", async () => {
  expect(
    (
      await POST(
        request(
          { email: "staff@example.org", password: "password" },
          "https://evil.test",
        ),
      )
    ).status,
  ).toBe(403);
  expect((await POST(request({ email: "bad", password: "" }))).status).toBe(
    400,
  );
  expect(mocks.signIn).not.toHaveBeenCalled();
});
it("reports connection failures as availability errors, not incorrect passwords", async () => {
  mocks.signIn.mockRejectedValue(new Error("PRIVATE NETWORK ERROR"));
  const r = await POST(
    request({ email: "staff@example.org", password: "password" }),
  );
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("PRIVATE");
});
it("does not claim success if the browser session cannot be established", async () => {
  mocks.setSession.mockResolvedValue({ error: new Error("PRIVATE") });
  expect(
    (await POST(request({ email: "staff@example.org", password: "password" })))
      .status,
  ).toBe(503);
});

import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  set: vi.fn(),
  getAll: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mock.create }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mock.set, getAll: mock.getAll }),
}));
import { proxy } from "@/proxy";
import { serverClient } from "@/lib/supabase/server";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public");
});
afterEach(() => vi.unstubAllEnvs());
it("preserves no-cache headers and cookie chunks across multiple SSR refresh writes", async () => {
  mock.create.mockImplementation(
    (_url, _key, options: { cookies: CookieMethodsServer }) => ({
      auth: {
        getClaims: async () => {
          await options.cookies.setAll!(
            [{ name: "sb-session.0", value: "first", options: { path: "/" } }],
            {
              "Cache-Control":
                "private, no-cache, no-store, must-revalidate, max-age=0",
              Expires: "0",
              Pragma: "no-cache",
            },
          );
          await options.cookies.setAll!(
            [{ name: "sb-session.1", value: "second", options: { path: "/" } }],
            {},
          );
        },
      },
    }),
  );
  const request = new NextRequest("http://localhost/interview");
  const response = await proxy(request);
  expect(response.headers.get("Cache-Control")).toContain(
    "private, no-cache, no-store",
  );
  expect(response.headers.get("Expires")).toBe("0");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.cookies.get("sb-session.0")?.value).toBe("first");
  expect(response.cookies.get("sb-session.1")?.value).toBe("second");
  expect(request.cookies.get("sb-session.0")?.value).toBe("first");
  expect(response.headers.get("x-middleware-request-cookie")).toContain(
    "sb-session.1=second",
  );
});
it("does not silently succeed if a login/logout route cannot write its cookies", async () => {
  mock.set.mockImplementation(() => {
    throw new Error("Cookie writes unavailable");
  });
  mock.create.mockImplementation(
    (_url, _key, options: { cookies: CookieMethodsServer }) => ({
      auth: {
        signOut: async () =>
          options.cookies.setAll!(
            [{ name: "sb-session", value: "", options: { maxAge: 0 } }],
            {},
          ),
      },
    }),
  );
  await expect(
    (await serverClient({ requireCookieWrites: true })).auth.signOut(),
  ).rejects.toThrow("Cookie writes unavailable");
  // Server component refreshes still defer writes to proxy as Next requires.
  await expect((await serverClient()).auth.signOut()).resolves.toBeUndefined();
});
it("marks server and proxy auth cookies Secure and SameSite=Lax in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  mock.create.mockReturnValue({
    auth: { getClaims: vi.fn().mockResolvedValue({}) },
  });
  await serverClient();
  await proxy(new NextRequest("https://example.org/interview"));
  for (const call of mock.create.mock.calls) {
    expect(call[2].cookieOptions).toEqual({ secure: true, sameSite: "lax" });
  }
});

import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { signInStaff } from "@/lib/staff-login-client";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
it("uses the app origin, normalizes email, and preserves exact password bytes", async () => {
  fetchMock.mockResolvedValue(Response.json({ success: true }));
  await signInStaff(" STAFF@EXAMPLE.ORG ", " exact password ");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/staff/login",
    expect.objectContaining({
      body: JSON.stringify({
        email: "staff@example.org",
        password: " exact password ",
      }),
    }),
  );
});
it("reports network failure separately from bad credentials", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  await expect(signInStaff("staff@example.org", "secret")).rejects.toThrow(
    "connection",
  );
});
it("preserves a specific safe server error", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      { error: "Staff email sign-in is unavailable" },
      { status: 503 },
    ),
  );
  await expect(signInStaff("staff@example.org", "secret")).rejects.toThrow(
    "Staff email sign-in is unavailable",
  );
});

it.each([
  ["HTML", () => new Response("<html>Login gateway</html>")],
  ["missing confirmation", () => Response.json({})],
  ["false confirmation", () => Response.json({ success: false })],
  ["server failure", () => Response.json({ success: true }, { status: 503 })],
])("does not report logout success for %s", async (_name, response) => {
  const { signOutStaff } = await import("@/lib/staff-login-client");
  fetchMock.mockResolvedValue(response());
  await expect(signOutStaff()).rejects.toThrow("before leaving this device");
});
it("confirms successful logout without caching the response", async () => {
  const { signOutStaff } = await import("@/lib/staff-login-client");
  fetchMock.mockResolvedValue(Response.json({ success: true }));
  await expect(signOutStaff()).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/staff/logout",
    expect.objectContaining({ method: "POST", cache: "no-store" }),
  );
});

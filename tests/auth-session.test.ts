import { beforeEach, expect, it, vi } from "vitest";
import { SESSION_CHANGED_MESSAGE } from "@/lib/student-session";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: { getUser: mock.getUser },
    from: mock.from,
  }),
}));
import { requireStudent } from "@/lib/auth";
const studentA = "11111111-1111-4111-8111-111111111111";
const studentB = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({
    data: { user: { id: studentA, is_anonymous: true } },
    error: null,
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mock.single,
  };
  mock.from.mockReturnValue(query);
  mock.single.mockResolvedValue({
    data: { name: "Student A", strand: "education", ignite_year: 1 },
    error: null,
  });
});
it("binds student work to the verified session, not a mutable shared browser cookie", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: studentB, is_anonymous: true } },
    error: null,
  });
  await expect(
    requireStudent(
      new Request("http://localhost/api/interview/evaluate", {
        headers: { "X-Student-Session": studentA },
      }),
    ),
  ).rejects.toMatchObject({ status: 409, message: SESSION_CHANGED_MESSAGE });
  expect(mock.from).not.toHaveBeenCalled();
});
it("rejects unpinned student requests before reading a profile", async () => {
  await expect(
    requireStudent(new Request("http://localhost/api/transcribe")),
  ).rejects.toMatchObject({ status: 409 });
  expect(mock.from).not.toHaveBeenCalled();
});
it("permits a pinned matching anonymous student and uses its server profile", async () => {
  const auth = await requireStudent(
    new Request("http://localhost/api/interview/evaluate", {
      headers: { "X-Student-Session": studentA },
    }),
  );
  expect(auth.user.id).toBe(studentA);
  expect(auth.profile.name).toBe("Student A");
});
it("an identity header cannot authorize a missing or permanent session", async () => {
  const request = new Request("http://localhost/api/interview/evaluate", {
    headers: { "X-Student-Session": studentA },
  });
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("expired"),
  });
  await expect(requireStudent(request)).rejects.toMatchObject({ status: 401 });
  mock.getUser.mockResolvedValue({
    data: { user: { id: studentA, is_anonymous: false } },
    error: null,
  });
  await expect(requireStudent(request)).rejects.toMatchObject({ status: 403 });
  expect(mock.from).not.toHaveBeenCalled();
});

it("profile creation rejects a stale identity before persisting a student's name", async () => {
  const { POST } = await import("@/app/api/profile/route");
  mock.getUser.mockResolvedValue({
    data: { user: { id: studentB, is_anonymous: true } },
    error: null,
  });
  const response = await POST(
    new Request("http://localhost/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Student-Session": studentA,
      },
      body: JSON.stringify({
        name: "Student A",
        strand: "education",
        ignite_year: 1,
      }),
    }),
  );
  expect(response.status).toBe(409);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mock.from).not.toHaveBeenCalled();
});
it("profile recovery pins only the server-authenticated identity in its response", async () => {
  const { GET } = await import("@/app/api/profile/route");
  mock.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mock.single,
  });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Student-Session")).toBe(studentA);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    name: "Student A",
    strand: "education",
    ignite_year: 1,
  });
});

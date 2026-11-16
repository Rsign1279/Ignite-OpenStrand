import { beforeEach, expect, it, vi } from "vitest";
import { STUDENT_SESSION_HEADER } from "@/lib/student-session";
const mock = vi.hoisted(() => ({
  server: vi.fn(),
  from: vi.fn(),
  user: vi.fn(),
  limit: vi.fn(),
  structured: vi.fn(),
  transcribe: vi.fn(),
  save: vi.fn(),
  record: vi.fn(),
  find: vi.fn(),
  validatePre: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ serverClient: mock.server }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mock.limit }));
vi.mock("@/lib/ai/provider", () => ({
  ai: { structured: mock.structured, transcribe: mock.transcribe },
}));
vi.mock("@/lib/learning", () => ({
  saveAssessment: mock.save,
  saveTransfer: mock.save,
  recordAttempt: mock.record,
  findRecordedAssessment: mock.find,
  findRecordedAssessmentWithMetadata: mock.find,
  validatePreQuestion: mock.validatePre,
}));
import { POST as evaluate } from "@/app/api/interview/evaluate/route";
import { POST as transcribe } from "@/app/api/transcribe/route";
import { POST as question } from "@/app/api/interview/transfer-question/route";
import { POST as transfer } from "@/app/api/interview/transfer-evaluate/route";
const currentStudent = "22222222-2222-4222-8222-222222222222";
const previousStudent = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({
    data: { user: { id: currentStudent, is_anonymous: true } },
    error: null,
  });
  mock.server.mockResolvedValue({
    auth: { getUser: mock.user },
    from: mock.from,
  });
});
for (const [path, handler] of [
  ["interview/evaluate", evaluate],
  ["transcribe", transcribe],
  ["interview/transfer-question", question],
  ["interview/transfer-evaluate", transfer],
] as const) {
  it.each([undefined, previousStudent])(
    `${path} rejects an unbound or previous student's submission before body, quota, profile, AI or storage access (%s)`,
    async (identity) => {
      const request = new Request(`https://school.test/api/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://school.test",
          ...(identity ? { [STUDENT_SESSION_HEADER]: identity } : {}),
        },
        body: JSON.stringify({
          transcript: "Previous student's private answer",
        }),
      });
      const response = await handler(request);
      expect(response.status).toBe(409);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).not.toContain(currentStudent);
      expect(request.bodyUsed).toBe(false);
      expect(mock.user).toHaveBeenCalledOnce();
      for (const blocked of [
        mock.from,
        mock.limit,
        mock.structured,
        mock.transcribe,
        mock.save,
        mock.record,
        mock.find,
        mock.validatePre,
      ])
        expect(blocked).not.toHaveBeenCalled();
    },
  );
}

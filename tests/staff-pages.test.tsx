import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/analytics/data", () => ({ loadAttempts: mocks.load }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("@/components/staff/chart-loader", () => ({
  ProgramCharts: () => null,
  StudentCharts: () => null,
}));
import Dashboard from "@/app/staff/dashboard/page";
import Student from "@/app/staff/student/[id]/page";
import Raw from "@/app/staff/page";
import type { Attempt } from "@/lib/analytics/model";
const id = "11111111-1111-4111-8111-111111111111";
const row: Attempt = {
  id,
  student_id: id,
  student_name: "Student One",
  strand: "education",
  question_id: "q1",
  question_text: "Tell me about a time a plan did not work.",
  attempt_number: 1,
  total_score: 6,
  scores: {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 1,
    professionalCommunication: 2,
  },
  created_at: "2026-10-19T12:00:00Z",
  stage: "pre",
  answer_text: "PRIVATE STUDENT ANSWER <script>bad</script>",
  feedback_text: "PRIVATE AI FEEDBACK",
  is_legacy: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.load.mockImplementation(async (_id?: string, includeText?: boolean) =>
    includeText
      ? [row]
      : [{ ...row, answer_text: undefined, feedback_text: undefined }],
  );
});
it("server-renders overview aggregates without answer content", async () => {
  const html = renderToStaticMarkup(
    await Dashboard({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain("Active students");
  expect(html).toContain("Practiced once");
  expect(html).not.toContain("PRIVATE");
  expect(html).toContain(`/staff/student/${id}`);
});
it("server-renders verbatim student detail with escaped AI/student text", async () => {
  const html = renderToStaticMarkup(
    await Student({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(
    "PRIVATE STUDENT ANSWER &lt;script&gt;bad&lt;/script&gt;",
  );
  expect(html).toContain("PRIVATE AI FEEDBACK");
  expect(html).toContain("0 of");
  expect(html).toContain("Latest");
  expect(mocks.load).toHaveBeenCalledWith(id, true);
});
it("preserves raw attempts with derived columns", async () => {
  const html = renderToStaticMarkup(
    await Raw({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain("Every scored attempt.");
  expect(html).toContain("PRIVATE STUDENT ANSWER");
  expect(html).toContain("Export CSV");
});
it("gates server pages before any privileged load", async () => {
  mocks.auth.mockRejectedValue(new Error("Not staff"));
  await expect(
    Dashboard({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("REDIRECT:/staff/login");
  expect(mocks.load).not.toHaveBeenCalled();
});
it("rejects invalid student IDs before data loading", async () => {
  await expect(
    Student({
      params: Promise.resolve({ id: "bad" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NOT_FOUND");
  expect(mocks.load).not.toHaveBeenCalled();
});

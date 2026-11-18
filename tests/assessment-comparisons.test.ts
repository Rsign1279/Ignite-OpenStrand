import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({ rpc: mocks.rpc }),
}));
import {
  findRecordedComparison,
  saveRecordedComparison,
} from "@/lib/assessment-comparisons";
import { getScoringVersion } from "@/lib/ai/scoring-config";
const comparison = {
  improvements: [
    "Your role is clearer.",
    "You connected an action to the result.",
  ],
  nextStep: "Explain what you learned.",
};
beforeEach(() => vi.clearAllMocks());
it("reads only the authenticated student's exact pre/post pair", async () => {
  mocks.rpc.mockResolvedValue({ data: comparison, error: null });
  expect(await findRecordedComparison("student", "post", "pre")).toEqual(
    comparison,
  );
  expect(mocks.rpc).toHaveBeenCalledWith("find_interview_comparison", {
    p_student_id: "student",
    p_post_attempt_id: "post",
    p_pre_attempt_id: "pre",
  });
});
it("returns a cache miss when no comparison has been saved", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect(await findRecordedComparison("student", "post", "pre")).toBeNull();
});
it("returns the stored first result instead of another model response on a retry", async () => {
  mocks.rpc.mockResolvedValue({ data: comparison, error: null });
  const another = {
    ...comparison,
    improvements: ["Another result.", "Another observation."],
  };
  expect(
    await saveRecordedComparison("student", "post", "pre", another),
  ).toEqual(comparison);
  expect(mocks.rpc).toHaveBeenCalledWith("record_interview_comparison", {
    p_student_id: "student",
    p_post_attempt_id: "post",
    p_pre_attempt_id: "pre",
    p_comparison: another,
    p_review_version: getScoringVersion(),
  });
});
it.each(["23505", "23514", "23503", "22023"])(
  "maps a pair-integrity conflict safely (%s)",
  async (code) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE DATABASE DETAILS" },
    });
    await expect(
      findRecordedComparison("student", "post", "pre"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveRecordedComparison("student", "post", "pre", comparison),
    ).rejects.not.toThrow("PRIVATE");
  },
);
it("does not return corrupt stored output or disguise storage failures as successful feedback", async () => {
  mocks.rpc.mockResolvedValue({
    data: { ...comparison, scores: { task: 3 } },
    error: null,
  });
  await expect(
    findRecordedComparison("student", "post", "pre"),
  ).rejects.toMatchObject({ status: 503 });
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "NETWORK" } });
  await expect(
    saveRecordedComparison("student", "post", "pre", comparison),
  ).rejects.toMatchObject({ status: 503 });
});
it("rejects malformed comparison input before storage", async () => {
  await expect(
    saveRecordedComparison("student", "post", "pre", {
      ...comparison,
      improvements: ["Only one"],
    }),
  ).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

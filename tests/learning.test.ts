import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  adminClient: () => ({ from: mocks.from }),
}));
import { saveAssessment, saveTransfer } from "@/lib/learning";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockResolvedValue({ error: null });
});
it("stores rubric values only, omitting free-text feedback", async () => {
  const scores = {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 3,
    professionalCommunication: 2,
  };
  await saveAssessment("student", "post", {
    scores,
    total: 8,
    strongestPart: "PRIVATE",
    improvementArea: "PRIVATE",
  });
  expect(mocks.from).toHaveBeenCalledWith("learning_results");
  expect(mocks.upsert).toHaveBeenCalledWith({
    user_id: "student",
    post_scores: scores,
    updated_at: expect.any(String),
  });
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain("PRIVATE");
});
it("stores transfer indicators and completion without the observation", async () => {
  await saveTransfer("student", {
    situation: true,
    task: false,
    action: true,
    result: false,
    observation: "PRIVATE",
  });
  expect(mocks.upsert).toHaveBeenCalledWith({
    user_id: "student",
    transfer_star: {
      situation: true,
      task: false,
      action: true,
      result: false,
    },
    updated_at: expect.any(String),
    completed_at: expect.any(String),
  });
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain("PRIVATE");
});
it("fails safely if storage is unavailable", async () => {
  mocks.upsert.mockResolvedValue({ error: { message: "PRIVATE DB ERROR" } });
  await expect(
    saveTransfer("student", {
      situation: true,
      task: true,
      action: true,
      result: true,
      observation: "PRIVATE",
    }),
  ).rejects.toThrow("could not be saved");
});

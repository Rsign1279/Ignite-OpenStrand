import { describe, expect, it } from "vitest";
import { buildEvidenceComparison } from "@/lib/evidence-comparison";
import { comparisonSchema } from "@/lib/validation";

const before =
  "In our class council simulation, two groups disagreed about a crossing proposal. I listened to both groups and helped write a summary. We finished a recommendation, and I learned to listen before deciding.";
const after =
  "During a class mock council meeting, our group was comparing a proposed street crossing. I was responsible for recording access concerns before we chose our recommendation. One teammate worried about losing parking while another wanted a shorter crossing. I asked each person to explain who their option would affect, put both concerns in a shared comparison table, and read my summaries back so they could correct them. I kept the facts we had researched separate from my own opinion. Both teammates confirmed that the notes represented their views, and our group used the table to agree on a crossing proposal with an alternative parking suggestion. I learned to check that I have represented a viewpoint fairly before arguing for a solution.";
const nextStep = "Explain the task or goal you took responsibility for.";
const scores = {
  before: { situation: 3, task: 2, action: 3, result: 2 },
  after: { situation: 3, task: 3, action: 3, result: 3 },
  comparable: true as const,
};

function expectExactExcerpts(
  comparison: ReturnType<typeof buildEvidenceComparison>,
  first: string,
  retry: string,
) {
  let count = 0;
  for (const change of comparison.improvements) {
    const match = change.match(
      /First excerpt: “(.*?)” Retry excerpt: “(.*?)”/u,
    );
    if (!match) continue;
    expect(first).toContain(match[1]);
    expect(retry).toContain(match[2]);
    expect(match[1]).not.toBe(match[2]);
    count++;
  }
  return count;
}

describe("evidence-only answer comparison", () => {
  it("replaces the observed pilot13 advice defect with exact before/after evidence", () => {
    const comparison = buildEvidenceComparison(before, after, nextStep, scores);
    expectExactExcerpts(comparison, before, after);
    expect(comparison.improvements).toHaveLength(2);
    expect(comparison.improvements.join(" ")).toContain("Task: 2 → 3");
    expect(comparison.improvements.join(" ")).toContain("Result: 2 → 3");
    expect(comparison.improvements.join(" ")).not.toMatch(
      /add more|structure the answer|could you|try to|you improved|better/iu,
    );
    expect(comparison.nextStep).toBe(nextStep);
    expect(comparisonSchema.safeParse(comparison).success).toBe(true);
  });

  it("does not invent two improvements for identical answers, even if recorded scores differ", () => {
    const comparison = buildEvidenceComparison(
      before,
      before,
      nextStep,
      scores,
    );
    expect(comparison.improvements[0]).toContain("same words");
    expect(comparison.improvements[1]).toContain("Recorded score changes");
    expect(comparison.improvements.join(" ")).not.toContain("excerpt");
    expect(comparison.nextStep).toBe(nextStep);
  });

  it("does not treat transcription punctuation, capitalization or spacing as new wording", () => {
    expect(
      buildEvidenceComparison(
        "I listened. Then I checked!",
        " i LISTENED then   I checked ",
        nextStep,
      ).improvements[0],
    ).toContain("same words");
  });

  it("identifies reordered existing passages without calling them new evidence", () => {
    const comparison = buildEvidenceComparison(
      "I checked the plan. I asked for help.",
      "I asked for help. I checked the plan.",
      nextStep,
    );
    expect(comparison.improvements).toEqual([
      "The answers reuse the same passages; their order or repetition changed.",
      "No new passage was identified in the retry.",
    ]);
  });

  it("shows a short or unsuccessful retry without claiming it is an improvement", () => {
    const first = "I finished the project. My team approved the draft.";
    const retry =
      "I missed the deadline. My team could not use the unfinished draft.";
    const comparison = buildEvidenceComparison(first, retry, nextStep);
    expect(expectExactExcerpts(comparison, first, retry)).toBe(2);
    expect(comparison.improvements.join(" ")).not.toMatch(
      /stronger|improved|success|better/iu,
    );
  });

  it("keeps the saved next step and does not change the score objects", () => {
    const original = structuredClone(scores);
    const comparison = buildEvidenceComparison(before, after, nextStep, scores);
    expect(comparison.nextStep).toBe(nextStep);
    expect(scores).toEqual(original);
  });

  it("never presents incomparable score changes as comparable gains", () => {
    const comparison = buildEvidenceComparison(before, after, nextStep, {
      ...scores,
      comparable: false,
    });
    expect(comparison.improvements.join(" ")).toContain(
      "different review settings",
    );
    expect(comparison.improvements.join(" ")).not.toContain("→");
    expect(expectExactExcerpts(comparison, before, after)).toBe(2);
  });

  it("reports unchanged saved scores without pretending different wording proves growth", () => {
    const comparison = buildEvidenceComparison(before, after, nextStep, {
      ...scores,
      after: { ...scores.before },
    });
    expect(comparison.improvements.join(" ")).toContain(
      "recorded STAR scores are unchanged",
    );
    expect(comparison.improvements.join(" ")).not.toContain("improved");
  });

  it("supports meaningful short and multilingual answers using only their submitted text", () => {
    const first = "我帮助了团队。";
    const retry = "我记录了每个人的意见。";
    const comparison = buildEvidenceComparison(first, retry, nextStep);
    expect(expectExactExcerpts(comparison, first, retry)).toBe(1);
    expect(comparison.improvements[1]).toContain(
      "No second distinct wording change",
    );
  });

  it("bounds fragmented long answers while keeping every excerpt exact and within storage limits", () => {
    const first = Array.from(
      { length: 350 },
      (_, i) => `Original section ${i} was unclear.`,
    ).join(" ");
    const retry = Array.from(
      { length: 350 },
      (_, i) => `Revised section ${i} describes my actual action.`,
    ).join(" ");
    const comparison = buildEvidenceComparison(first, retry, nextStep, scores);
    expect(expectExactExcerpts(comparison, first, retry)).toBe(2);
    expect(comparisonSchema.safeParse(comparison).success).toBe(true);
  });

  it("takes excerpts from the changed end of an unpunctuated answer instead of inventing a summary", () => {
    const shared =
      "Our group reviewed the plan and discussed what we knew ".repeat(20);
    const first = `${shared}we did not choose an option`;
    const retry = `${shared}I asked for a second source before we chose an option`;
    const comparison = buildEvidenceComparison(first, retry, nextStep);
    expect(expectExactExcerpts(comparison, first, retry)).toBeGreaterThan(0);
    expect(comparison.improvements.join(" ")).toContain("second source");
    expect(comparisonSchema.safeParse(comparison).success).toBe(true);
  });

  it("does not split an astral character at the excerpt boundary into invalid JSONB text", () => {
    const first = `${"a".repeat(179)}🌟${"b".repeat(180)}`;
    const retry = `${"c".repeat(179)}🌍${"d".repeat(180)}`;
    const comparison = buildEvidenceComparison(first, retry, nextStep);
    expect(expectExactExcerpts(comparison, first, retry)).toBe(2);
    for (const change of comparison.improvements)
      expect(change).not.toMatch(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u,
      );
    expect(comparisonSchema.safeParse(comparison).success).toBe(true);
  });
});

import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Rubric } from "@/components/assessment";
import { rubric, legacyRubric } from "@/config/strands";
import {
  RUBRIC_SCORING_VERSION,
  rubricScoringGuide,
} from "@/config/rubric-anchors";
import {
  parseEvaluation,
  evaluationSchema,
  storedScoresSchema,
} from "@/lib/validation";
import { getPracticeFocus } from "@/lib/practice-learning";
import { aggregate } from "@/lib/analytics/aggregate";
import { attemptsCsv } from "@/lib/analytics/csv";
import { parseFilters, type Attempt } from "@/lib/analytics/model";

const scores = { situation: 3, task: 0, action: 2, result: 1 };
const evaluation = {
  scores,
  total: 12,
  strongestPart: "A clear setting.",
  improvementArea: "Explain your responsibility.",
};
const earlier = {
  situationTask: 2,
  personalActions: 1,
  resultImpact: 3,
  professionalCommunication: 0,
};
const filters = parseFilters(new URLSearchParams());
const attempt = (id: number, old = false): Attempt => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  student_id: "11111111-1111-4111-8111-111111111111",
  student_name: "Synthetic Student",
  strand: "technology",
  question_id: "q1",
  question_text: "Tell me about a time you worked with a team.",
  attempt_number: id,
  total_score: 6,
  scores: old ? earlier : scores,
  created_at: `2026-11-17T12:00:0${id}Z`,
  stage: "practice",
  is_legacy: false,
  // Even missing or accidentally identical version metadata cannot mix formats.
  scoring_version: "same-tag",
});

it("scores Situation and Task independently and computes only four STAR points", () => {
  expect(rubric.map((r) => r.label)).toEqual([
    "S — Situation",
    "T — Task",
    "A — Action",
    "R — Result",
  ]);
  expect(parseEvaluation(evaluation).total).toBe(6);
  expect(getPracticeFocus(evaluation)).toMatchObject({
    key: "task",
    score: 0,
    title: "Make your role clear",
  });
  const html = renderToStaticMarkup(<Rubric value={evaluation} />);
  for (const label of rubric.map((r) => r.label)) expect(html).toContain(label);
  expect(html).not.toContain("Communication");
  expect(html).not.toContain("Situation &amp; Task");
  expect(html.match(/class="rubric-row"/g)).toHaveLength(4);
});

it("rejects missing Task, extra communication scores and old output from the current AI schema", () => {
  expect(
    evaluationSchema.safeParse({
      ...evaluation,
      scores: { situation: 3, action: 2, result: 1 },
    }).success,
  ).toBe(false);
  expect(
    evaluationSchema.safeParse({
      ...evaluation,
      scores: { ...scores, communication: 3 },
    }).success,
  ).toBe(false);
  expect(
    evaluationSchema.safeParse({ ...evaluation, scores: earlier }).success,
  ).toBe(false);
  expect(storedScoresSchema.parse(earlier)).toEqual(earlier);
  expect(RUBRIC_SCORING_VERSION).toBe("ignite-star-rubric-v2");
  expect(legacyRubric.map((r) => r.key)).toContain("professionalCommunication");
});

it("uses separate observable context and responsibility anchors with communication within each element", () => {
  const situation = rubricScoringGuide.find((r) => r.key === "situation")!;
  const task = rubricScoringGuide.find((r) => r.key === "task")!;
  expect(situation.levels[0].description).toContain("setting or problem");
  expect(task.levels[0].description).toContain("personal responsibility");
  expect(task.levels[3].description).toContain(
    "distinct from the surrounding situation",
  );
  for (const entry of rubricScoringGuide)
    expect(entry.definition).toMatch(/clear/i);
});

it("does not relabel historical communication as Task or mix formats in skill averages and growth", () => {
  const data = aggregate([attempt(1, true), attempt(2)], filters);
  expect(data.rubric.map((r) => [r.key, r.score])).toEqual([
    ["situation", 3],
    ["task", 0],
    ["action", 2],
    ["result", 1],
  ]);
  expect(data.kpis.pairedQuestions).toBe(0);
  expect(data.kpis.versionChangedQuestions).toBe(1);
  expect(
    aggregate([attempt(1, true)], filters).rubric.every(
      (r) => r.score === null,
    ),
  ).toBe(true);
});

it("exports new and original scores in explicitly named, separate CSV columns", () => {
  const [header, oldRow, newRow] = attemptsCsv(
    [attempt(1, true), attempt(2)],
    filters,
  ).split("\r\n");
  const keys = header.split(",");
  const cells = (row: string) =>
    Object.fromEntries(
      row.split(",").map((value, i) => [keys[i], value.replaceAll('"', "")]),
    );
  expect(cells(oldRow)).toMatchObject({
    situation_task: "2",
    communication: "0",
    situation: "",
    task: "",
    rubric_format: "Earlier rubric",
  });
  expect(cells(newRow)).toMatchObject({
    situation_task: "",
    communication: "",
    situation: "3",
    task: "0",
    action: "2",
    result: "1",
    rubric_format: "STAR",
  });
});

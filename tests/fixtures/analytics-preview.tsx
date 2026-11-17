import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import { OverviewContent } from "@/components/staff/overview";
import { StudentCharts } from "@/components/staff/charts";
import { ReportExports } from "@/components/staff/exports";
import { aggregate, studentDetail } from "@/lib/analytics/aggregate";
import { parseFilters, type Attempt } from "@/lib/analytics/model";
const params = new URLSearchParams(location.search),
  count = Number(params.get("count") ?? 300),
  studentMode = params.has("drilldown");
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows: Attempt[] = Array.from({ length: count }, (_, i) => ({
  id: id(i + 1),
  student_id: id(1000 + Math.floor(i / 3)),
  student_name: `Practice Student ${Math.floor(i / 3) + 1}`,
  strand: (["technology", "education", "aviation"] as const)[
    Math.floor(i / 3) % 3
  ],
  question_id: "general-primary-v1",
  question_text: "Tell me about a time a plan did not go as expected.",
  attempt_number: (i % 3) + 1,
  total_score: 6 + (i % 3) * 3,
  scores: [
    {
      situation: 1,
      action: 2,
      result: 1,
      task: 2,
    },
    {
      situation: 2,
      action: 3,
      result: 2,
      task: 2,
    },
    {
      situation: 3,
      action: 3,
      result: 3,
      task: 3,
    },
  ][i % 3],
  created_at: new Date(Date.UTC(2026, 9, 1) + i * 2 * 3600000).toISOString(),
  stage: i % 3 === 0 ? "pre" : "post",
  answer_text: "A private student answer.",
  feedback_text: "A specific observation.",
  is_legacy: false,
}));
if (params.get("outcomes") === "mixed") {
  const patterns = [[6, 12, 3], [6, 9, 6], [3, 6, 9], [6]];
  rows.forEach((row, i) => {
    const score = patterns[Math.floor(i / 3) % patterns.length][i % 3] ?? 6;
    const base = Math.floor(score / 4);
    const values = Array.from(
      { length: 4 },
      (_, part) => base + (part < score % 4 ? 1 : 0),
    );
    row.total_score = score;
    row.scores = {
      situation: values[0],
      action: values[1],
      result: values[2],
      task: values[3],
    };
  });
}
if (params.get("versions") === "mixed") {
  rows.forEach((row, index) => {
    row.scoring_version = index < 2 ? "previous-method" : "current-method";
  });
}
if (params.get("rubric") === "earlier") {
  rows.forEach((row) => {
    row.scores = {
      situationTask: 1,
      personalActions: 2,
      resultImpact: 1,
      professionalCommunication: 2,
    };
    row.total_score = 6;
    row.scoring_version = "ignite-rubric-anchors-v1";
  });
}
const data = aggregate(rows, parseFilters(new URLSearchParams()));
const detail = studentDetail(rows, id(1000), data.filters);
function App() {
  return (
    <div className="studio staff-studio">
      <header className="header">
        <Link href="/" className="brand">
          IGNITE Interview Coach
        </Link>
        <span>Staff analytics preview</span>
      </header>
      <div className="staff-workspace">
        {studentMode && detail ? (
          <main id="main" className="analytics-main">
            <h1>Practice Student 1</h1>
            <ReportExports
              report={{
                title: "IGNITE Student report",
                student: true,
                filters: "All dates · Technology",
                kpis: [{ label: "Attempts", value: "3" }],
                headers: ["Question", "First", "Best"],
                rows: detail.questions.map((q) => [
                  q.question_text,
                  String(q.first_score),
                  String(q.best_score),
                ]),
              }}
              csvUrl="/api/staff/export-csv"
            />
            <StudentCharts data={detail} />
          </main>
        ) : (
          <OverviewContent data={data} />
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

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
      situationTask: 1,
      personalActions: 2,
      resultImpact: 1,
      professionalCommunication: 2,
    },
    {
      situationTask: 2,
      personalActions: 3,
      resultImpact: 2,
      professionalCommunication: 2,
    },
    {
      situationTask: 3,
      personalActions: 3,
      resultImpact: 3,
      professionalCommunication: 3,
    },
  ][i % 3],
  created_at: new Date(Date.UTC(2026, 9, 1) + i * 2 * 3600000).toISOString(),
  stage: i % 3 === 0 ? "pre" : "post",
  answer_text: "A private student answer.",
  feedback_text: "A specific observation.",
  is_legacy: false,
}));
const data = aggregate(rows, parseFilters(new URLSearchParams()));
const detail = studentDetail(rows, id(1000), data.filters);
function App() {
  return (
    <>
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
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

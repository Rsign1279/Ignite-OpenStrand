"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { Analytics, StudentDetail } from "@/lib/analytics/model";
const blue = "#245d82",
  gold = "#d2aa19",
  grid = "#d7e3ec",
  palette = [
    blue,
    "#9b6a00",
    "#6f4c9b",
    "#087d72",
    "#a84651",
    "#306b36",
    "#5e6088",
    "#924b12",
    "#1a728b",
    "#75475a",
  ];
export function ChartSkeleton() {
  return (
    <div className="chart-skeleton" role="status" aria-label="Loading chart">
      <span />
      <span />
      <span />
    </div>
  );
}
function Card({
  title,
  subtitle,
  empty,
  children,
  table,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  return (
    <section className="analytics-chart" data-pdf-chart>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {empty ? (
        <div className="chart-empty">
          <strong>No practice data yet</strong>
          <p>
            Complete an assessment or broaden the filters to see this chart.
          </p>
        </div>
      ) : (
        <>
          <div
            className="chart-scroll"
            tabIndex={0}
            role="region"
            aria-label={`${title}; scroll horizontally on smaller screens`}
          >
            <div className="chart-canvas">{children}</div>
          </div>
          <details className="chart-data">
            <summary>View chart data</summary>
            {table}
          </details>
        </>
      )}
    </section>
  );
}
function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>
                  {typeof v === "number"
                    ? Number.isInteger(v)
                      ? v
                      : v.toFixed(2)
                    : (v ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const axis = {
  tick: { fontSize: 11, fill: "#536678" },
  axisLine: false,
  tickLine: false,
};
export function ProgramCharts({ data }: { data: Analytics }) {
  const empty = data.kpis.totalAttempts === 0;
  return (
    <div className="analytics-chart-grid">
      <Card
        title="Growth across IGNITE"
        subtitle="First and best scores, averaged equally across students. Scale: 0–12."
        empty={empty}
        table={
          <DataTable
            headers={["Strand", "First", "Best", "Students"]}
            rows={data.strands.map((s) => [
              s.name,
              s.first,
              s.best,
              s.students,
            ])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={310}>
          <BarChart
            data={data.strands}
            margin={{ top: 15, right: 15, left: 0, bottom: 80 }}
            accessibilityLayer
          >
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="name"
              {...axis}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={90}
            />
            <YAxis {...axis} domain={[0, 12]} />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar
              dataKey="first"
              name="First score"
              fill={gold}
              stroke="#886a00"
              isAnimationActive={false}
            />
            <Bar
              dataKey="best"
              name="Best score"
              fill={blue}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card
        title="The practice curve"
        subtitle="Average score at attempt 1, 2, 3, and 4+. Different students may contribute at each step."
        empty={empty}
        table={
          <DataTable
            headers={["Attempt", "Average /12", "Responses"]}
            rows={data.practice.map((p) => [p.attempt, p.score, p.count])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={310}>
          <LineChart data={data.practice} accessibilityLayer>
            <CartesianGrid stroke={grid} />
            <XAxis dataKey="attempt" {...axis} />
            <YAxis domain={[0, 12]} {...axis} />
            <Tooltip />
            <Line
              dataKey="score"
              name="Average score"
              stroke={blue}
              strokeWidth={3}
              dot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card
        title="Which skills need attention?"
        subtitle="The assessment’s four rubric categories, scored 0–3. Situation and Task are one category."
        empty={empty}
        table={
          <DataTable
            headers={["Criterion", "Average /3"]}
            rows={data.rubric.map((r) => [r.criterion, r.score])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={310}>
          <BarChart
            data={data.rubric}
            layout="vertical"
            margin={{ left: 25, right: 30 }}
            accessibilityLayer
          >
            <CartesianGrid stroke={grid} horizontal={false} />
            <XAxis type="number" domain={[0, 3]} {...axis} />
            <YAxis type="category" dataKey="criterion" width={160} {...axis} />
            <Tooltip />
            <Bar
              dataKey="score"
              name="Average /3"
              fill={blue}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card
        title="Score distribution"
        subtitle="Number of scored attempts in each band, by strand."
        empty={empty}
        table={
          <DataTable
            headers={["Strand", "0–3", "4–6", "7–9", "10–12"]}
            rows={data.distribution.map((d) => [
              d.name,
              d["0–3"],
              d["4–6"],
              d["7–9"],
              d["10–12"],
            ])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={310}>
          <BarChart
            data={data.distribution}
            margin={{ bottom: 80, right: 15 }}
            accessibilityLayer
          >
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="name"
              {...axis}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={90}
            />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip />
            <Legend verticalAlign="top" />
            {["0–3", "4–6", "7–9", "10–12"].map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="scores"
                fill={["#9aabb9", gold, "#4b8eb4", blue][i]}
                stroke="#fff"
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card
        title="Practice over time"
        subtitle="Scored attempts per week, starting Monday (UTC). Quiet weeks are included."
        empty={empty}
        table={
          <DataTable
            headers={["Week starting", "Attempts"]}
            rows={data.weeks.map((w) => [w.week, w.attempts])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={310}>
          <AreaChart data={data.weeks} accessibilityLayer>
            <CartesianGrid stroke={grid} />
            <XAxis dataKey="week" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip />
            <Area
              type="linear"
              dataKey="attempts"
              name="Attempts"
              stroke={blue}
              fill="#eaf3fa"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
export function StudentCharts({ data }: { data: StudentDetail }) {
  const questions = data.questions.map((q) => q.question_id);
  const points = data.timeline.map((p) => ({
    ...p,
    questionLabel: `Q${questions.indexOf(p.question_id) + 1}`,
  }));
  return (
    <div className="analytics-chart-grid student-chart-grid">
      <Card
        title="Every attempt, in order"
        subtitle="Each point is a scored response. Point labels and colors identify the question."
        empty={!points.length}
        table={
          <DataTable
            headers={["Question", "Date (UTC)", "Attempt", "Score /12"]}
            rows={points.map((p) => [
              p.questionLabel,
              p.at,
              p.attempt,
              p.score,
            ])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={points}
            margin={{ right: 25, top: 25 }}
            accessibilityLayer
          >
            <CartesianGrid stroke={grid} />
            <XAxis dataKey="date" {...axis} />
            <YAxis domain={[0, 12]} {...axis} />
            <Tooltip
              labelFormatter={(_, payload) => payload[0]?.payload?.at ?? ""}
            />
            <Line
              dataKey="score"
              name="Score /12"
              stroke="#9aabb9"
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <g key={payload.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={
                        palette[
                          questions.indexOf(payload.question_id) %
                            palette.length
                        ]
                      }
                    />
                    <text
                      x={cx}
                      y={(cy ?? 0) - 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill={blue}
                    >
                      {payload.questionLabel}
                    </text>
                  </g>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card
        title="Your student and their strand"
        subtitle="Rubric averages /3. Strand comparison uses the same date range and includes this student."
        empty={!points.length}
        table={
          <DataTable
            headers={["Criterion", "Student", "Strand"]}
            rows={data.rubric.map((r) => [
              r.criterion,
              r.score,
              r.strandScore ?? null,
            ])}
          />
        }
      >
        {" "}
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={data.rubric} outerRadius="65%" accessibilityLayer>
            <PolarGrid stroke={grid} />
            <PolarAngleAxis
              dataKey="criterion"
              tick={{ fontSize: 11, fill: blue }}
            />
            <PolarRadiusAxis domain={[0, 3]} tickCount={4} />
            <Tooltip />
            <Legend />
            <Radar
              dataKey="strandScore"
              name="Strand average"
              stroke="#886a00"
              strokeDasharray="5 3"
              fill={gold}
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Radar
              dataKey="score"
              name="Student"
              stroke={blue}
              fill={blue}
              fillOpacity={0.18}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

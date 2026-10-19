import Link from "next/link";
import { StudentGrowthRow } from "./student-row";
import { filterQuery } from "@/lib/analytics/model";
import { AnalyticsFilters } from "@/components/staff/filters";
import { ProgramCharts } from "@/components/staff/chart-loader";
import { ReportExports } from "@/components/staff/exports";
import { filterLabel, number, signed } from "@/components/staff/report-utils";
import { getStrand } from "@/config/strands";
import type { Analytics } from "@/lib/analytics/model";

export function OverviewContent({ data }: { data: Analytics }) {
  const filters = data.filters,
    query = filterQuery(filters);
  const kpis = [
    { label: "Active students", value: String(data.kpis.activeStudents) },
    { label: "Total attempts", value: String(data.kpis.totalAttempts) },
    { label: "Avg first score /12", value: number(data.kpis.avgFirst) },
    { label: "Avg best score /12", value: number(data.kpis.avgBest) },
    {
      label: "Avg improvement",
      value: `${signed(data.kpis.avgImprovement)} pts`,
    },
  ];
  const report = {
    title: "IGNITE · Student growth",
    filters: filterLabel(filters),
    kpis,
    headers: [
      "Student",
      "Strand",
      "Attempts",
      "First avg",
      "Best avg",
      "Improvement",
    ],
    rows: data.students.map((s) => [
      s.student_name,
      getStrand(s.strand).name,
      String(s.total_attempts),
      number(s.avg_first_score),
      number(s.avg_best_score),
      signed(s.avg_delta),
    ]),
  };
  return (
    <main id="main" className="analytics-main">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">PROGRAM OVERVIEW</span>
          <h1>See practice turn into progress.</h1>
          <p>A clear view of student growth across IGNITE.</p>
        </div>
        <ReportExports
          report={report}
          csvUrl={`/api/staff/export-csv?${query}`}
        />
      </div>
      <AnalyticsFilters filters={filters} />
      <div className="analytics-kpis">
        {kpis.map((k) => (
          <article key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </article>
        ))}
      </div>
      <p className="analytics-method">
        First and best scores are calculated per student and question within the
        selected dates, then averaged equally across students. Best-minus-first
        cannot be negative and can hide a declining latest score. Counts include
        scored PRE/POST responses; transfer checks are unscored. Anonymous
        registrations remain separate identities.
      </p>
      <ProgramCharts data={data} />
      <section className="table-panel">
        <div className="table-heading">
          <div>
            <span className="eyebrow">WHO NEEDS A FOLLOW-UP?</span>
            <h2>Student growth</h2>
            <p>
              Sorted by improvement. Select a name to explore their practice.
            </p>
          </div>
          <span>{data.students.length} students</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Strand</th>
                <th scope="col">Attempts</th>
                <th scope="col">First avg /12</th>
                <th scope="col">Best avg /12</th>
                <th scope="col" aria-sort="descending">
                  Improvement
                </th>
                <th scope="col">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <StudentGrowthRow
                  key={s.student_id}
                  href={`/staff/student/${s.student_id}?${query}`}
                >
                  <td>
                    <Link
                      className="student-drill-link"
                      href={`/staff/student/${s.student_id}?${query}`}
                    >
                      {s.student_name}
                    </Link>
                  </td>
                  <td>{getStrand(s.strand).name}</td>
                  <td>{s.total_attempts}</td>
                  <td>{number(s.avg_first_score)}</td>
                  <td>{number(s.avg_best_score)}</td>
                  <td>
                    <strong>{signed(s.avg_delta)} pts</strong>
                  </td>
                  <td>
                    {s.total_attempts === 1 ? (
                      <span className="warning-chip">Practiced once</span>
                    ) : s.avg_delta <= 0 ? (
                      <span className="warning-chip">No measured growth</span>
                    ) : (
                      <span className="growth-chip">Growing</span>
                    )}
                  </td>
                </StudentGrowthRow>
              ))}
            </tbody>
          </table>
        </div>
        {!data.students.length && (
          <div className="chart-empty">
            <h3>No matching assessments yet</h3>
            <p>
              Broaden your filters or invite students to complete their first
              practice.
            </p>
          </div>
        )}
      </section>
      <p className="privacy-note">
        Confidential staff view. Historical answers that were never stored are
        unavailable. Legacy timestamps indicate the last saved session update.
      </p>
    </main>
  );
}

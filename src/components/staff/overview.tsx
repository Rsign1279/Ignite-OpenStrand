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
    { label: "Avg best observed /12", value: number(data.kpis.avgBest) },
    {
      label: "Paired latest change",
      value: `${signed(data.kpis.avgLatestChange)} pts`,
    },
    {
      label: "Comparable repeat evidence",
      value: `${data.kpis.pairedStudents} / ${data.kpis.activeStudents}`,
    },
  ];
  const report = {
    title: "IGNITE · Student growth",
    filters: filterLabel(filters),
    kpis,
    methodology: `Paired latest change uses ${data.kpis.pairedQuestions} comparable repeated student-question pairs from ${data.kpis.pairedStudents} students; ${data.kpis.studentsWithoutRepeat} students have no repeat. ${data.kpis.versionChangedQuestions} pairs excluded because the rubric/model version changed. Compare first and latest within selected dates and the same scoring version, average questions per student, then weight students equally. Higher: ${data.kpis.improvedStudents}; unchanged: ${data.kpis.unchangedStudents}; lower: ${data.kpis.declinedStudents}. Historical unversioned responses are grouped together. Best observed is descriptive. These observations do not establish an app effect or real-world transfer.`,
    headers: [
      "Student",
      "Strand",
      "Attempts",
      "First avg",
      "Best observed",
      "Latest change",
    ],
    rows: data.students.map((s) => [
      s.student_name,
      getStrand(s.strand).name,
      String(s.total_attempts),
      number(s.avg_first_score),
      number(s.avg_best_score),
      signed(s.avg_latest_change),
    ]),
  };
  return (
    <main id="main" className="analytics-main">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">PROGRAM OVERVIEW</span>
          <h1>See practice turn into progress.</h1>
          <p>
            See what changed in students’ answers and where another attempt
            could help.
          </p>
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
        Latest change compares the first and most recent response to the same
        question, using only questions with at least two attempts in the
        selected dates and the same recorded rubric/model version. Changes are
        averaged across each student’s comparable questions, then equally across
        students with comparable repeat evidence. Negative and unchanged results
        remain visible. Best observed scores are shown separately and may span
        different scoring methods. Historical responses without a recorded
        version are compared together; their original scoring configuration
        cannot be verified. Anonymous registrations remain separate identities.
      </p>
      <section
        className="pilot-evidence"
        aria-labelledby="pilot-evidence-title"
      >
        <div>
          <span className="eyebrow">PILOT EVIDENCE</span>
          <h2 id="pilot-evidence-title">Growth needs a second observation.</h2>
          <p>
            {data.kpis.pairedQuestions} comparable repeated student–question{" "}
            {data.kpis.pairedQuestions === 1 ? "pair" : "pairs"} from{" "}
            {data.kpis.pairedStudents}{" "}
            {data.kpis.pairedStudents === 1 ? "student" : "students"}.{" "}
            {data.kpis.studentsWithoutRepeat}{" "}
            {data.kpis.studentsWithoutRepeat === 1
              ? "student has"
              : "students have"}{" "}
            no same-question repeat in this view.
          </p>
          {data.kpis.versionChangedQuestions > 0 && (
            <p className="scoring-method-note">
              {data.kpis.versionChangedQuestions} repeated question{" "}
              {data.kpis.versionChangedQuestions === 1
                ? "pair is"
                : "pairs are"}{" "}
              excluded from change estimates because the first and latest
              answers used different scoring methods.
            </p>
          )}
        </div>
        <dl>
          <div>
            <dt>Latest score higher</dt>
            <dd>{data.kpis.improvedStudents}</dd>
          </div>
          <div>
            <dt>Latest score unchanged</dt>
            <dd>{data.kpis.unchangedStudents}</dd>
          </div>
          <div>
            <dt>Latest score lower</dt>
            <dd>{data.kpis.declinedStudents}</dd>
          </div>
        </dl>
        <p>
          These are within-practice observations, not proof of real-world
          transfer or an effect caused by the app. Review the actual answers
          alongside scores. A new question, a later uncoached attempt, and an
          advisor’s independent review provide stronger evidence.
        </p>
      </section>
      <ProgramCharts data={data} />
      <section className="table-panel">
        <div className="table-heading">
          <div>
            <span className="eyebrow">WHO NEEDS A FOLLOW-UP?</span>
            <h2>Student growth</h2>
            <p>
              Sorted by paired latest change. Select a name to review the
              evidence.
            </p>
          </div>
          <span>{data.students.length} students</span>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Student growth table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Strand</th>
                <th scope="col">Attempts</th>
                <th scope="col">First avg /12</th>
                <th scope="col">Best observed /12</th>
                <th scope="col" aria-sort="descending">
                  Latest change
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
                    <strong>{signed(s.avg_latest_change)} pts</strong>
                  </td>
                  <td>
                    {s.total_attempts === 1 ? (
                      <span className="warning-chip">Practiced once</span>
                    ) : s.avg_latest_change === null &&
                      s.version_changed_questions > 0 ? (
                      <span className="warning-chip">
                        Scoring method changed
                      </span>
                    ) : s.avg_latest_change === null ? (
                      <span className="warning-chip">Repeat a question</span>
                    ) : s.avg_latest_change < 0 ? (
                      <span className="warning-chip">Latest score lower</span>
                    ) : s.avg_latest_change === 0 ? (
                      <span className="warning-chip">
                        Latest score unchanged
                      </span>
                    ) : (
                      <span className="growth-chip">Latest score higher</span>
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

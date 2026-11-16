import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { staffPage, pageFilters } from "@/lib/analytics/pages";
import { loadAttempts } from "@/lib/analytics/data";
import {
  studentDetail,
  rubricAverages,
  filterAttempts,
} from "@/lib/analytics/aggregate";
import { filterQuery } from "@/lib/analytics/model";
import { StaffShell } from "@/components/staff/shell";
import { AnalyticsFilters } from "@/components/staff/filters";
import { StudentCharts } from "@/components/staff/chart-loader";
import { ReportExports } from "@/components/staff/exports";
import { signed, filterLabel } from "@/components/staff/report-utils";
import { getStrand, rubric } from "@/config/strands";
export const dynamic = "force-dynamic";
export default async function Student({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await staffPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = pageFilters(await searchParams);
  const [base, mine] = await Promise.all([
    loadAttempts(),
    loadAttempts(id, true),
  ]);
  const data = studentDetail(
    [...base.filter((a) => a.student_id !== id), ...mine],
    id,
    filters,
  );
  if (!data)
    return (
      <StaffShell>
        <main id="main" className="analytics-main">
          <h1>No matching student attempts</h1>
          <p>This student has no scored attempts in the selected filters.</p>
          <AnalyticsFilters filters={filters} action={`/staff/student/${id}`} />
          <Link href="/staff/dashboard">Return to overview</Link>
        </main>
      </StaffShell>
    );
  // A name search should not turn the strand comparison into a comparison against oneself.
  const cohort = rubricAverages(
    filterAttempts(base, { ...filters, student: "", minAttempts: 1 }).filter(
      (a) => a.strand === data.student.strand,
    ),
  );
  data.rubric = data.rubric.map((r, i) => ({
    ...r,
    strandScore: cohort[i].score,
  }));
  const s = data.student,
    kpis = [
      { label: "Scored attempts", value: String(s.total_attempts) },
      { label: "Questions practiced", value: String(s.unique_questions) },
      {
        label: "Paired latest change",
        value: `${signed(s.avg_latest_change)} pts`,
      },
      {
        label: "Questions ever reaching 12/12",
        value: `${data.mastery.count} / ${data.mastery.total}`,
      },
    ],
    query = filterQuery(filters);
  const report = {
    title: `IGNITE · ${s.student_name}`,
    filters: filterLabel(filters),
    kpis,
    methodology: `Paired latest change averages first-to-latest changes across ${s.comparable_questions} comparable repeated questions within these filters. ${s.version_changed_questions} pairs are excluded because their scoring version changed. Single attempts have no change estimate. Historical unversioned responses are grouped together. Best observed is descriptive, not evidence of lasting mastery. Review actual answers and unfamiliar questions alongside scores.`,
    headers: [
      "Question",
      "Attempts",
      "First /12",
      "Best observed /12",
      "Latest /12",
      "Latest change",
    ],
    rows: data.questions.map((q, i) => [
      `Q${i + 1}: ${q.question_text}`,
      String(q.attempts_count),
      String(q.first_score),
      String(q.best_score),
      String(q.latest_score),
      q.comparison_status === "scoring_version_changed"
        ? "Method changed"
        : signed(q.latest_delta),
    ]),
    student: true,
  };
  // Only numerical chart data crosses the client boundary; verbatim answers stay in the server-rendered accordions.
  const chartData = {
    ...data,
    questions: data.questions.map((q) => ({ ...q, attempts: [] })),
  };
  return (
    <StaffShell>
      <main id="main" className="analytics-main">
        <Link href={`/staff/dashboard?${query}`} className="back-link">
          ← Program overview
        </Link>
        <div className="analytics-heading">
          <div>
            <span className="eyebrow">STUDENT GROWTH</span>
            <h1>{s.student_name}</h1>
            <p>
              {getStrand(s.strand).name} · Last active{" "}
              <time dateTime={s.last_active}>
                {new Date(s.last_active).toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                })}{" "}
                Central
              </time>
            </p>
          </div>
          <ReportExports
            report={report}
            csvUrl={`/api/staff/export-csv?id=${id}&${query}`}
          />
        </div>
        <AnalyticsFilters filters={filters} action={`/staff/student/${id}`} />
        <div className="analytics-kpis student-kpis">
          {kpis.map((k) => (
            <article key={k.label}>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
            </article>
          ))}
        </div>
        <section className="mastery-strip">
          <div>
            <span className="eyebrow">BEST OBSERVED RESPONSES</span>
            <h2>
              {data.mastery.count} of {data.mastery.total} questions reached
              12/12
            </h2>
          </div>
          <progress
            aria-label="Questions reaching 12 out of 12"
            max={data.mastery.total || 1}
            value={data.mastery.count}
          />
        </section>
        <p className="analytics-method">
          Paired latest change uses {s.comparable_questions} comparable repeated
          questions within these filters. {s.version_changed_questions} question
          pairs are excluded because the scoring method changed. A single
          attempt has no change estimate. Historical unversioned responses are
          compared together. A 12/12 records a complete response under this
          rubric; it does not establish lasting mastery or predict interview
          success. Compare the saved answers and review transfer to an
          unfamiliar question.
        </p>
        <StudentCharts data={chartData} />
        <section className="question-history">
          <span className="eyebrow">THE STORY BEHIND THE SCORES</span>
          <h2>Practice, question by question.</h2>
          {data.questions.map((q, i) => (
            <details
              className="question-accordion"
              key={q.question_id}
              open={data.questions.length === 1}
            >
              <summary>
                <span>
                  Q{i + 1} · {q.question_text}
                </span>
                <span>
                  {q.attempts_count} attempts ·{" "}
                  {q.comparison_status === "scoring_version_changed"
                    ? "Scoring method changed · no change estimate"
                    : q.latest_delta === null
                      ? "No repeat yet"
                      : `${signed(q.latest_delta)} pts first to latest`}
                </span>
              </summary>
              <p>
                First {q.first_score}/12 · Best observed {q.best_score}/12 ·
                Latest {q.latest_score}/12
              </p>
              {q.comparison_status === "scoring_version_changed" && (
                <p className="scoring-method-note">
                  The first and latest answers were reviewed with different
                  rubric/model versions. Their scores are shown descriptively;
                  the difference is excluded from growth estimates.
                </p>
              )}
              {q.attempts.map((a) => (
                <details className="attempt-accordion" key={a.id}>
                  <summary>
                    <strong>
                      Attempt {a.attempt_number} · {a.total_score}/12
                    </strong>
                    <span>
                      {a.stage.toUpperCase()} ·{" "}
                      {new Date(a.created_at).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                      })}{" "}
                      Central{a.is_legacy ? " · Legacy date" : null}
                    </span>
                  </summary>
                  <dl className="attempt-rubric">
                    {rubric.map((r) => (
                      <div key={r.key}>
                        <dt>{r.label}</dt>
                        <dd>{a.scores[r.key]} /3</dd>
                      </div>
                    ))}
                  </dl>
                  <h3>Student answer</h3>
                  <p className="verbatim">
                    {a.answer_text ??
                      "Not retained for this historical attempt."}
                  </p>
                  <h3>AI feedback</h3>
                  <p className="verbatim">
                    {a.feedback_text ??
                      "Not retained for this historical attempt."}
                  </p>
                </details>
              ))}
            </details>
          ))}
        </section>
      </main>
    </StaffShell>
  );
}

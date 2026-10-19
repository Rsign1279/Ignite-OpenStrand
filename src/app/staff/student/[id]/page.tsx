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
      { label: "Avg improvement", value: `${signed(s.avg_delta)} pts` },
      {
        label: "Questions mastered",
        value: `${data.mastery.count} / ${data.mastery.total}`,
      },
    ],
    query = filterQuery(filters);
  const report = {
    title: `IGNITE · ${s.student_name}`,
    filters: filterLabel(filters),
    kpis,
    headers: [
      "Question",
      "Attempts",
      "First /12",
      "Best /12",
      "Latest /12",
      "Improvement",
    ],
    rows: data.questions.map((q, i) => [
      `Q${i + 1}: ${q.question_text}`,
      String(q.attempts_count),
      String(q.first_score),
      String(q.best_score),
      String(q.latest_score),
      signed(q.delta),
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
            <span className="eyebrow">MASTERY</span>
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
                  {q.attempts_count} attempts · {signed(q.delta)} pts
                </span>
              </summary>
              <p>
                First {q.first_score}/12 · Best {q.best_score}/12 · Latest{" "}
                {q.latest_score}/12
              </p>
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

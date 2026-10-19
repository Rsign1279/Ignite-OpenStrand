import Link from "next/link";
import { staffPage, pageFilters } from "@/lib/analytics/pages";
import { loadAttempts } from "@/lib/analytics/data";
import { filterAttempts, studentSummaries } from "@/lib/analytics/aggregate";
import { filterQuery } from "@/lib/analytics/model";
import { StaffShell } from "@/components/staff/shell";
import { AnalyticsFilters } from "@/components/staff/filters";
import { getStrand } from "@/config/strands";
export const dynamic = "force-dynamic";
export default async function RawData({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await staffPage();
  const params = await searchParams,
    filters = pageFilters(params),
    rows = filterAttempts(await loadAttempts(undefined, true), filters),
    summaries = studentSummaries(rows),
    derived = new Map(
      summaries.flatMap((s) =>
        s.questions.map(
          (q) => [s.student_id + ":" + q.question_id, q] as const,
        ),
      ),
    ),
    query = filterQuery(filters);
  const requestedPage = Number(params.page ?? 1),
    page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    visible = rows.slice((page - 1) * 50, page * 50);
  return (
    <StaffShell active="raw">
      <main id="main" className="analytics-main">
        <div className="analytics-heading">
          <div>
            <span className="eyebrow">RAW DATA</span>
            <h1>Every scored attempt.</h1>
            <p>
              Audit the numbers behind your dashboard. CSV includes answers,
              feedback, and per-question derived columns.
            </p>
          </div>
          <a
            className="button secondary"
            href={`/api/staff/export-csv?${query}`}
          >
            Export CSV
          </a>
        </div>
        <AnalyticsFilters filters={filters} action="/staff" />
        <section className="table-panel">
          <div className="table-heading">
            <h2>{rows.length} attempts</h2>
            <Link href={`/staff/dashboard?${query}`}>
              View dashboard & PDF export
            </Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Student",
                    "Strand",
                    "Question",
                    "Attempt",
                    "Score /12",
                    "First",
                    "Best",
                    "Latest",
                    "Delta",
                    "Count",
                    "Date (UTC)",
                    "Answer & feedback",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const d = derived.get(a.student_id + ":" + a.question_id)!;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/staff/student/${a.student_id}?${query}`}>
                          {a.student_name}
                        </Link>
                      </td>
                      <td>{getStrand(a.strand).name}</td>
                      <td>{a.question_text}</td>
                      <td>
                        {a.attempt_number} ({a.stage})
                      </td>
                      <td>{a.total_score}</td>
                      <td>{d.first_score}</td>
                      <td>{d.best_score}</td>
                      <td>{d.latest_score}</td>
                      <td>+{d.delta}</td>
                      <td>{d.attempts_count}</td>
                      <td>
                        {a.created_at}
                        {a.is_legacy ? " (legacy update time)" : ""}
                      </td>
                      <td>
                        <details>
                          <summary>View response</summary>
                          <h3>Answer</h3>
                          <p className="verbatim">
                            {a.answer_text ??
                              "Not retained for this historical attempt."}
                          </p>
                          <h3>Feedback</h3>
                          <p className="verbatim">
                            {a.feedback_text ??
                              "Not retained for this historical attempt."}
                          </p>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="empty">No attempts match these filters.</p>
          )}
          <nav className="raw-pagination" aria-label="Attempt pages">
            {page > 1 && (
              <Link href={`/staff?${query}&page=${page - 1}`}>← Previous</Link>
            )}
            <span>
              Page {page} of {Math.max(1, Math.ceil(rows.length / 50))}
            </span>
            {page * 50 < rows.length && (
              <Link href={`/staff?${query}&page=${page + 1}`}>Next →</Link>
            )}
          </nav>
        </section>
      </main>
    </StaffShell>
  );
}

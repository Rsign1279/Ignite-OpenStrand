"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { StrandIcon } from "@/components/strand-icon";
import { strands, getStrand } from "@/config/strands";
import type { LearningResult } from "@/types/database";
import { rubric } from "@/config/strands";
import { totalScore } from "@/lib/validation";
import type { Profile } from "@/lib/validation";
import { profilesCsv } from "@/lib/csv";
import { browserClient } from "@/lib/supabase/browser";
import { Download, LogOut, Search, Users, ShieldCheck } from "lucide-react";
export function AdminDashboard({
  profiles,
  results = [],
}: {
  profiles: (Profile & { user_id?: string })[];
  results?: LearningResult[];
}) {
  const resultsByUser = new Map(results.map((r) => [r.user_id, r]));
  const paired = results.filter((r) => r.pre_scores && r.post_scores);
  const averageGrowth = paired.length
    ? paired.reduce(
        (sum, r) =>
          sum + totalScore(r.post_scores!) - totalScore(r.pre_scores!),
        0,
      ) / paired.length
    : null;
  const [search, setSearch] = useState("");
  const [strand, setStrand] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!strand || p.strand === strand) &&
      (!year || String(p.ignite_year) === year),
  );
  async function logout() {
    try {
      const { error } = await browserClient().auth.signOut();
      if (error) throw error;
      router.replace("/staff/login");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([profilesCsv(filtered)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ignite-registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <header className="header">
        <Brand />
        <a className="button secondary" href="/staff/dashboard">
          Growth dashboard
        </a>
        <a className="button secondary" href="/staff">
          Raw data
        </a>
        <button className="button secondary" onClick={logout}>
          <LogOut size={17} /> Logout
        </button>
      </header>
      <main id="main" className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ADVISOR DASHBOARD</span>
            <h1>A view of your cohort.</h1>
            <p>
              Student registrations and interview growth for IGNITE Professional
              Studies.
            </p>
          </div>
          <button className="button secondary" onClick={exportCsv}>
            <Download size={17} />
            Export CSV
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="stats-grid">
          <article>
            <Users size={22} />
            <span>Registered Students</span>
            <strong>{profiles.length}</strong>
          </article>
          {[1, 2].map((y) => (
            <article key={y}>
              <span>IGNITE Year {y}</span>
              <strong>
                {profiles.filter((p) => p.ignite_year === y).length}
              </strong>
              <small>Year of participation, not grade</small>
            </article>
          ))}
        </div>
        <div className="stats-grid">
          <article>
            <span>Completed interviews</span>
            <strong>{results.filter((r) => r.completed_at).length}</strong>
            <small>Transfer assessment completed</small>
          </article>
          <article>
            <span>Average score change</span>
            <strong>
              {averageGrowth === null
                ? "—"
                : `${averageGrowth >= 0 ? "+" : ""}${averageGrowth.toFixed(1)}`}
            </strong>
            <small>Points out of 12 · {paired.length} paired assessments</small>
          </article>
          <article>
            <span>Improved scores</span>
            <strong>
              {
                paired.filter(
                  (r) => totalScore(r.post_scores!) > totalScore(r.pre_scores!),
                ).length
              }{" "}
              / {paired.length}
            </strong>
            <small>Students with both assessments</small>
          </article>
        </div>
        <p>
          Scores are available for practice completed after learning tracking
          was enabled. Each registration represents one interview session;
          repeat registrations are shown separately.
        </p>
        <div className="admin-strands">
          {strands.map((s) => (
            <article key={s.id}>
              <StrandIcon name={s.icon} size={18} />
              <span>{s.shortName}</span>
              <strong>
                {profiles.filter((p) => p.strand === s.id).length}
              </strong>
            </article>
          ))}
        </div>
        <section className="table-panel">
          <div className="table-heading">
            <h2>
              Student registrations <span>{filtered.length}</span>
            </h2>
            <div className="filters">
              <label className="search">
                <Search size={17} />
                <span className="sr-only">Search by name</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students…"
                />
              </label>
              <label>
                <span className="sr-only">Filter by strand</span>
                <select
                  value={strand}
                  onChange={(e) => setStrand(e.target.value)}
                >
                  <option value="">All strands</option>
                  {strands.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shortName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by IGNITE year</span>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">All years</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Strand</th>
                  <th scope="col">IGNITE Year</th>
                  <th scope="col">Pre / 12</th>
                  <th scope="col">Post / 12</th>
                  <th scope="col">Growth</th>
                  <th scope="col">Learning detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const result = p.user_id
                    ? resultsByUser.get(p.user_id)
                    : undefined;
                  const pre = result?.pre_scores
                    ? totalScore(result.pre_scores)
                    : null;
                  const post = result?.post_scores
                    ? totalScore(result.post_scores)
                    : null;
                  const change =
                    pre !== null && post !== null ? post - pre : null;
                  return (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td>{getStrand(p.strand).name}</td>
                      <td>
                        <span className="pill">Year {p.ignite_year}</span>
                      </td>
                      <td>{pre ?? "—"}</td>
                      <td>{post ?? "—"}</td>
                      <td>
                        {change === null
                          ? "—"
                          : `${change >= 0 ? "+" : ""}${change}`}
                      </td>
                      <td>
                        {result ? (
                          <details>
                            <summary>
                              {result.completed_at
                                ? "Complete · View results"
                                : "In progress · View results"}
                            </summary>
                            <ul>
                              {rubric.map((category) => (
                                <li key={category.key}>
                                  {category.label}:{" "}
                                  {result.pre_scores?.[category.key] ?? "—"} →{" "}
                                  {result.post_scores?.[category.key] ?? "—"} /
                                  3
                                </li>
                              ))}
                            </ul>
                            {result.transfer_star && (
                              <p>
                                Transfer:{" "}
                                {Object.entries(result.transfer_star)
                                  .map(
                                    ([key, present]) =>
                                      `${key}: ${present ? "Present" : "Missing"}`,
                                  )
                                  .join(" · ")}
                              </p>
                            )}
                            {result.completed_at && (
                              <p>
                                Completed:{" "}
                                <time dateTime={result.completed_at}>
                                  {new Date(
                                    result.completed_at,
                                  ).toLocaleString()}
                                </time>
                              </p>
                            )}
                          </details>
                        ) : (
                          "No saved assessment"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="empty">No registrations match these filters.</p>
            )}
          </div>
        </section>
        <p className="privacy-note">
          <ShieldCheck size={16} /> Registration and learning data are saved.
          Authorized staff can review assessment answers and feedback in the
          growth dashboard. Recordings are never saved.
        </p>
      </main>
    </>
  );
}

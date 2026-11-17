"use client";
import { useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/shell";
import { PilotCapacity } from "@/components/staff/pilot-capacity";
import { StrandIcon } from "@/components/strand-icon";
import { strands, getStrand } from "@/config/strands";
import type { RegisteredProfile } from "@/lib/analytics/registrations";
import { type DataScope } from "@/lib/analytics/model";
import { profilesCsv } from "@/lib/csv";
import { Download, Search, Users, ShieldCheck } from "lucide-react";
export function AdminDashboard({
  profiles,
  scope = "students",
}: {
  profiles: (Omit<RegisteredProfile, "qa_cohort_id"> & {
    qa_cohort_id?: string | null;
  })[];
  scope?: DataScope;
}) {
  const scopeQuery = scope === "students" ? "" : `?scope=${scope}`;
  const [search, setSearch] = useState("");
  const [strand, setStrand] = useState("");
  const [year, setYear] = useState("");
  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!strand || p.strand === strand) &&
      (!year || String(p.ignite_year) === year),
  );
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([profilesCsv(filtered, scope !== "students")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      scope === "qa"
        ? "ignite-qa-registrations.csv"
        : "ignite-registrations.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <StaffShell active={scope === "qa" ? "qa" : "registrations"} scope={scope}>
      <main id="main" className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {scope === "qa"
                ? "SYNTHETIC QA SESSIONS"
                : "STUDENT REGISTRATIONS"}
            </span>
            <h1>
              {scope === "qa"
                ? "Pilot QA, ready to review."
                : "A view of your cohort."}
            </h1>
            <p>
              {scope === "qa"
                ? "Every marked test identity, including sessions with no submitted answers."
                : "All registrations in this view, including students with no submitted answers."}
            </p>
          </div>
          <button className="button secondary" onClick={exportCsv}>
            <Download size={17} />
            Export CSV
          </button>
        </div>
        <nav
          className="session-scope-links"
          aria-label="Registration session scope"
        >
          {(["students", "qa", "all"] as const).map((value) => (
            <Link
              key={value}
              href={value === "students" ? "/admin" : `/admin?scope=${value}`}
              aria-current={scope === value ? "page" : undefined}
            >
              {value === "students"
                ? "Students"
                : value === "qa"
                  ? "Synthetic QA"
                  : "All sessions"}
            </Link>
          ))}
        </nav>
        {scope !== "students" && (
          <p className="registration-evidence-note">
            Synthetic QA is test data, not evidence of student improvement.
          </p>
        )}
        {scope === "qa" && <PilotCapacity />}
        <div className="stats-grid">
          <article>
            <Users size={22} />
            <span>
              {scope === "qa"
                ? "QA registrations"
                : scope === "all"
                  ? "Registered identities"
                  : "Registered Students"}
            </span>
            <strong>{profiles.length}</strong>
          </article>
          {[1, 2].map((y) => (
            <article key={y}>
              <span>IGNITE Year {y}</span>
              <strong>
                {profiles.filter((p) => p.ignite_year === y).length}
              </strong>
              <small>Participation year, not grade</small>
            </article>
          ))}
        </div>
        <p className="registration-evidence-note">
          Each registration is a separate identity. The{" "}
          <Link href={`/staff/dashboard${scopeQuery}`}>growth dashboard</Link>{" "}
          compares same-question repeats.{" "}
          <Link href={`/staff${scopeQuery}`}>View every scored attempt</Link>.
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
          <p className="registration-scroll-hint">
            Scroll sideways to view all columns.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Student registrations table"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Strand</th>
                  <th scope="col">IGNITE Year</th>
                  <th scope="col">Interview history</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.user_id ?? i}>
                    <td>
                      {p.name}
                      {p.qa_cohort_id && (
                        <span className="pill qa-session-badge">
                          Synthetic QA
                        </span>
                      )}
                    </td>
                    <td>{getStrand(p.strand).name}</td>
                    <td>
                      <span className="pill">Year {p.ignite_year}</span>
                    </td>
                    <td>
                      {p.user_id ? (
                        <Link
                          href={`/staff/student/${encodeURIComponent(p.user_id)}${p.qa_cohort_id ? "?scope=qa" : scopeQuery}`}
                        >
                          View scored attempts
                          <span className="sr-only"> for {p.name}</span>
                        </Link>
                      ) : (
                        "No linked session"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="empty">No registrations match these filters.</p>
            )}
          </div>
        </section>
        <p className="privacy-note">
          <ShieldCheck size={16} /> Profiles, answers, scores, and feedback are
          saved for authorized staff. Recordings are never saved.
        </p>
      </main>
    </StaffShell>
  );
}

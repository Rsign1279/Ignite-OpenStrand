"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { StrandIcon } from "@/components/strand-icon";
import { strands, getStrand } from "@/config/strands";
import type { Profile } from "@/lib/validation";
import { profilesCsv } from "@/lib/csv";
import { browserClient } from "@/lib/supabase/browser";
import { Download, LogOut, Search, Users, ShieldCheck } from "lucide-react";
export function AdminDashboard({ profiles }: { profiles: Profile[] }) {
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
      router.replace("/staff");
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
        <button className="button secondary" onClick={logout}>
          <LogOut size={17} /> Logout
        </button>
      </header>
      <main id="main" className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ADVISOR DASHBOARD</span>
            <h1>A view of your cohort.</h1>
            <p>Student registrations for IGNITE Professional Studies.</p>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{getStrand(p.strand).name}</td>
                    <td>
                      <span className="pill">Year {p.ignite_year}</span>
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
          <ShieldCheck size={16} /> Registration data only. Interview
          recordings, responses, scores, and feedback are never stored.
        </p>
      </main>
    </>
  );
}

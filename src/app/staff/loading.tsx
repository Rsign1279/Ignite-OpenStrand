import { StaffShell } from "@/components/staff/shell";
export default function Loading() {
  return (
    <StaffShell>
      <main id="main" className="analytics-main" aria-busy="true">
        <h1>Preparing your staff view…</h1>
        <div className="analytics-kpis">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="chart-skeleton" key={i} aria-hidden="true" />
          ))}
        </div>
        <div className="analytics-chart-grid">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="chart-skeleton" key={i} aria-hidden="true" />
          ))}
        </div>
      </main>
    </StaffShell>
  );
}

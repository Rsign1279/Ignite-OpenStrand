export default function Loading() {
  return (
    <main id="main" className="analytics-main" aria-busy="true">
      <h1>Preparing your staff view…</h1>
      <div className="analytics-kpis">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="chart-skeleton" key={i} />
        ))}
      </div>
      <div className="analytics-chart-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            className="chart-skeleton"
            key={i}
            role="status"
            aria-label="Loading chart"
          />
        ))}
      </div>
    </main>
  );
}

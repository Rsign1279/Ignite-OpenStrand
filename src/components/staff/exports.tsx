"use client";
import { useState } from "react";
export type PdfReport = {
  title: string;
  filters: string;
  kpis: { label: string; value: string }[];
  headers: string[];
  rows: string[][];
  student?: boolean;
};
export function ReportExports({
  report,
  csvUrl,
}: {
  report: PdfReport;
  csvUrl: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="report-actions">
      <a className="button secondary" href={csvUrl}>
        Export CSV
      </a>
      <button
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { downloadPdf } = await import("@/lib/analytics/pdf");
            await downloadPdf(report);
          } catch {
            setError(
              "PDF export failed. Please wait for charts to load and try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing PDF…" : "Export dashboard PDF"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";
import { StaffShell } from "@/components/staff/shell";
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <StaffShell>
      <main id="main" className="analytics-main">
        <h1>We couldn’t load this staff view.</h1>
        <p>
          Check your filters and connection, then retry. Staff access is
          required.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <a className="button secondary" href="/staff/dashboard">
          Reset filters
        </a>
      </main>
    </StaffShell>
  );
}

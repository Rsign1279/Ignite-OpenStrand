"use client";
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="analytics-main">
      <h1>We couldn’t load this staff view.</h1>
      <p>
        Check the date range and connection, then try again. Interview data is
        available only to authorized staff.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a className="button secondary" href="/staff/dashboard">
        Reset filters
      </a>
    </main>
  );
}

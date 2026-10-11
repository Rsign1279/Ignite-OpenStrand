"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="staff-main">
      <section className="focus-card">
        <h1>We couldn’t load this page.</h1>
        <p>
          Please try again. Your interview content has not been stored in our
          database.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

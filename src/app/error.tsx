"use client";
import Link from "next/link";
import { Header } from "@/components/brand";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="studio">
      <Header />
      <main id="main" className="staff-main">
        <section className="focus-card">
          <span className="eyebrow">LET’S GET YOU BACK</span>
          <h1>We couldn’t load this page.</h1>
          <p>
            Try loading it again, or return to IGNITE to find your next step.
          </p>
          <button className="button primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="button secondary">
            Back to IGNITE
          </Link>
        </section>
      </main>
    </div>
  );
}

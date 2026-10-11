import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="staff-main">
      <section className="focus-card">
        <h1>This page isn’t here.</h1>
        <Link href="/" className="button primary">
          Back to IGNITE
        </Link>
      </section>
    </main>
  );
}

import Link from "next/link";
import { Header } from "@/components/brand";
export default function NotFound() {
  return (
    <div className="studio">
      <Header />
      <main id="main" className="staff-main">
        <section className="focus-card">
          <h1>This page isn’t here.</h1>
          <p>Return to the studio to begin.</p>
          <Link href="/" className="button primary">
            Back to IGNITE
          </Link>
        </section>
      </main>
    </div>
  );
}

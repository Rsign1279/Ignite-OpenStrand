import Link from "next/link";
import { Flame, ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="IGNITE Interview Coach home">
      <span className="brand-mark">
        <Flame size={25} strokeWidth={2.3} />
      </span>
      <span>
        IGNITE<span className="brand-sub">INTERVIEW COACH</span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/staff" className="staff-link">
          Staff Login <ArrowUpRight size={15} />
        </Link>
      </nav>
    </header>
  );
}

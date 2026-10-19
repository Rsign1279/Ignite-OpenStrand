import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="IGNITE Interview Coach home">
      <span className="brand-logo">
        <Image
          src="/ignite-logo.png"
          width={200}
          height={200}
          sizes="200px"
          loading="eager"
          alt="IGNITE — real, relevant learning"
        />
      </span>
      <span className="brand-sub">
        INTERVIEW
        <br />
        COACH
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
        <Link href="/staff/login" className="staff-link">
          Staff Login <ArrowUpRight size={15} />
        </Link>
      </nav>
    </header>
  );
}

import Link from "next/link";
import { Brand } from "@/components/brand";
import { StaffLogout } from "./staff-logout";
export function StaffShell({
  children,
  active = "overview",
}: {
  children: React.ReactNode;
  active?: "overview" | "raw" | "registrations";
}) {
  return (
    <>
      <header className="header">
        <Brand />
        <StaffLogout />
      </header>
      <div className="staff-workspace">
        <nav className="staff-tabs" aria-label="Staff views">
          <Link
            href="/staff/dashboard"
            aria-current={active === "overview" ? "page" : undefined}
          >
            Overview
          </Link>
          <Link
            href="/staff"
            aria-current={active === "raw" ? "page" : undefined}
          >
            Raw data
          </Link>
          <Link
            href="/admin"
            aria-current={active === "registrations" ? "page" : undefined}
          >
            Registrations
          </Link>
        </nav>
        {children}
      </div>
    </>
  );
}

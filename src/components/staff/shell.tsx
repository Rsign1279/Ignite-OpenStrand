import Link from "next/link";
import { LayoutDashboard, ListChecks, ShieldCheck, Table2 } from "lucide-react";
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
    <div className="studio staff-studio">
      <header className="header">
        <Brand />
        <div className="staff-header-actions">
          <span className="staff-access-badge">
            <ShieldCheck size={15} aria-hidden="true" />
            Staff workspace
          </span>
          <StaffLogout />
        </div>
      </header>
      <div className="staff-workspace">
        <nav className="staff-tabs" aria-label="Staff views">
          <Link
            href="/staff/dashboard"
            aria-current={active === "overview" ? "page" : undefined}
          >
            <LayoutDashboard size={17} aria-hidden="true" />
            Overview
          </Link>
          <Link
            href="/staff"
            aria-current={active === "raw" ? "page" : undefined}
          >
            <Table2 size={17} aria-hidden="true" />
            Raw data
          </Link>
          <Link
            href="/admin"
            aria-current={active === "registrations" ? "page" : undefined}
          >
            <ListChecks size={17} aria-hidden="true" />
            Registrations
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}

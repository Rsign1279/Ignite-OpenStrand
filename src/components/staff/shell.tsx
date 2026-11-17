import Link from "next/link";
import {
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { StaffLogout } from "./staff-logout";
import type { DataScope } from "@/lib/analytics/model";
export function StaffShell({
  children,
  active = "overview",
  scope = "students",
}: {
  children: React.ReactNode;
  active?: "overview" | "raw" | "registrations" | "qa";
  scope?: DataScope;
}) {
  const query = scope === "students" ? "" : `?scope=${scope}`;
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
            href={`/staff/dashboard${query}`}
            aria-current={active === "overview" ? "page" : undefined}
          >
            <LayoutDashboard size={17} aria-hidden="true" />
            Overview
          </Link>
          <Link
            href={`/staff${query}`}
            aria-current={active === "raw" ? "page" : undefined}
          >
            <Table2 size={17} aria-hidden="true" />
            Raw data
          </Link>
          <Link
            href={`/admin${query}`}
            aria-current={active === "registrations" ? "page" : undefined}
          >
            <ListChecks size={17} aria-hidden="true" />
            Registrations
          </Link>
          <Link
            href="/admin?scope=qa"
            aria-current={active === "qa" ? "page" : undefined}
          >
            <FlaskConical size={17} aria-hidden="true" />
            QA lab
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}

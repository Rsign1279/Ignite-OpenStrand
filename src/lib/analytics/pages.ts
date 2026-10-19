import "server-only";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parseFilters } from "./model";
export async function staffPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/staff/login");
  }
}
export function pageFilters(
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((s) => query.append(k, s));
    else if (v !== undefined) query.set(k, v);
  });
  return parseFilters(query);
}

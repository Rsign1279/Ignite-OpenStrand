import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { registeredProfiles } from "@/lib/analytics/registrations";
import { dataScopeSchema } from "@/lib/analytics/model";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/staff/login");
  }
  const params = await searchParams;
  const scope = dataScopeSchema.parse(params.scope ?? "students");
  return (
    <AdminDashboard profiles={await registeredProfiles(scope)} scope={scope} />
  );
}

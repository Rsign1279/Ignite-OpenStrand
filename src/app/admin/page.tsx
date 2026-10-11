import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { profileSchema, type Profile } from "@/lib/validation";
export const dynamic = "force-dynamic";
export default async function Admin() {
  try {
    await requireAdmin();
  } catch {
    redirect("/staff");
  }
  const client = adminClient();
  const profiles: Profile[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("student_profiles")
      .select("name,strand,ignite_year")
      .order("user_id")
      .range(offset, offset + 999);
    if (error) throw new Error("Unable to load registrations. Please refresh.");
    profiles.push(...data.map((p) => profileSchema.parse(p)));
    if (data.length < 1000) break;
  }
  return <AdminDashboard profiles={profiles} />;
}

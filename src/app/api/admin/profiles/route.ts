import { requireAdmin } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { failure, json } from "@/lib/http";
export async function GET() {
  try {
    await requireAdmin();
    const client = adminClient();
    const profiles: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from("student_profiles")
        .select("name,strand,ignite_year")
        .order("user_id")
        .range(offset, offset + 999);
      if (error) throw error;
      profiles.push(...data);
      if (data.length < 1000) break;
    }
    return json(profiles);
  } catch (e) {
    return failure(e);
  }
}

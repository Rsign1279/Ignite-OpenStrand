import { requireUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import { sameOrigin, readJson, failure, json, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    if (!user.is_anonymous)
      throw new HttpError(403, "Use student access to register.");
    const profile = profileSchema.parse(await readJson(request, 2000));
    const { error } = await client
      .from("student_profiles")
      .insert({ ...profile, user_id: user.id });
    if (error)
      throw new HttpError(
        400,
        "Unable to register. A profile may already exist for this session.",
      );
    return json(profile);
  } catch (e) {
    return failure(e);
  }
}
export async function GET() {
  try {
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from("student_profiles")
      .select("name,strand,ignite_year")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return failure(e);
  }
}

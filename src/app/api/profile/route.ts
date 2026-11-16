import { requireUser, requireStudentIdentity } from "@/lib/auth";
import { STUDENT_SESSION_HEADER } from "@/lib/student-session";
import { profileSchema } from "@/lib/validation";
import { sameOrigin, readJson, failure, json, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await requireUser();
    if (!user.is_anonymous)
      throw new HttpError(403, "Use student access to register.");
    requireStudentIdentity(request, user.id);
    const profile = profileSchema.parse(await readJson(request, 2000));
    const { error } = await client
      .from("student_profiles")
      .insert({ ...profile, user_id: user.id });
    if (error)
      throw new HttpError(
        400,
        "Unable to register. A profile may already exist for this session.",
      );
    const response = json(profile);
    response.headers.set(STUDENT_SESSION_HEADER, user.id);
    return response;
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
    const response = json(data);
    response.headers.set(STUDENT_SESSION_HEADER, user.id);
    return response;
  } catch (e) {
    return failure(e);
  }
}

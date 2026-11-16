import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import {
  STUDENT_SESSION_HEADER,
  SESSION_CHANGED_MESSAGE,
} from "@/lib/student-session";
export function isAdmin(
  user: { email?: string; is_anonymous?: boolean },
  allowlist = process.env.ADMIN_EMAILS ?? "",
) {
  return (
    !user.is_anonymous &&
    !!user.email &&
    allowlist
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(user.email.toLowerCase())
  );
}
export async function requireUser() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  return { client, user: data.user };
}
export async function requireAdmin() {
  const auth = await requireUser();
  if (!isAdmin(auth.user))
    throw new HttpError(403, "Staff access is not authorized.");
  return auth;
}
export function requireStudentIdentity(request: Request, userId: string) {
  if (request.headers.get(STUDENT_SESSION_HEADER) !== userId)
    throw new HttpError(409, SESSION_CHANGED_MESSAGE);
}
export async function requireStudent(request: Request) {
  const auth = await requireUser();
  if (!auth.user.is_anonymous)
    throw new HttpError(403, "Start a student session to continue.");
  requireStudentIdentity(request, auth.user.id);
  const { data, error } = await auth.client
    .from("student_profiles")
    .select("name,strand,ignite_year")
    .eq("user_id", auth.user.id)
    .single();
  if (error || !data)
    throw new HttpError(403, "Complete your student profile first.");
  return { ...auth, profile: data };
}

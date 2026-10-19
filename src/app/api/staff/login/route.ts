import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { sameOrigin, readJson, json, failure, HttpError } from "@/lib/http";
const credentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(512),
  })
  .strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const credentials = credentialsSchema.parse(await readJson(request, 4096));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw new HttpError(
        503,
        "Staff sign-in is temporarily unavailable. Please try again shortly.",
      );
    // Authenticate on the server. The response contains no token payload; Supabase installs the session in cookies.
    // Supabase Auth enforces its own sign-in rate limits.
    const verifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.signInWithPassword(credentials);
    if (error) {
      if (error.code === "invalid_credentials")
        throw new HttpError(
          401,
          "Email or password wasn’t accepted. Use the new password from your private password file.",
        );
      if (error.status === 429 || error.code?.includes("rate_limit"))
        throw new HttpError(
          429,
          "Too many sign-in attempts. Wait a moment and try again.",
        );
      if (error.code === "email_not_confirmed")
        throw new HttpError(
          403,
          "This staff account needs email confirmation. Please contact your program administrator.",
        );
      throw new HttpError(
        503,
        "Staff email sign-in is temporarily unavailable. Your password is still entered; please try again shortly.",
      );
    }
    if (!data.user || !data.session)
      throw new HttpError(
        503,
        "Staff sign-in could not be completed. Please try again.",
      );
    if (!isAdmin(data.user)) {
      await verifier.auth.signOut({ scope: "local" });
      throw new HttpError(
        403,
        "This account does not have staff access. Use your authorized staff email.",
      );
    }
    const client = await serverClient();
    const { error: sessionError } = await client.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (sessionError) {
      await verifier.auth.signOut({ scope: "local" });
      throw new HttpError(
        503,
        "We couldn’t establish your staff session. Please try again.",
      );
    }
    return json({ success: true });
  } catch (error) {
    if (error instanceof HttpError || error instanceof z.ZodError)
      return failure(error);
    return failure(
      new HttpError(
        503,
        "We couldn’t connect to staff sign-in. Your password is still entered; please try again.",
      ),
    );
  }
}

import { serverClient } from "@/lib/supabase/server";
import { sameOrigin, json, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const client = await serverClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new HttpError(
        503,
        "We couldn’t sign you out. Please try again before leaving this device.",
      );
    return json({ success: true });
  } catch (error) {
    return failure(
      error instanceof HttpError
        ? error
        : new HttpError(503, "We couldn’t sign you out. Please try again."),
    );
  }
}

import type { Database } from "@/types/database";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return response;
  const pendingCookies = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const pendingHeaders = new Headers();
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, headers) => {
          values.forEach((cookie) => {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          });
          // SSR sends required no-cache headers only on its first cookie write.
          // Preserve these and all cookie chunks if it writes again this request.
          Object.entries(headers).forEach(([name, value]) =>
            pendingHeaders.set(name, value),
          );
          response = NextResponse.next({ request });
          pendingCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          pendingHeaders.forEach((value, name) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );
  await client.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/interview/:path*",
    "/admin/:path*",
    "/staff/:path*",
    "/api/:path*",
  ],
};

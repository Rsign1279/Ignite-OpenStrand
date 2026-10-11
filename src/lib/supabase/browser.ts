"use client";
import type { Database } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Student access is not configured yet. Please contact your advisor.",
    );
  return createBrowserClient<Database>(url, key);
}

// Run with the deployment's public Supabase configuration, for example:
// node --env-file=.env.local scripts/verify-student-access.mjs
// This checks availability without creating accounts or printing API keys.
import { lookup } from "node:dns/promises";

try {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configuredUrl || !key)
    throw new Error("Public Supabase URL and publishable key are required.");
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use the project's HTTPS API URL without credentials.");

  try {
    await lookup(url.hostname);
  } catch {
    throw new Error(
      "The configured Supabase hostname does not resolve. Check the project's active status and deployment URL before releasing student access.",
    );
  }

  const response = await fetch(new URL("/auth/v1/health", url), {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `Student authentication is unavailable (HTTP ${response.status}). Check project health and the deployment's public key.`,
    );

  console.log(
    "PASS: The configured student authentication service is reachable.",
  );
  console.log(
    "This does not verify signup or profile persistence. Complete a real synthetic-student signup before declaring registration ready.",
  );
} catch (error) {
  console.error(
    "FAIL: " +
      (error instanceof Error &&
      ["Error", "TypeError"].includes(error.name) &&
      !error.message.includes("fetch failed")
        ? error.message
        : "Student authentication could not be reached. Check project status and network availability."),
  );
  process.exitCode = 1;
}

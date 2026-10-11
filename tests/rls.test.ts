import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("migration enforces own-user anonymous RLS and minimal columns", () => {
  const sql = readFileSync(
    "supabase/migrations/202610110001_profiles.sql",
    "utf8",
  );
  expect(sql).toContain("enable row level security");
  expect(sql.match(/auth.uid\(\)/g)).toHaveLength(2);
  expect(sql.match(/is_anonymous/g)).toHaveLength(2);
  expect(sql).toContain("grant select, insert");
  expect(sql).not.toMatch(/grant.*(?:update|delete)/i);
  expect(sql).not.toMatch(
    /transcript text|score integer|audio text|email text/,
  );
});

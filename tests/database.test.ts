import { PGlite } from "@electric-sql/pglite";
import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("PostgreSQL RLS isolates students, blocks impersonation and permits privileged profile reads", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$; grant usage on schema auth,public to authenticated,service_role; grant execute on all functions in schema auth to authenticated; insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610110001_profiles.sql", "utf8"),
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); select set_config('request.jwt.claims','{"is_anonymous":true}',false); insert into public.student_profiles values ('11111111-1111-4111-8111-111111111111','First','education',1);`,
    );
    expect(
      (await db.query("select * from public.student_profiles")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into public.student_profiles values ('22222222-2222-4222-8222-222222222222','Wrong','technology',2)`,
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec(
      `select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);`,
    );
    expect(
      (await db.query("select * from public.student_profiles")).rows,
    ).toHaveLength(0);
    await db.exec(
      `insert into public.student_profiles values ('22222222-2222-4222-8222-222222222222','Second','technology',2)`,
    );
    expect(
      (
        await db.query<{ name: string }>(
          "select name from public.student_profiles",
        )
      ).rows,
    ).toEqual([{ name: "Second" }]);
    await expect(
      db.exec(`update public.student_profiles set name='Changed'`),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `select set_config('request.jwt.claims','{"is_anonymous":false}',false);`,
    );
    expect(
      (await db.query("select * from public.student_profiles")).rows,
    ).toHaveLength(0);
    await db.exec("reset role; set role service_role;");
    expect(
      (
        await db.query(
          "select name,strand,ignite_year from public.student_profiles",
        )
      ).rows,
    ).toHaveLength(2);
  } finally {
    await db.close();
  }
}, 15000);

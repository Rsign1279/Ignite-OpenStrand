import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("preserves profiles while allowing only privileged tooling to set the QA marker", async () => {
  const db = new PGlite();
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  const third = "33333333-3333-4333-8333-333333333333";
  const cohort = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$; grant usage on schema auth,public to authenticated,service_role; grant execute on all functions in schema auth to authenticated; insert into auth.users values ('${first}'),('${second}'),('${third}');`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610110001_profiles.sql", "utf8"),
    );
    await db.exec(
      `insert into student_profiles(user_id,name,strand,ignite_year) values ('${first}','Existing learner','aviation',2);`,
    );
    const before = (
      await db.query("select to_jsonb(p) as profile from student_profiles p")
    ).rows;
    const migrations = readdirSync("supabase/migrations").filter((path) =>
      path.endsWith("_qa_cohort_metadata.sql"),
    );
    expect(migrations).toHaveLength(1);
    await db.exec(readFileSync("supabase/migrations/" + migrations[0], "utf8"));
    expect(
      (
        await db.query(
          "select to_jsonb(p)-'qa_cohort_id' as profile from student_profiles p",
        )
      ).rows,
    ).toEqual(before);
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${second}',false); select set_config('request.jwt.claims','{"is_anonymous":true}',false);`,
    );
    await db.exec(
      `insert into student_profiles(user_id,name,strand,ignite_year) values ('${second}','[QA] A real student name','technology',1);`,
    );
    expect(
      (await db.query("select qa_cohort_id from student_profiles")).rows,
    ).toEqual([{ qa_cohort_id: null }]);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${third}',false);`,
    );
    await expect(
      db.exec(
        `insert into student_profiles(user_id,name,strand,ignite_year,qa_cohort_id) values ('${third}','Cannot self mark','education',1,'${cohort}')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec(
        `insert into student_profiles(user_id,name,strand,ignite_year,qa_cohort_id) values ('${third}','Cannot set even null','education',1,null)`,
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${second}',false);`,
    );
    await expect(
      db.exec(`update student_profiles set qa_cohort_id='${cohort}'`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("update student_profiles set name='Changed'"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("delete from student_profiles")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(
      `reset role; set role service_role; update student_profiles set qa_cohort_id='${cohort}' where user_id='${first}';`,
    );
    expect(
      (
        await db.query(
          "select qa_cohort_id from student_profiles where user_id=$1",
          [first],
        )
      ).rows,
    ).toEqual([{ qa_cohort_id: cohort }]);
    await expect(
      db.exec("update student_profiles set name='Changed'"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from student_profiles")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
}, 15000);

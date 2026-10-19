import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("append-only attempts enforce isolation, recomputed totals, retry IDs and sequential numbering", async () => {
  const db = new PGlite();
  const first = "11111111-1111-4111-8111-111111111111",
    second = "22222222-2222-4222-8222-222222222222",
    request = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;grant usage on schema auth,public to authenticated,service_role;grant execute on all functions in schema auth to authenticated;insert into auth.users values ('${first}'),('${second}');`,
    );
    for (const path of [
      "202610110001_profiles.sql",
      "202610190001_learning_results.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + path, "utf8"));
    await db.exec(
      `insert into student_profiles values ('${first}','First','technology',1),('${second}','Second','education',2);insert into learning_results(user_id,pre_scores,post_scores) values ('${second}','{"situationTask":1,"personalActions":1,"resultImpact":1,"professionalCommunication":1}','{"situationTask":2,"personalActions":2,"resultImpact":2,"professionalCommunication":2}');`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610190002_attempt_history.sql",
        "utf8",
      ),
    );
    const legacy = await db.query<{
      total_score: number;
      answer_text: null;
      is_legacy: boolean;
    }>(
      "select total_score,answer_text,is_legacy from interview_attempts order by attempt_number",
    );
    expect(legacy.rows.map((r) => r.total_score)).toEqual([4, 8]);
    expect(
      legacy.rows.every((r) => r.answer_text === null && r.is_legacy),
    ).toBe(true);
    await db.exec("set role service_role");
    const scores = {
      situationTask: 1,
      personalActions: 2,
      resultImpact: 3,
      professionalCommunication: 2,
    };
    const args = [
      first,
      request,
      "q1",
      "A realistic question",
      "pre",
      JSON.stringify(scores),
      "PRIVATE ANSWER",
      "PRIVATE FEEDBACK",
      JSON.stringify({
        scores,
        total: 8,
        strongestPart: "Strong",
        improvementArea: "Improve",
      }),
    ];
    const call =
      "select public.record_interview_attempt($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text,$8::text,$9::jsonb)";
    await db.query(call, args);
    await db.query(call, args);
    await db.query(call, [
      first,
      "44444444-4444-4444-8444-444444444444",
      "q1",
      "A realistic question",
      "post",
      ...args.slice(5),
    ]);
    const mine = await db.query<{
      attempt_number: number;
      total_score: number;
    }>(
      "select attempt_number,total_score from interview_attempts where student_id=$1 order by attempt_number",
      [first],
    );
    expect(mine.rows).toEqual([
      { attempt_number: 1, total_score: 8 },
      { attempt_number: 2, total_score: 8 },
    ]);
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${first}',false);select set_config('request.jwt.claims','{"is_anonymous":true}',false);`,
    );
    expect(
      (await db.query("select * from interview_attempts")).rows,
    ).toHaveLength(2);
    await expect(db.query(call, args)).rejects.toThrow(/permission denied/);
    await expect(db.exec("delete from interview_attempts")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${second}',false);`,
    );
    expect(
      (await db.query("select * from interview_attempts")).rows,
    ).toHaveLength(2);
    await db.exec(
      `select set_config('request.jwt.claims','{"is_anonymous":false}',false);`,
    );
    expect(
      (await db.query("select * from interview_attempts")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 15000);

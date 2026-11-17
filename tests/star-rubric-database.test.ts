import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("preserves historical scores and securely records independent STAR scores with correct totals and retries", async () => {
  const db = new PGlite();
  const student = "11111111-1111-4111-8111-111111111111";
  const legacy = {
    situationTask: 1,
    personalActions: 2,
    resultImpact: 3,
    professionalCommunication: 2,
  };
  const star = { situation: 3, task: 0, action: 1, result: 2 };
  const call =
    "select public.record_interview_attempt($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text,$8::text,$9::jsonb)";
  const args = (n: number, scores: unknown, evaluationScores = scores) => [
    student,
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    "q1",
    "A realistic interview question",
    "practice",
    JSON.stringify(scores),
    "Synthetic answer",
    "Synthetic feedback",
    JSON.stringify({
      scores: evaluationScores,
      total: 12,
      strongestPart: "Specific",
      improvementArea: "Clear responsibility",
      scoring_version: "test-version",
    }),
  ];
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$; grant usage on schema auth,public to authenticated,service_role; grant execute on all functions in schema auth to authenticated; insert into auth.users values ('${student}');`,
    );
    for (const name of [
      "202610110001_profiles.sql",
      "202610190001_learning_results.sql",
      "202610190002_attempt_history.sql",
      "202610200001_scored_practice.sql",
      "202611160001_attempt_retry_integrity.sql",
    ])
      await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    await db.exec(
      `insert into student_profiles values ('${student}','Synthetic','technology',1); set role service_role;`,
    );
    await db.query(call, args(1, legacy));
    await db.exec("reset role");
    const before = (
      await db.query("select to_jsonb(a) as row from interview_attempts a")
    ).rows;
    await db.exec(
      readFileSync(
        "supabase/migrations/20261117193026_star_rubric.sql",
        "utf8",
      ),
    );
    const after = (
      await db.query(
        "select to_jsonb(a)-'situation'-'task'-'action'-'result' as row from interview_attempts a",
      )
    ).rows;
    expect(after).toEqual(before);
    await db.exec("set role service_role");
    await db.query(call, args(2, star));
    const stored = (
      await db.query(
        "select situation,task,action,result,situation_task,personal_actions,result_impact,communication,total_score,evaluation_json->>'total' as evaluation_total from interview_attempts where attempt_number=2",
      )
    ).rows[0];
    expect(stored).toEqual({
      ...star,
      situation_task: null,
      personal_actions: null,
      result_impact: null,
      communication: null,
      total_score: 6,
      evaluation_total: "6",
    });
    // A simultaneous retry must retain the first saved score and numbering.
    await db.query(
      call,
      args(2, { situation: 0, task: 3, action: 0, result: 0 }),
    );
    expect(
      (await db.query("select count(*)::int as count from interview_attempts"))
        .rows[0],
    ).toEqual({ count: 2 });
    const conflict = args(2, star);
    conflict[6] = "Changed answer";
    await expect(db.query(call, conflict)).rejects.toThrow(
      /Request ID conflict/,
    );
    // Old in-flight clients keep working during the deployment transition.
    await db.query(call, args(3, legacy));
    expect(
      (
        await db.query(
          "select total_score from interview_attempts where attempt_number=3",
        )
      ).rows[0],
    ).toEqual({ total_score: 8 });
    for (const bad of [
      { situation: 3, action: 1, result: 2 },
      { ...star, communication: 3 },
      { ...star, task: 4 },
      { ...star, task: null },
      { ...star, task: "2" },
      { ...star, action: 1.5 },
    ])
      await expect(db.query(call, args(4, bad))).rejects.toThrow(
        /Invalid score format/,
      );
    await expect(db.query(call, args(4, star, legacy))).rejects.toThrow(
      /Invalid score format/,
    );
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${student}',false); select set_config('request.jwt.claims','{"is_anonymous":true}',false);`,
    );
    expect(
      (await db.query("select * from interview_attempts")).rows,
    ).toHaveLength(3);
    await expect(db.query(call, args(4, star))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec("update interview_attempts set task=3"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from interview_attempts")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query(call, args(4, star))).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
}, 15000);

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const student = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const low = { situation: 1, task: 1, action: 1, result: 1 };
const high = { situation: 3, task: 2, action: 3, result: 2 };
const transfer = {
  situation: true,
  task: false,
  action: true,
  result: true,
};

async function attempt(
  n: number,
  stage: "pre" | "post" | "practice",
  scores = low,
  pre?: number,
  userId = student,
  question = "construction-teamwork-v1",
) {
  await db.query(
    "select public.record_interview_attempt($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text,$8::text,$9::jsonb)",
    [
      userId,
      id(n),
      question,
      `Synthetic interview question ${question}`,
      stage,
      JSON.stringify(scores),
      `Synthetic answer ${n}`,
      "Synthetic feedback",
      JSON.stringify({
        scores,
        total: Object.values(scores).reduce((a, b) => a + b, 0),
        strongestPart: "Personal actions",
        improvementArea: "Explain the observed outcome.",
        scoring_version: "ignite-star-rubric-v3|test-model",
        ...(pre === undefined ? {} : { pre_request_id: id(pre) }),
      }),
    ],
  );
}

const refresh = (userId = student) =>
  db.query("select public.refresh_interview_summary($1::uuid)", [userId]);
const summary = (userId = student) =>
  db.query<{
    pre_scores: unknown;
    post_scores: unknown;
    transfer_star: unknown;
    completed_at: Date | null;
    updated_at: Date;
  }>("select * from public.learning_results where user_id=$1::uuid", [userId]);

async function seedSummary(userId = student) {
  await db.query(
    "insert into public.learning_results(user_id,pre_scores,post_scores,transfer_star,completed_at,updated_at) values($1::uuid,$2::jsonb,$2::jsonb,$3::jsonb,'2026-11-01T12:00:00Z','2026-11-01T11:00:00Z')",
    [userId, JSON.stringify(low), JSON.stringify(transfer)],
  );
}

beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;grant usage on schema auth,public to authenticated,service_role;insert into auth.users values ('${student}'),('${other}');`,
  );
  for (const name of [
    "202610110001_profiles.sql",
    "202610190001_learning_results.sql",
    "202610190002_attempt_history.sql",
    "202610200001_scored_practice.sql",
    "202611160001_attempt_retry_integrity.sql",
    "20261117193026_star_rubric.sql",
    "20261117225011_assessment_comparisons.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.exec(
    `insert into public.student_profiles(user_id,name,strand,ignite_year) values ('${student}','Synthetic Construction','construction',2),('${other}','Synthetic Other','construction',2);`,
  );
}, 15000);

beforeEach(async () => {
  await db.exec(
    "reset role;truncate public.interview_comparisons,public.interview_attempts,public.learning_results;set role service_role;",
  );
});
afterAll(async () => db.close());

it("derives the latest scores from immutable history and an older replay cannot roll them back", async () => {
  await attempt(1, "pre", low);
  await attempt(2, "post", low, 1);
  await attempt(3, "pre", high);
  await attempt(4, "post", high, 3);
  await refresh();
  expect((await summary()).rows[0]).toMatchObject({
    pre_scores: high,
    post_scores: high,
  });

  // Replaying old IDs is permitted but must never replace the stored attempts.
  await attempt(1, "pre", low);
  await attempt(2, "post", low, 1);
  await refresh();
  expect((await summary()).rows[0]).toMatchObject({
    pre_scores: high,
    post_scores: high,
  });
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.interview_attempts",
      )
    ).rows[0].count,
  ).toBe(4);
});

it("preserves the transfer indicators and completed date while refreshing scored results", async () => {
  await seedSummary();
  const before = (await summary()).rows[0];
  await attempt(1, "pre", high);
  await attempt(2, "post", high, 1);
  await refresh();
  const after = (await summary()).rows[0];
  expect(after).toMatchObject({
    pre_scores: high,
    post_scores: high,
    transfer_star: transfer,
  });
  expect(after.completed_at).toEqual(before.completed_at);
  expect(after.updated_at.getTime()).toBeGreaterThan(
    before.updated_at.getTime(),
  );
});

it("does not erase an existing opposite-stage summary when that attempt history is unavailable", async () => {
  await seedSummary();
  await attempt(1, "pre", high);
  await refresh();
  expect((await summary()).rows[0]).toMatchObject({
    pre_scores: high,
    post_scores: low,
    transfer_star: transfer,
  });
});

it("does not create an empty summary or modify existing completion data without scored history", async () => {
  await refresh();
  expect((await summary()).rows).toHaveLength(0);
  await seedSummary();
  const before = (await summary()).rows[0];
  await attempt(1, "practice", high);
  await refresh();
  expect((await summary()).rows[0]).toEqual(before);
});

it("ignores newer practice results and cannot mix another student's scores into the summary", async () => {
  await attempt(1, "pre", low);
  await attempt(2, "post", low, 1);
  await attempt(3, "practice", high);
  await attempt(4, "pre", high, undefined, other);
  await attempt(5, "post", high, 4, other);
  await refresh();
  expect((await summary()).rows[0]).toMatchObject({
    pre_scores: low,
    post_scores: low,
  });
  expect((await summary(other)).rows).toHaveLength(0);
});

it("uses creation date before attempt number when latest rounds involve different questions", async () => {
  await attempt(1, "pre", low);
  await attempt(2, "pre", low);
  await attempt(3, "pre", low);
  await attempt(4, "pre", high, undefined, student, "construction-feedback-v1");
  await db.exec("reset role");
  await db.query(
    "update public.interview_attempts set created_at=case when id=$1::uuid then '2026-11-17T12:00:00Z'::timestamptz else '2026-11-16T12:00:00Z'::timestamptz end",
    [id(4)],
  );
  await db.exec("set role service_role");
  await refresh();
  expect((await summary()).rows[0].pre_scores).toEqual(high);
});

it("breaks equal-timestamp ties deterministically using attempt number then ID", async () => {
  await attempt(1, "pre", low);
  await attempt(2, "pre", high);
  await db.exec(
    "reset role;update public.interview_attempts set created_at='2026-11-17T12:00:00Z';set role service_role;",
  );
  await refresh();
  expect((await summary()).rows[0].pre_scores).toEqual(high);
});

it.each(["anon", "authenticated"])(
  "does not allow %s to invoke the refresh RPC",
  async (role) => {
    await attempt(1, "pre", high);
    await db.exec(`reset role;set role ${role}`);
    await expect(refresh()).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role service_role");
    expect((await summary()).rows).toHaveLength(0);
    await refresh();
    expect((await summary()).rows[0].pre_scores).toEqual(high);
  },
);

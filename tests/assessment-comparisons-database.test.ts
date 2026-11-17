import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
const db = new PGlite();
const first = "11111111-1111-4111-8111-111111111111",
  second = "22222222-2222-4222-8222-222222222222";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const comparison = {
  improvements: [
    "Your role is clearer.",
    "The result connects to your action.",
  ],
  nextStep: "Explain the lesson.",
};
const scores = { situation: 2, task: 2, action: 2, result: 2 };
const record =
  "select public.record_interview_comparison($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::text) as comparison";
const find =
  "select public.find_interview_comparison($1::uuid,$2::uuid,$3::uuid) as comparison";
async function attempt(
  n: number,
  student: string,
  stage: string,
  question = "q1",
  pre?: number | string,
  version = "ignite-star-rubric-v3|test-model",
) {
  return db.query(
    "select public.record_interview_attempt($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text,$8::text,$9::jsonb)",
    [
      student,
      id(n),
      question,
      `Interview question ${question}`,
      stage,
      JSON.stringify(scores),
      `Synthetic answer ${n}`,
      "Synthetic feedback",
      JSON.stringify({
        scores,
        total: 8,
        strongestPart: "Specific",
        improvementArea: comparison.nextStep,
        scoring_version: version,
        ...(pre !== undefined
          ? { pre_request_id: typeof pre === "number" ? id(pre) : pre }
          : {}),
      }),
    ],
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;grant usage on schema auth,public to authenticated,service_role;insert into auth.users values ('${first}'),('${second}');`,
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
    `insert into student_profiles(user_id,name,strand,ignite_year) values ('${first}','Synthetic One','culinary',1),('${second}','Synthetic Two','culinary',1);set role service_role;`,
  );
  await attempt(1, first, "pre");
  await attempt(2, first, "pre");
  await attempt(3, first, "post", "q1", 1);
  await attempt(4, first, "pre", "q2");
  await attempt(5, second, "pre");
  await attempt(6, second, "post", "q1", 5);
  await attempt(7, first, "practice");
  await attempt(8, first, "post", "q1", 2);
  await attempt(9, first, "post", "q2", 4);
  await db.query(record, [
    first,
    id(3),
    id(1),
    JSON.stringify(comparison),
    "review-version-one",
  ]);
}, 15000);
afterEach(async () => {
  await db.exec("reset role;set role service_role;");
});
afterAll(async () => {
  await db.close();
});
it("stores the exact comparison once, preserves its provenance, and reads the same first result on retry", async () => {
  const args = [
    first,
    id(3),
    id(1),
    JSON.stringify(comparison),
    "review-version-one",
  ];
  expect(
    (await db.query<{ comparison: unknown }>(record, args)).rows[0].comparison,
  ).toEqual(comparison);
  expect(
    (
      await db.query<{ comparison: unknown }>(record, [
        ...args.slice(0, 3),
        JSON.stringify({
          ...comparison,
          improvements: ["Different", "Changed"],
        }),
        "later-model",
      ])
    ).rows[0].comparison,
  ).toEqual(comparison);
  expect(
    (await db.query<{ comparison: unknown }>(find, [first, id(3), id(1)]))
      .rows[0].comparison,
  ).toEqual(comparison);
  expect(
    (
      await db.query(
        "select review_version from interview_comparisons where post_attempt_id=$1",
        [id(3)],
      )
    ).rows[0],
  ).toEqual({ review_version: "review-version-one" });
  expect(
    (await db.query("select count(*)::int as count from interview_comparisons"))
      .rows[0],
  ).toEqual({ count: 1 });
});
it("does not leak a different student's result and rejects re-binding a saved post to another pre", async () => {
  expect(
    (await db.query<{ comparison: unknown }>(find, [second, id(3), id(1)]))
      .rows[0].comparison,
  ).toBeNull();
  await expect(db.query(find, [first, id(3), id(2)])).rejects.toThrow(
    /Comparison request conflict/,
  );
  await expect(
    db.query(record, [
      second,
      id(3),
      id(1),
      JSON.stringify(comparison),
      "version",
    ]),
  ).rejects.toThrow(/Comparison request conflict/);
});
it("requires the first answer at v3 post creation and cannot change the bound pre on replay", async () => {
  const before = (
    await db.query(
      "select evaluation_json from interview_attempts where id=$1",
      [id(3)],
    )
  ).rows[0];
  await expect(attempt(10, first, "post")).rejects.toThrow(
    /require a saved first answer/,
  );
  for (const pre of [4, 5, 7, "not-a-uuid"])
    await expect(attempt(10, first, "post", "q1", pre)).rejects.toThrow(
      /same student and question|Invalid first answer reference/,
    );
  await expect(attempt(3, first, "post", "q1", 2)).rejects.toThrow(
    /Request ID conflict/,
  );
  expect(
    (
      await db.query(
        "select evaluation_json from interview_attempts where id=$1",
        [id(3)],
      )
    ).rows[0],
  ).toEqual(before);
});
it("retains in-flight v2 post compatibility without letting v3 overwrite that original binding", async () => {
  await attempt(
    11,
    first,
    "post",
    "q1",
    undefined,
    "ignite-star-rubric-v2|previous-model",
  );
  await attempt(
    11,
    first,
    "post",
    "q1",
    undefined,
    "ignite-star-rubric-v2|previous-model",
  );
  await expect(attempt(11, first, "post", "q1", 1)).rejects.toThrow(
    /Request ID conflict/,
  );
});
it("protects ownership, stages, canonical question and saved next step even for direct service inserts", async () => {
  const direct =
    "insert into interview_comparisons(post_attempt_id,pre_attempt_id,student_id,comparison_json,review_version) values($1::uuid,$2::uuid,$3::uuid,$4::jsonb,'version')";
  for (const [post, pre, student] of [
    [8, 2, second],
    [8, 4, first],
    [7, 2, first],
    [8, 7, first],
    [8, 1, first],
  ] as const)
    await expect(
      db.query(direct, [
        id(post),
        id(pre),
        student,
        JSON.stringify(comparison),
      ]),
    ).rejects.toThrow();
  await expect(
    db.query(record, [
      first,
      id(8),
      id(2),
      JSON.stringify({ ...comparison, nextStep: "Invent a different goal" }),
      "version",
    ]),
  ).rejects.toThrow(/saved second answer feedback/);
});
it("rejects malformed, oversized, and extra-field comparison payloads", async () => {
  for (const bad of [
    null,
    {},
    { ...comparison, improvements: ["Only one"] },
    { ...comparison, improvements: ["One", "Two", "Three"] },
    { ...comparison, improvements: [1, 2] },
    { ...comparison, isAdmin: true },
    { ...comparison, improvements: ["a".repeat(601), "Two"] },
  ])
    await expect(
      db.query(record, [first, id(8), id(2), JSON.stringify(bad), "version"]),
    ).rejects.toThrow();
});
it("does not grant students or anonymous clients access to comparison storage or RPCs; service records remain append-only", async () => {
  await expect(
    db.exec("update interview_comparisons set review_version='changed'"),
  ).rejects.toThrow(/permission denied/);
  await expect(db.exec("delete from interview_comparisons")).rejects.toThrow(
    /permission denied/,
  );
  for (const role of ["authenticated", "anon"]) {
    await db.exec(`reset role;set role ${role}`);
    await expect(
      db.query("select * from interview_comparisons"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query(find, [first, id(3), id(1)])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query(record, [
        first,
        id(8),
        id(2),
        JSON.stringify(comparison),
        "version",
      ]),
    ).rejects.toThrow(/permission denied/);
  }
});

# Feedback calibration review

The app's four criteria and 0–3 ranges are unchanged. Previously, the prompt gave one generic description per level. `src/config/rubric-anchors.ts` now supplies criterion-specific observable anchors to both the AI prompt and the optional student guide. The anchors clarify what information is present in an answer; they are not a validated psychological or hiring assessment.

The shared instructions recognize one clear action, modest school or community examples, and truthful unsuccessful outcomes. They do not require word counts, multiple actions, numerical success, professional credentials, particular speech patterns, or an impressive experience. Categories are scored independently. The same anchors apply to first answers, retries, and both participation years.

More explicit anchors may change how the provider scores some responses. Each new attempt stores a rubric-policy version, configured Groq model, and temperature in its existing evaluation JSON. No database schema change is needed. Retries retain the saved attempt's original version. Staff growth estimates exclude first/latest pairs whose tags differ and show the reason. The student first/second-take view hides numeric differences when its scoring method changed; later practice compares only responses with the latest method.

Historical responses without metadata are grouped as `legacy-unversioned`; their original configuration cannot be verified. A matching tag is not proof that a provider alias still has identical weights or that scoring is reliable. For a pilot, keep one configuration, record the app revision and date, and disclose changes. Bump `RUBRIC_SCORING_VERSION` when anchors or scoring policy change. Retrospectively rescoring old answers would be a separate evaluation, not a replacement for their recorded scores.

## Synthetic live-check fixture

[`tests/fixtures/feedback-calibration.json`](../tests/fixtures/feedback-calibration.json) contains five synthetic examples, canonical question IDs, and review checks:

1. A truthful unsuccessful outcome with a concrete lesson.
2. A team success that never states the student's own action.
3. A complete but modest school example with one clear action and no numerical result.
4. Identical first and latest answers.
5. Instructions that attempt to replace the rubric without answering the question.

The file contains **inputs and expectations, not provider results**. Repository tests verify that the fixture resolves to canonical questions and that every assessment prompt uses the same anchor source. They do not send these answers to Groq or establish model accuracy.

A live calibration run should use the actual configured provider and exact canonical question. Record the app revision, provider/model, date, stage, participation year, returned criteria, factual observations, next step, and each failed review check. For the identical-answer case, run PRE and POST with the same text and inspect both scores and comparison claims. Repeat a small fixed set to observe provider variation; preserve all results rather than selecting the best output. Compare Year 1 and Year 2 with the same evidence to check that coaching language changes without raising scoring expectations.

Checks should ask whether feedback cites facts actually in the answer, avoids inferred credentials or invented results, chooses the lowest-scoring criterion using the stable tie order, and offers a feasible action the student can take themselves. When all criteria are complete, a new example is appropriate practice; a fabricated weakness is not. The server binds the final comparison next step to the saved assessment so a retry or second model response cannot silently introduce a competing coaching goal.

These checks can reveal failures, but passing a small synthetic set would not demonstrate reliable scoring across all students or prove interview improvement. An independent educator's review of an authorized, de-identified pilot sample remains stronger evidence. See [the pilot protocol](PILOT-EVALUATION.md) for transfer, later practice, denominators, and reporting limits.

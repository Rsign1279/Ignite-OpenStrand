# Evaluating the IGNITE Interview Coach pilot

The product supports a practice loop: attempt a real question, review criterion-specific feedback, choose one concrete revision, rehearse, reattempt, and apply the same skill to another question. These are design choices informed by feedback and learning research. They do **not** establish that this app improves real interview outcomes. The pilot must supply that evidence.

The bank's ten topics are practice themes, not ten independently validated skill measures. Some overlap deliberately: an unexpected challenge may also require adapting a plan. Topic coverage describes experiences practiced; the four shared rubric criteria describe evidence in each answer. Neither a topic checkmark nor a count of topics demonstrates mastery of a separate trait.

## What the current dashboard measures

- **First score:** the earliest scored attempt at each question in the selected date range.
- **Latest score:** the most recent scored attempt at that same question in the selected date range.
- **Paired latest change:** latest minus first, only for questions with at least two scored attempts whose first and latest rubric/model version tags match. Average comparable repeated questions within each student, then weight students equally. Negative and unchanged changes are retained. A scoring-method change is excluded rather than interpreted as learning.
- **Repeat denominators:** the number of students with comparable repeat evidence and the number of comparable repeated student–question pairs. Students without a repeat and pairs excluded for a method change are counted separately, never treated as zero growth.
- **Best observed:** the highest score ever observed within the selected filters. It can demonstrate a response the student produced, but is not a change estimate and does not establish mastery.
- **Scores by attempt number:** a descriptive, unpaired view. Each point may contain different students and questions. It must not be interpreted as a learning curve.

A change in the date filter can change the baseline and repeat eligibility. The app does not import an earlier response outside the selected range. Multiple anonymous registrations are distinct student identities. A single student–question pair counts once in the paired denominator, even if it has many attempts.

The existing CSV `delta` column remains **best minus first** for backwards compatibility and is descriptive, including across scoring methods. For paired change, use `latest_minus_first` only where `comparison_status` is `paired`. A missing change can mean `single_attempt` or `scoring_version_changed`; `has_repeat` distinguishes an actual repeat from a single response. The export includes attempt, first, and latest scoring-version tags. Historical missing tags become `legacy-unversioned` and are compared together under an assumption of continuity; their original configurations cannot be verified.

This is an attempt-level export: derived values repeat on each row for that student and question. Deduplicate student–question pairs before averaging their comparable changes, then average per student to reproduce the dashboard. Rubric scores use a 0–3 scale per category and 0–12 total. CSV text is spreadsheet-formula escaped; finite numeric changes remain numeric, including negative values.

## Pilot questions worth answering

1. Can students make a specific, relevant revision after feedback?
2. Can they carry that skill into an unfamiliar question, without copying an answer?
3. Does the skill remain available at a later uncoached attempt?
4. Is the experience usable across devices, keyboard navigation, reduced motion, recording permission failures, and typed responses?
5. Are any students consistently receiving less useful or less fair feedback?

The rubric evaluates information in an answer, not a student's personality, worth, employability, accent, or confidence. A complete answer can describe a small school or community experience. Quantified results and professional work experience are not required. A truthful unsuccessful outcome with a useful lesson can supply result evidence.

## A concrete pilot protocol

Before collecting pilot results, define the cohort, dates, supported devices, scoring process, and intended comparison. Use the school's existing consent, retention, and access rules for student work. Do not publish identifiable student answers or leaderboard positions.

1. **Baseline:** collect one answer before STAR instruction and response-specific feedback. The current PRE round includes a scene and topic orientation, so it is not an entirely unassisted baseline. Keep the canonical question and the four rubric criteria fixed; describe the scaffolding when reporting results.
2. **Practice:** provide feedback, a single actionable focus, optional reflection, and a reattempt of the same question. Record the attempts, including unchanged or lower scores.
3. **Immediate transfer:** use another bank question, asking for a different experience. Avoid presenting a model answer to copy. Treat transfer as separate evidence from same-question improvement.
4. **Delayed transfer:** collect an unfamiliar answer at a later scheduled session with less scaffolding. State the interval when reporting it.
5. **Independent review:** have an authorized educator score a predeclared sample of de-identified answers without seeing the app score or attempt order, using the same rubric. Compare disagreements by criterion; do not assume the AI score is ground truth.
6. **Usability review:** record completion and drop-off, recording/transcription failures, whether students can locate their feedback, and whether they can explain their chosen next step. Invite feedback without requiring disclosures about disability, background, or identity.

The current dashboard provides step 1–2 scoring observations. It does not automatically conduct blinded educator review, compute delayed transfer outcomes, identify students across separate anonymous registrations, or establish causation. The optional reflection is local and unscored; it is not included in staff analytics.

## Reporting results honestly

Report the number invited, started, completed, with same-question repeats, and with transfer/delayed observations. State which of these counts is actually available; the current analytics counts scored attempts and registered identities, not all invited students or all exits. Report lower, unchanged, and higher outcomes together. Show the before and latest values, the rubric categories that changed, missing data, the selected date window, and the source of scores. Avoid selecting only best attempts or only students who finished.

For a classroom pilot without a comparable uncoached group, use language such as “Among the students with repeat observations, scores changed by…” rather than “The app caused students to improve.” A stronger effectiveness study would use a predeclared comparison design, enough participants, independent scoring, and unfamiliar interview tasks. Do not infer success from a single score or promise improvement on every round.

## Research informing the design

- [Education Endowment Foundation — Teacher Feedback to Improve Pupil Learning](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/feedback): focus feedback on moving learning forward and plan how learners will use it. This motivates one concrete next step plus a reattempt.
- [Education Endowment Foundation — Feedback evidence review](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/feedback): feedback effectiveness depends on its quality and use. A feedback message or an engaging presentation alone is not evidence of learning.
- [Institute of Education Sciences — Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1): spacing and active retrieval inform a later practice opportunity with reduced scaffolding. This general learning guidance is not a validation study of interview training or this product.

This protocol is a pilot evaluation plan, not a claim that a pilot or validation study has already been completed.

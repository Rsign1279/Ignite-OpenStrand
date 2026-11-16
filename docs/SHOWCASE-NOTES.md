# IGNITE OpenStrand — interview studio showcase

OpenStrand helps students turn real experiences into answers an interviewer can follow. The experience follows one useful loop: enter a scene, answer, examine the feedback, make one deliberate revision, retry, and apply the skill to a different question.

## The experience to show

1. **A world of possibility.** The landing page uses an actual textured Moon, a scroll-responsive WebGL renderer, local editorial fonts, and IGNITE branding. Motion can be paused; reduced-motion and non-WebGL devices retain a complete still experience. The three-strand landing preview demonstrates scene → question without registering or submitting an answer.
2. **A room connected to the student's strand.** Ten original silent animated room films establish the setting. Written narratives connect the room to the selected question's topic. Students control when the question appears and can listen to the scene, pause/replay the film, or proceed immediately.
3. **A real question and an honest starting point.** The existing bank contains 100 canonical questions, ten per strand. The student chooses a topic and answers by voice or text. Feedback uses the actual question, verified strand and IGNITE participation year, submitted answer, and the same four observable criteria.
4. **Feedback that leads to another action.** The STAR lesson includes an optional private story sketch. The next take keeps the same question and scoring rubric. A response-specific revision goal remains visible in the scene and answer screen; a complete answer is invited to transfer its skill instead of being assigned an invented weakness.
5. **Practice beyond one score.** Students can review their submitted answer, reflect privately, rehearse an unscored follow-up, retry a question, or choose an explained recommendation. Progress preserves lower and unchanged outcomes as well as increases. A downloadable practice plan contains goals and scores, without a name or answer transcript.
6. **Evidence an advisor can inspect.** Protected staff views retain criterion-level feedback and attempt histories. Same-question first-to-latest changes have explicit denominators. Comparisons across changed scoring methods are excluded. A best observed score remains labelled as such; it is not presented as proof of learning.

## What the design keeps, changes, and removes

| Keep                                                    | Change                                                                 | Remove                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Official IGNITE identity and all canonical question IDs | Story-led scenes and original films before each scored question        | Early question spoilers in the topic library                                 |
| Voice and text as equal ways to answer                  | Shared cream, dark, lavender, teal, serif and sans visual system       | Duplicate mobile topic controls                                              |
| The four-category, 12-point rubric                      | Criterion-specific observable anchors and one carried revision goal    | Legacy dashboard growth calculated from unrelated singleton PRE/POST records |
| Anonymous student sessions and protected staff access   | Cross-tab identity isolation, cancellation, secure-cookie verification | Stale drafts and recording callbacks surviving an identity change            |
| Student-level school, project and community examples    | Matched-question, version-aware growth reporting                       | Best-only score inflation and claims of guaranteed improvement               |

## What can be claimed

The application implements repeated practice, actionable feedback, transparent scoring criteria, and a more engaging environment. Automated local tests verify supported browser flows, recovery, accessibility checks, database isolation, and API integrity with synthetic or mocked services. Local tests do not establish hosted-service availability or educational effectiveness.

The application does **not** establish that every student improves on every attempt, predict hiring success, or replace educator judgment. Scores describe submitted answers. A meaningful pilot should include unfamiliar questions, later practice, independent educator review, and the students whose results are unchanged, lower, or missing. [The pilot protocol](PILOT-EVALUATION.md) defines these distinctions.

The provider integration in this repository is **Groq**. Its server-side model configuration is preserved; no xAI/Grok integration or new provider credential was invented.

## Privacy and verification boundaries

- Recordings are transient and sent for transcription; this application does not save them to a storage bucket.
- Submitted assessment text, feedback, scores, and profile details are available to authorized staff. Unsubmitted drafts and optional notes stay in page memory and clear on reset or identity change.
- The films, Moon maps, and fonts are local assets. Scene films are fictional practice settings, not representations of real employers.
- Hosted Supabase configuration, migration application, live provider calibration, and production deployment are reported separately from local validation. See [authentication verification](AUTH_VERIFICATION.md), [feedback calibration](FEEDBACK-CALIBRATION.md), and the dated entries in [VERIFICATION.md](../VERIFICATION.md).

This document describes the implemented showcase, not a completed student efficacy study.

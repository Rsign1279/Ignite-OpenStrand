# Verification — October 11, 2026

## Passed

- `npm run lint`: no errors or warnings.
- `npm run typecheck`: strict application TypeScript checks pass.
- `npm test`: 89 tests pass across nine files, including actual PostgreSQL RLS execution using PGlite with test Supabase auth claims.
- `npm run build`: Next.js production build succeeds locally and on Vercel.
- `npm run test:e2e`: all 47 Chromium desktop/mobile and WebKit browser tests pass.
- Playwright desktop/mobile full interview journey, profile selection, same pre/post question, feedback, STAR lesson, comparison, transfer, completion form link, reset.
- Browser voice capture with fake audio: no transcription before explicit finish; completes transcription/evaluation using mocked services.
- Microphone permission denial fallback.
- Landing, onboarding, and staff-login WCAG AA axe scans (including reduced motion) and viewport overflow checks on desktop/mobile; contrast defects found and fixed.
- No Groq key, privileged Supabase key, Redis token, or server AI prompt module detected in `.next/static` client assets.
- No content logging, recording persistence, interview localStorage, or unsafe HTML rendering found in application source.
- Production dependency audit: zero reported vulnerabilities.
- Visually inspected local landing page in the in-app browser; local preview can be started at http://localhost:3000.
- Deployed landing smoke test returned HTTP 200 with the correct brand and student/staff CTAs. The unconfigured assessment endpoint returned a safe HTTP 503 error.
- Vercel deployment reported READY; production alias: https://ignite-interview-coach.vercel.app.

## Dependency review

The complete dependency audit reports five high-severity entries stemming from one unpatched development-only `braces` stack-exhaustion advisory through Next's lint glob dependencies. The latest braces package is 3.0.3 and is affected; npm's suggested downgrade to Next lint 14 is incompatible with the selected framework. These packages process developer file globs, not student data or production requests. Production dependencies have zero reported vulnerabilities. The Vercel CLI was removed from project dependencies to avoid its unrelated transitive advisory surface; deployments use the supported CLI from the npm cache. Monitor upstream Next lint/braces releases and re-audit before rollout.

## Live processing diagnosis and regression checks

Both typed and recorded answers were blocked before reaching Groq because the configured Redis REST token is read-only. PING succeeded, but SET, INCR, EVAL and EVALSHA returned NOPERM. The user replaced it with the standard read/write REST token. Real counter writes and quota rejection now pass, and the corrected credential was securely uploaded to Vercel Production. Rate limiting remains enabled and fails closed. The diagnostic script now verifies real writes plus quota enforcement.

Manual provider smoke checks using synthetic content passed for the actual application assessment, comparison, transfer-question and transfer-evaluation schemas. A temporary synthesized spoken recording passed live Groq transcription and was deleted afterward. These limited manual checks used real Groq; all automated tests mock Groq and spend no provider usage. No student recordings or responses were used in these checks.

Regression coverage includes chunked multipart uploads without Content-Length, all four accepted audio formats, empty/unsupported/oversized/incomplete uploads, unauthorized calls, quota exhaustion, read-only Redis failures, library fail-open timeout responses, malformed/truncated/empty AI outputs, deterministic versus transient provider errors, short/multilingual/injection answers, HTML gateway failures, disconnected/hung requests, retained typed and transcribed answers, retries in pre/post/transfer, duplicate submissions, microphone denial and pending/late permission recovery. Browser checks run Chromium desktop/mobile and WebKit (Safari engine) text/recovery flows; physical Chromebook/iPad and Safari microphone checks remain classroom rollout checks.

Hosted Supabase public credentials and service-role profile reads were verified during setup; anonymous access is now enabled and the student registration flow reached the interview screen. The staff email is allowlisted and its account confirmed. A full deployed authenticated processing smoke remains a final classroom check; no fake student account was created for testing. A working deployment URL alone does not establish this flow.

## Release / rollback

This release changes application code only; no migration is required. Local lint/typecheck, 89 unit/integration checks, 47 browser checks, production build, client secret scan and production dependency audit passed. Do not record interview content in monitoring. If processing becomes unusable after deployment, inspect credential health first. To roll back code, promote the prior ready Vercel deployment; preserve corrected Redis credentials. Code rollback cannot repair a read-only token.

The production rebuild containing the corrected Redis credential reported READY (`dpl_Bwmd23uVLMt34DotAnq3E4mpL3MK`). The public landing returned HTTP 200 and all four costly endpoints returned HTTP 401 without authentication. Browser microphone capture still requires a physical-device classroom smoke check; the live provider transcription check used a synthetic WAV.

## Official logo theme — October 11, 2026

The supplied IGNITE PNG is preserved unchanged. Shared student/staff branding, landing page, onboarding choices, recording states, rubric feedback, STAR lesson, comparison, completion, staff login and admin dashboard now use a coordinated blue/yellow theme. The favicon uses an illustrated lightbulb motif. Local lint, typecheck, all 89 unit/integration checks, all 47 browser checks (including WCAG AA axe scans), and production build pass for the theme. The landing page was visually inspected in the in-app browser. No schema, authentication, AI or storage changes are part of this release.

## Staff analytics release — October 19, 2026

- Lint, strict TypeScript, 118 unit/integration tests, and production build pass.
- Full browser suite: 62 passed across Chromium desktop/mobile and WebKit; 15 targeted analytics cases rerun successfully after final UI refinements.
- PGlite executes the actual attempts migration: backfill, sequential numbering, generated totals, retry idempotency, RPC denial, and cross-student RLS isolation.
- Browser fixtures exercise the real overview/charts/export components with 0, 1, and 300 attempts. Fixtures are test-only, not application routes or auth bypasses. Both PDFs are checked for vector output and rendered visually; the full 100-student fixture leaderboard is retained across PDF appendices.
- Authorized owner applied the prepared production SQL and reported success. REST reads verify both tables exist; OpenAPI verifies the write RPC is available. Unauthenticated table access returns 401. No synthetic student accounts or attempts were created in production.
- Staff password remains unchanged. Authenticated live staff UI verification requires the existing staff credentials; no password was requested or printed.
- New explicit retention policy: assessment answers and AI feedback are saved for authorized staff drilldowns. Audio remains transient. Historical unsaved answers/scores cannot be recovered. Anonymous reset creates separate registration identities; repeat names are never merged automatically.

## Staff login reliability patch

The reset credential was verified against Supabase and in a real production browser through the full dashboard. The previous UI hid all provider failures behind a credential error and cleared the password after failed submissions. New same-origin server login/logout routes validate credentials, enforce staff authorization before session creation, and return safe error categories. The password field now remains populated on failure and includes an accessible show/hide control. Lint, typecheck, build, 130 unit/integration tests and 12 targeted browser/accessibility checks pass. No credential values are stored in tracked files or test artifacts.

## Question bank release — October 20, 2026

Exactly ten curated topics per strand (100 tailored variants) are validated for distinct IDs, valid lengths, canonical prompt wording, and preservation of the exact Education changing-plans question. Server checks reject cross-strand IDs and bind POST to the student's recorded PRE request, question, and answer. Attempt records receive the selected canonical ID/text. Transfers exclude the assessed question without paid question-generation usage. Browser tests confirm all ten selectors, identical pre/post text, matching pre-request IDs, and repeat practice under the same student registration with fresh attempt IDs. Lint, typecheck, production build, 141 unit/integration checks and 77 browser checks pass. Existing schema supports the bank without a migration. Test worker concurrency is capped to avoid parallel WASM database startup contention; the recording test waits for an actual elapsed second before finishing its fake audio.

## Security and score integrity review — November 15, 2026

This review used repository inspection, mocked API tests, PostgreSQL/PGlite isolation tests, and the npm vulnerability database. It did not use real student answers or make paid AI requests. Hosted Supabase configuration and authenticated staff/student flows were not independently verified: this environment has no Supabase credentials and its Vercel connection rejects project access. Public production endpoints were checked separately by the authentication review agent.

### Findings fixed

- **Critical dependency advisory exposure:** `next@16.4.0` was reported affected by GHSA-2464-fhr4-w9xw (SVG image optimization RCE), GHSA-673q-mjm6-r5xr (`use cache` typed-array RCE), and GHSA-p3m5-59mp-jv5r (Server Actions DoS). Installed Next and its ESLint configuration are now 16.4.6. `npm audit --omit=dev --audit-level=moderate` reports **0 vulnerabilities**. This establishes the patched dependency version, not that every advisory was exploitable through this application's current routes.
- **Assessment integrity:** omitting `questionId` on a POST assessment previously skipped validation of the claimed PRE answer. All POST requests now bind the baseline to the authenticated student's recorded PRE attempt, including legacy/default questions. Tests prove the omitted-ID path cannot invoke AI or save scores after validation fails.
- **Retry integrity and concurrency:** a request ID was previously checked against answer and question but not stage. Cached results now bind student, stage, question, and answer. Attempts are written before summary updates, and the API rereads the canonical saved evaluation before returning it or updating summaries. Concurrent identical submissions therefore return the first stored score rather than conflicting model scores. The database migration below also rejects conflicting payloads atomically.
- **Legacy transfer integrity:** the legacy transfer endpoint previously accepted arbitrary client question text. It now requires exact canonical wording from the authenticated student's strand and uses that bank entry in the server prompt. Arbitrary and cross-strand question payloads are rejected before AI or storage.
- **CSV formula handling:** legacy profile CSV export now escapes formula prefixes even after leading whitespace. This covers profiles inserted directly through the student's permitted Supabase insert path, which does not pass through API trimming. Regression cases include spaces, tabs, carriage returns, and formula operators.
- **Cross-origin hardening:** mutation guards now also reject browser `Sec-Fetch-Site: cross-site` and `same-site` requests when `Origin` is absent. Same-origin and nonbrowser authenticated requests remain supported.
- **Feedback consistency:** model instructions no longer prohibit the actionable feedback the schema requests. Independent scoring standards apply equally to first attempts and retries; feedback must use demonstrated evidence and one achievable next change, without invented experience, metrics, personality judgments, or guaranteed improvement.

### Database rollout

`supabase/migrations/202611160001_attempt_retry_integrity.sql` replaces the existing retry function without adding tables or changing its signature. It serializes request IDs and binds them to student, question ID/text, stage, and answer, while preserving the original evaluation on exact retries. PGlite executes the migration and verifies conflicting payload rejection, unchanged original scores, sequential numbering, and client-role RPC denial.

The migration is **prepared and locally verified, not applied to hosted Supabase**. Application validation before and after writes works with the existing schema and fails safely on mismatches; the migration adds database enforcement. No production policies were loosened.

### Verification evidence and limits

The targeted API, learning, transcription, database, and staff-login run passed 65 tests; additional RLS, database, admin, analytics authorization, rate-limit, provider, and core checks passed 55 tests. The later transfer/CSV/integrity regression run passed 67 tests. The baseline transcription suite's unhandled stream error was reproduced outside the app in Node 24.22.1's FormData encoder when canceled mid-File. The oversized-upload test now models actual network chunks with a ReadableStream and verifies that processing cancels at the byte limit without draining the request or calling the provider. Production cancellation and upload limits were preserved.

Existing protections verified include server-side `getUser` authentication before privileged reads, staff allowlisting, anonymous-only student writes, cross-student RLS isolation, denied browser score/RPC writes, bounded JSON/audio requests, shared evaluation quotas that fail closed, strict model output validation and recomputed totals, no-store responses, server-only provider credentials, and safe React text rendering. No client-side secret values or raw interview logging were introduced.

Residual limitations: a prompt instruction is not proof against every model injection; live model behavior remains untested in this environment. Simultaneous identical requests can both reach the provider before database deduplication, so duplicate provider cost is still possible, although returned/stored scores stay consistent and per-student quotas bound usage. Hosted credentials, rate-limit service writes, anonymous-signup settings, deployment patch rollout, and physical-device microphone behavior need verification in an environment with the required access. No claim of a complete penetration test or proven student learning efficacy is made.

## Recording lifecycle and shared-device privacy follow-up

The recorder now treats End session as a cancellation boundary before Supabase signout finishes. Its active component unmounts, clears in-memory drafts/chunks, invalidates pending microphone requests, releases media tracks, stops read-aloud, and aborts its pending transcription request. A late permission grant stops its newly returned tracks instead of starting capture; a late transcription response cannot submit an evaluation for a previous student. The parent passes a dedicated `endingSession` flag so ordinary answer evaluation does not cancel itself.

Concrete reliability/privacy defects fixed:

- **Medium:** the old recorder could finish transcription and attempt an answer callback while a shared-device logout was pending; cleanup did not cancel the fetch. Added caller-provided `AbortSignal` support to the API client and recording operation guards.
- **Medium:** an exception from `MediaRecorder.stop()` during cleanup could skip releasing microphone tracks. Cleanup now detaches all event handlers and releases tracks even when stopping throws.
- **Medium:** recording errors followed by queued stop/data events could leave processing state inconsistent. Error recovery invalidates the operation and detaches callbacks before cleanup; unexpected hardware stops offer typed recovery.
- **Low:** capture buffers could grow until the student pressed Finish. Recording now stops at the existing 3.9 MB client upload limit before sending an oversized request. Discard recording stops capture without uploading or scoring.
- **Usability:** question read-aloud has an explicit Stop control and a clear unavailable/error state. Typed answers show a word count with the reminder that specific details matter more than length; word count does not affect rubric scoring.

Validation: `tests/client-api.test.ts` — 11 passed, including caller abort, already-canceled sessions, and listener cleanup. `tests/e2e/recorder-lifecycle.spec.ts` — 24 passed across desktop Chromium, mobile Chromium, and WebKit (8 per project). These deterministic browser tests inject controlled recorder hardware failures and delayed permission/transcription/signout to exercise races. The existing Chromium media/recovery tests also passed (5 tests), including real browser MediaRecorder with a fake microphone, failed transcription, failed evaluation retaining its transcript, pending permission fallback, and unsupported recording. ESLint for changed recorder/API/test files and TypeScript checks passed. WebKit required `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` after the parent installed its missing runtime libraries; initial launch-only failures were host validation, not application failures.

Limits: client-side abort prevents stale UI and follow-on evaluation, but it does not prove an upstream transcription provider cancels work already received. These are local browser and mocked-service integration checks, not proof of live provider or hosted Supabase availability.

## Independent final security review

Reviewed current changed/new files and the existing public API surface for auth checks before privileged reads, same-origin mutation checks, bounded request bodies and uploads, staff-only service-role access, database grants/RLS, canonical question binding, retry integrity, prompt-data separation, and student content rendering. The new planet texture, fonts, films, and shader sources are local/static assets; no student input becomes a script, HTML fragment, shader, remote media URL, or download filename. The practice-plan download uses a fixed text/plain filename and includes only rubric goals and session score summaries, without names or answer text.

Additional adversarial export checks used the actual browser staff overview and PDF exporter with a hostile student name containing HTML tags, an onerror handler, and PDF OpenAction/JavaScript syntax. The browser displayed it literally with zero injected elements or dialogs. Poppler parsed the resulting 34,392-byte PDF with no executable JavaScript; the attack string remained visible text. Seven CSV attack strings covering formulas, leading whitespace/BOM, embedded quotes/newlines, and HTML remained correctly quoted single cells; formula prefixes were neutralized in both export formats. These checks used local synthetic fixtures, never real student data.

A pattern scan of the 71 changed/new text files present at review time found no candidate provider secret, private key, or JWT literal. This is a targeted credential-pattern scan, not a claim that all possible secret formats were detected. Existing source-level privacy boundaries are intact: raw attempts are requested only for authorized staff detail/CSV views, React renders free text as text, and API failures suppress provider/database internals. Structured model output validation bounds scores and fields but cannot prove semantic immunity to prompt injection; no live model red-team calls were possible without provider access.

The review identified a cross-tab session integrity risk: an old student tab could retain its profile/draft after another tab changed shared auth cookies, then send the old student's answer under the newer identity. The auth follow-up is adding explicit expected-student binding and session invalidation; all four student processing routes now pass the incoming Request to the auth guard. A separate finding was sent to the learning reviewer: the legacy /admin learning_results summary can pair an overwritten PRE score with an older POST score, while the newer staff analytics correctly use per-question attempt history.

The stale-tab API boundary is now enforced: every student processing route requires `X-Student-Session` to match the server-verified Supabase user. `tests/session-route-security.test.ts` exercises the real auth guard with a newer authenticated student and either the previous student's identity or no identity header. All 8 cases passed across evaluation, transcription, transfer-question, and legacy transfer evaluation: HTTP 409/no-store, no current-user ID disclosure, unread request body, and zero profile-query, quota, provider, or storage calls. This header is an identity consistency check, not a substitute for authentication. Legacy clients without the header must reload the updated application before submitting.


## Moon texture and mobile loading optimization

A cold Chromium trace of the earlier production build identified the visible Moon fallback as the mobile LCP element (97,969 CSS pixels), rather than the headline. With a 390×844 viewport, 150 ms network latency, 200,000 bytes/s download throughput, a disabled browser cache, and 4× CPU slowdown, the headline painted at 1.668 s; the original 457,942-byte Moon request started at 1.404 s, completed at 5.114 s, and produced LCP at 5.244 s. This established a late-discovered, large image as the concrete bottleneck.

Phones and coarse-pointer devices now use NASA's original, unmodified 1024×512 color map from the [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). Its 139,068-byte JPEG is 69.6% smaller than the desktop 2048×1024 map and contains one quarter as many texture pixels. A media-matched image preload exposes the compact asset in the initial HTML. The CSS fallback chooses the source, and the shader reads that choice, preventing independent decisions from downloading both variants on a cold mobile visit. The desktop 2K image and sphere geometry are unchanged. Sampling spacing follows the actual texture width; resizing across the breakpoint updates the fallback and shader consistently while retaining a valid rendered texture if the replacement download fails. Both NASA originals and their source credits are in `public/planet/`.

An isolated before/after run on the current **development server**, using the same cold-cache throttling above, measured:

| Measurement | Before | After |
| --- | ---: | ---: |
| Mobile LCP | 8.720 s | 4.160 s |
| Moon request discovery | 1.182 s | 0.227 s |
| Moon resource bytes | 457,942 | 139,068 |
| Total encoded resources, rounded | 1,447 KiB | 1,136 KiB |
| Observed CLS | 0 | 0 |

These are controlled, individual lab runs, not field Core Web Vitals or physical-device measurements. Development bundles differ substantially from production; the 52% development LCP reduction must not be presented as a production result. A rebuilt production measurement is required before claiming the final deployed LCP.

Targeted browser assertions verified one initial 1K request at 390 px; one initial 2K request at 1440 px with a fine pointer; one 1K request on a 1200 px coarse-pointer device; matching CSS/shader source after resizing 390→1440→390; no continuing draw loop under reduced motion; and a usable static fallback with only the 1K request when WebGL is unavailable. The CSS reduced-data condition is included, but this Chromium build reported both `prefers-reduced-data` values unsupported and `navigator.connection.saveData` false; no Save Data emulation result is claimed. Device-memory hints continue to cap rendering resolution rather than initiating a second image download after CSS has already selected one. Targeted ESLint, formatting, and TypeScript checks passed. Local measurement artifacts are `/workspace/scratch/moon-lcp-3100-before.json`, `/workspace/scratch/moon-lcp-3100-after.json`, `/workspace/scratch/moon-lcp-3101-before.json`, and `/workspace/scratch/moon-source-selection.json`.

## Mobile loading and playback follow-up — November 16, 2026

A rebuilt production app was measured with the same Chromium cold-cache viewport, 150 ms simulated latency, 200,000 bytes/second download rate, and 4× CPU slowdown as the earlier production trace. Mobile LCP changed from 5,404 ms to 2,812 ms; encoded resources changed from approximately 881 KB to 571 KB. The reduced-motion run measured 2,784 ms. Mobile CLS remained approximately 0.00156, with no horizontal overflow. These are local browser-emulation observations in a shared execution environment, not field measurements or a guarantee for physical student devices. The responsive 1K Moon asset and early media-matched preload address the previously observed image discovery/transfer bottleneck.

A full local production browser run passed 181 cases and exposed one intermittent WebKit media startup failure: play could remain pending with no metadata and an idle network state. The initial checkpoint nevertheless passed GitHub Actions, illustrating why one green run does not rule out a timing failure. The player now supplies its direct MP4 source, explicitly loads and awaits metadata before programmatic playback, and cancels that preparation on pause, hidden-page changes, reduced-motion changes, timeout, and unmount. Twenty repeated local WebKit playback/reduced-motion/error/stall checks passed after the change. Production-build verification follows the final media bundle below.

The quota response also now uses the rate limiter's actual reset time for both its message and Retry-After header, bounded to the ten-minute window; a missing/invalid reset uses the full window. This fixes the earlier generic 60-second response that could encourage premature retries. Targeted rate-limit, API, and transcription coverage passed 63 tests.

Student comparison now offers both submitted first/second answers in a collapsed, accessible review. The original text stays in page memory and clears on reset, identity changes, new topics, and subsequent retries. A new 320px browser check passed across WebKit and desktop/mobile Chromium, including WCAG AA scans, answer visibility, storage exclusion, and reset cleanup. The review does not rewrite either answer or claim that a score proves learning.

## Complete media and production-build checkpoint

- `npm run check`: lint, TypeScript, **234 tests in 28 suites**, and the production build pass with all ten films present.
- Full browser verification against that HTTPS production build: **191 passed** across WebKit and desktop/mobile Chromium, including delayed hydration, stale profile responses, real film playback, cancellation of pending autoplay, side-by-side answer review, recording lifecycle, staff analytics/export, accessibility, and failure recovery.
- All ten MP4s are distinct H.264/yuv420p videos at 960×540 and 24 fps, with no audio stream and 11.708-second duration. Their combined size is 10,218,521 bytes plus ten posters. A repository test checks every canonical asset, bounded size, fast-start metadata, H.264 codec marker, duration, unique hashes, and WebP headers. FFmpeg decoded different frames at one and eight seconds for every film.
- The render pipeline now defaults to the ignored repository-local frame cache rather than a workspace-specific path. A real Blender preview verified its default path. A sandboxed pipeline test used the existing rendered frames and real FFmpeg; a forced encoder failure preserved the prior film/poster and removed temporary files, followed by a successful publication.
- A local timing trace exposed the onboarding form accepting input before hydration, then losing that value. The form now remains disabled with a preparation label until interactive, and stays locked during registration. The new delayed-script test and stale-profile cases pass in all three engines.

A tagged, two-page educator reference containing the exact shared rubric anchors and pilot/showcase brief is included as `docs/IGNITE-RUBRIC-AND-PILOT.pdf`. The separate local walkthrough video is explicitly labelled as a synthetic student with sample feedback. Neither is evidence of a completed pilot or a live provider validation.

## Shared-device endurance and final contrast/dependency review

Two independent, single-context runs completed **20 synthetic students each**: Chromium desktop with fake microphone hardware, and WebKit with an emulated iPhone viewport. Each student completed PRE, STAR, POST, a fresh scored question, completion, and reset; both participation years and all ten strands were exercised. Each run completed 60 whole films. Chromium also produced five real MediaRecorder uploads while transcription/scoring/auth responses remained mocked. No hosted users or records were created.

After every reset, the checks found blank onboarding, no prior name/answer/feedback/notes in the rendered page or local/session storage, no Supabase auth cookies, no live tracks, active recorders, open audio contexts, playing or detached-playing films, or document video nodes. The SDK's one refresh interval remained constant; animation-frame work returned to zero. The runs revisited the Moon after every five students and found no live WebGL context after leaving it. Chromium post-GC heap changed from 7,793,436 bytes after ten students to 8,083,268 bytes at the end (+289,832 bytes, 3.7%); this bounded observation does not prove the absence of every memory leak. WebKit does not expose the same heap API and has no claimed heap measurement. Both runs completed without browser JavaScript errors.

Visual review caught low-contrast score numerals in the dark comparison panel that axe did not report. A direct computed-color regression reproduced a 2.108:1 contrast ratio, below the 3:1 large-text threshold. The numbers now use cream. The explicit contrast calculation, in-view axe scan, answer comparison, and reset checks pass across all three browser projects. This illustrates why automated scans alone are insufficient.

The broader dependency audit found seven moderate development-only findings tracing to one minimatch glob-amplification advisory, GHSA-g3hv-75wg-m249. The latest available TypeScript ESLint parent still depended on the affected major. A narrowly scoped parser override installs minimatch 11.0.1, with compatibility checks for the actual named API/glob options it uses. The full dependency audit now reports **0 vulnerabilities**; CI audits production and development dependencies at moderate severity. No production dependency was forced across a major version for this fix.

## Full-bank and sustained graphics verification

A separate HTTPS production-build walkthrough completed **all 100 unique canonical questions** across ten synthetic student sessions and **110 complete scene/answer rounds** (each strand's first question was answered for both PRE and POST). Every scene finished its actual local film before entering the question. The check asserted that the exact canonical question remained hidden before Ready, appeared correctly afterward, and reached scoring with the right identity, stage, and a fresh request ID. Each POST referenced its PRE. All ten practice-plan downloads excluded the synthetic student name and submitted-answer marker; each reset cleared the session and cookie. No microphone was requested and no browser JavaScript errors occurred. Auth/profile/scoring were mocked; these are interface/contract checks, not live provider results or student efficacy evidence.

The Chromium graphics soak completed **20 homepage → interview → homepage cycles over approximately 15 minutes**. Ten-second visible samples produced 298–301 draws, consistent with the 30fps cap. Every cycle recorded zero draws during its paused, offscreen, and unmounted observation windows. Post-GC snapshots after cycles 5/10/15/20 retained zero WebGL contexts after leaving the Moon and a constant 229 DOM nodes. Heap rose from 6,757,572 to 7,047,492 bytes across those snapshots; this bounded observation is not a proof against every leak.

WebKit also rendered the actual WebGL scene and recovered from **five native WEBGL_lose_context cycles**, retaining manual pause after each restoration, with zero JavaScript errors and functioning navigation. The offline showcase report was checked at 390px and 1440px: zero broken images, no horizontal overflow, and no axe WCAG AA findings. A separate computed-color scan across settled studio screens found no flat-surface text-contrast findings; text during the brief entrance fade and text over imagery are outside that statement.

Publication remains a separate permission boundary. Automatic approval review rejected the main-branch merge because explicit authorization for that production merge is required. PR #1 is ready for review with passing checks; no workaround or production merge was performed. Hosted Supabase configuration, the optional retry-integrity migration, live model calibration, and physical microphones retain the access limits described above.

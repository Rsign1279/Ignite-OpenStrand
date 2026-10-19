# IGNITE Interview Coach

A voice-first interview practice application for IGNITE Professional Studies. Students register without email, complete a behavioral pre-assessment, learn STAR, repeat the same question, compare scores, and apply the framework to a transfer question. Advisors see registrations, rubric scores, student/question growth, and saved assessment answers/feedback in protected staff analytics.

## Architecture

Next.js App Router and strict TypeScript power the web application. Supabase anonymous Auth identifies students; password Auth identifies provisioned staff. PostgreSQL stores profiles (`user_id`, `name`, `strand`, `ignite_year`) and a separate server-only `learning_results` table with numeric rubric scores, STAR presence flags, and operational/completion timestamps. The verified server-side email allow-list protects all staff reads before a service-role query. Supabase RLS limits anonymous authenticated students to inserting and reading their own profile. Students have no access to learning_results; only server-generated evaluations are persisted.

The deterministic state machine in `src/lib/machine.ts` controls every interview transition. Groq receives server-built instructions and separate, untrusted response data; it cannot navigate the application. Dedicated prompts cover independent pre/post evaluation, comparison, transfer question generation, and STAR detection. A provider interface permits replacing Groq. JSON Schema strict output and Zod validate responses; malformed generation gets at most two attempts. Arithmetic is recomputed in code.

Browser memory holds recordings, transcripts, feedback, and scores. Only a non-sensitive stage marker enters sessionStorage. On refresh, the existing authenticated profile can be recovered, but the interview restarts from Ready because its sensitive content was not retained. Next Student clears memory and the stage marker, stops recording resources, cancels speech synthesis, signs out the student, and returns to blank onboarding. If sign-out fails, reset reports an error and must be retried before handing over the device.

Upstash Redis sliding-window counters expire automatically. All costly endpoints require a verified authenticated student with a profile and allow 12 requests per endpoint group per 10 minutes. Assessment and transfer evaluation share a group. Counters contain opaque auth UUIDs, never raw IPs or interview content. Redis configuration is required even in development: processing fails closed without it. Supabase's own anonymous-signup limits also apply.

## Stack and compatibility

Next.js 16.4, React 19.3, Tailwind 4, Supabase JS 2, Supabase SSR, Groq SDK, Zod 4, Lucide icons, Vitest, PGlite PostgreSQL, Playwright, and axe. Exact resolved versions are committed in `package-lock.json`. TypeScript 6 is used because the current Next lint stack does not support TypeScript 7. `skipLibCheck` avoids a Supabase WebAuthn declaration conflict with current DOM types; application code remains strict. ESLint 9 matches the peer requirements of Next's React/accessibility plugins.

## Local installation

Requires Node.js 22 LTS or newer supported by Next.js, and npm.

```sh
cd /Users/rahulviswanath/Ignite-OpenStrand
npm ci
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. Edit `.env.local` locally in your editor. Never paste private keys into chat, source code, command-line arguments, screenshots, or Git. Both example files contain placeholders; `.env.local` is ignored.

## Environment variables

Add **every row below** to the root `.env.local` for development. In Vercel, open project **ignite-interview-coach → Settings → Environment Variables** and add the same names for Production and Preview, using separate preview services where possible. Public variables are embedded at build time, so redeploy after changing them.

| Variable                        | Value/source                                                                               | Browser access |
| ------------------------------- | ------------------------------------------------------------------------------------------ | -------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project Settings → API URL                                                        | Public         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key from project API keys; RLS must be enabled                   | Public         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase server-only service-role/secret key; used after staff authorization               | Never          |
| `GROQ_API_KEY`                  | Groq Console API Keys                                                                      | Never          |
| `GROQ_MODEL`                    | `openai/gpt-oss-120b`, currently supporting strict JSON Schema; confirm in Groq model docs | Server         |
| `GROQ_TRANSCRIPTION_MODEL`      | `whisper-large-v3-turbo`, currently supported for transcription                            | Server         |
| `NEXT_PUBLIC_RESULTS_FORM_URL`  | `https://forms.gle/oXsPai5qjkUb5okw9`                                                      | Public         |
| `ADMIN_EMAILS`                  | Comma-separated provisioned advisor email addresses                                        | Never          |
| `UPSTASH_REDIS_REST_URL`        | Upstash Redis database REST URL                                                            | Server         |
| `UPSTASH_REDIS_REST_TOKEN`      | Upstash Redis standard **read/write** REST token (not the read-only token)                 | Never          |

Do not prefix any secret with `NEXT_PUBLIC_`. The service role bypasses RLS and must remain server-only. `server-only` import boundaries prevent accidental bundling of AI, auth, privileged Supabase, and rate-limit modules.

## Interactive setup terminals

Run these in two terminals from the repository root:

```sh
./scripts/setup_supabase.sh
```

```sh
python3 scripts/configure_environment.py
```

The first authorizes Supabase, links the project reference you enter, and applies the profile migration. The second hides key entry, saves `.env.local` with owner-only permissions, and can upload the variables to the linked Vercel Production environment through stdin. Upload failures retain the local file. Never send keys through chat. After both finish, complete the hosted dashboard actions below and have Codex verify and redeploy. The scripts do not print private values or commit configuration.

## Supabase setup and migration

The supported project-scoped CLI is installed as a development dependency. `supabase/config.toml` is initialized with anonymous sign-ins enabled for local development.

```sh
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Login requires authorization in your browser. Do that directly; do not send the access token through chat. If no project exists, create one in the Supabase dashboard, choose an appropriate region, save the database password in your password manager, and link its project reference. Optional local Docker stack: `npx supabase start`; Docker is required and is not installed by this project.

Dashboard actions for the hosted project:

1. Authentication → Providers/Sign In: enable anonymous sign-ins. Keep public email signup disabled; staff accounts are provisioned administratively. Enable appropriate signup abuse controls for the classroom. If you enable a CAPTCHA requirement, integrate its widget/token before expecting anonymous access to work; this implementation does not include a CAPTCHA widget.
2. Authentication → URL Configuration: set Site URL to your production HTTPS origin; add development `http://localhost:3000` and the exact approved preview origins to redirect URLs. Password login does not redirect through OAuth, but these URLs govern recovery/email workflows.
3. Apply `supabase/migrations/202610110001_profiles.sql` with `db push`. Verify RLS is enabled in Table Editor and only the four intended columns exist.
4. Authentication → Users → Add User: provision each real advisor with their email and a secure password. Add exactly those emails to server-side `ADMIN_EMAILS`. Do not create student email accounts.
5. Review vendor auth logs/retention and student data policy with the program owner. Do not add response analytics or content logs.

The primary key provides the only index needed for this profile dataset. The dashboard loads registrations in paginated database batches, then filters locally. Very large cohorts may benefit from server-side search/count pagination later.

## Groq setup

Create a Groq API key in the console and place it in `.env.local` and Vercel's server environment. Verify the configured models against the live model list for your account. Strict schema support is required for assessment; do not substitute an arbitrary text model. Audio is transmitted to Groq for transcription, then discarded by this application. Read the provider's data handling terms before classroom use; application-level non-persistence is not a guarantee about vendor infrastructure retention.

Official references used for implementation:

- [Groq models](https://console.groq.com/docs/models)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [Groq speech to text](https://console.groq.com/docs/speech-to-text)
- [Supabase anonymous sign-in](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Vercel deployment](https://vercel.com/docs/projects/deploy-from-cli)

## Running and testing

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
npm start
```

Automated tests never spend Groq usage. Unit and mocked endpoint tests cover scores, schema validation, malformed generation retries, prompt isolation, strand wording, deterministic transitions, profile/year validation, admin authorization, rate-limit rejection, request sizes, safe errors, and CSV formula-injection protection. PGlite executes the actual SQL migration against PostgreSQL with test auth functions and JWT settings, asserting cross-student RLS restrictions. It does not replace a production Supabase smoke test.

Playwright runs Chromium desktop/mobile and WebKit (Safari engine) text onboarding through completion/reset with mocked Auth and AI traffic, plus voice recording with fake browser audio, permission denial fallback, responsive overflow checks, and axe WCAG AA scans. Audio capture must also be manually verified on actual Chromebook/iPad hardware over HTTPS before a classroom rollout.

## Vercel deployment

Run the Vercel CLI without making it an application dependency:

```sh
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env pull .env.local
npm run check
npm run test:e2e
npx vercel@latest deploy
npx vercel@latest deploy --prod
```

`env pull` writes sensitive environment values locally; keep its output file ignored. Alternatively enter variables through Vercel Settings. This application is already linked locally to `rsign1279/ignite-interview-coach`; the `.vercel` link is ignored. Deployment configuration uses Next.js server routes with a 60-second limit.

Vercel's request limit is approximately 4.5 MB; the app rejects multipart requests over 4 MB and audio over 3.9 MB. Recordings request a 32 kbps bitrate and support WebM/MP4/OGG browser codecs. There is no silence-based automatic submission. Long answers can use text mode. API JSON bodies are bounded while streaming, not only by a claimed Content-Length. Multipart requests are bounded before parsing. HTTPS is required for microphones except localhost.

## Deployment checklist

- [ ] Supabase project linked; migration applied and hosted RLS inspected.
- [ ] Anonymous sign-ins enabled, signup abuse limits configured, email signup disabled.
- [ ] Real staff accounts provisioned and `ADMIN_EMAILS` set.
- [ ] All environment variables present in appropriate Vercel scopes, followed by redeployment.
- [ ] Groq models available to your account; Redis reachable and rate-limit TTL behavior verified.
- [ ] Production Site URL and exact allowed redirect origins configured in Supabase.
- [ ] Vercel Deployment Protection permits the intended student audience. Initial deployment may require Vercel login; adjust project Settings → Deployment Protection deliberately before sharing with students.
- [ ] Lint, typecheck, tests, E2E, production build pass; dependency audit reviewed.
- [ ] Real authenticated voice and text journeys tested over deployed HTTPS without content logging.
- [ ] Authorized staff dashboard, forbidden staff/student access, filters, CSV, logout verified on production.
- [ ] Next Student clears the prior session; refresh restarts safely; permission/network/provider failures tested.
- [ ] School/vendor privacy review completed and actual classroom devices verified.

## Privacy and security

No interview audio, student emails, phone numbers, school IDs, or demographics are stored in the application database. Assessment answer text and AI feedback are now stored for staff review, explicitly requested on October 19, 2026. Rubric scores and transfer STAR indicators are now persisted by explicit request (October 19, 2026). Profile creation persists the profile fields and an internal auth UUID. Learning results are linked to that UUID. Each anonymous registration is one session; matching repeat students across sessions is not automatic, and duplicate names must not be assumed to identify the same person. Historical scores cannot be recovered. Anonymous Auth itself maintains operational authentication records. No transcript/audio logging statements are present. Hosting, Supabase, Groq, and Redis have their own operational policies and must be configured/reviewed independently; hosting may retain request metadata such as IPs outside this app's control.

Interview content exists temporarily in browser memory and server request memory. There are no interview localStorage records, files, storage buckets, or database tables. The official results form opens only after a user clicks; no query parameters or automatic submissions transmit student data.

The app validates server authentication on every protected route, verifies the staff allow-list server-side, enforces origin checks on mutations, validates request schemas and bounded bodies, limits AI requests, renders AI text safely, and handles errors without exposing stacks. Profile RLS uses both `auth.uid()` and `is_anonymous` claims. Headers deny framing, disable cameras/geolocation, restrict microphones, prevent MIME sniffing, and set no-referrer and HSTS. CSP permits inline Next runtime scripts/styles; a nonce-based CSP could tighten this further with dynamic rendering. No `dangerouslySetInnerHTML` is used.

CSV exports contain only name, strand, and participation year; formula-like leading characters are escaped. Rate-limit and AI results return `Cache-Control: no-store`. Protected pages are dynamic. No client-controlled admin flag grants privileges.

## Editing strands, questions, and rubric

Edit `src/config/strands.ts` to change display names, icons, interviewer roles, permitted experiences, contexts, primary questions, transfer instructions, or rubric wording. `primaryQuestion` is reused for PRE and POST; Education's supplied wording is preserved exactly. UI components need no edits for wording changes. New strands also require matching SQL CHECK constraint and validation updates. This product's rubric is intentionally four categories scored 0–3; altering point ranges/count requires updating validation and arithmetic as well as the rubric. Do not silently change scoring semantics through copy edits.

## Troubleshooting

- **Student access not configured:** set public Supabase environment values and rebuild. Enable anonymous sign-ins in the hosted project.
- **Staff forbidden:** verify the authenticated account is permanent and its email exactly matches the server allow-list. Students cannot become administrators by setting client state.
- **Processing unavailable:** check server Groq/Redis variables, model availability, and provider status. User errors intentionally omit infrastructure details.
- **429:** wait before retrying. Student content is not destroyed by evaluation errors; text mode keeps the answer in memory. The app never fabricates processing percentages.
- **Microphone denied or unsupported:** use Type my answer. Grant microphone permission in browser settings; use HTTPS. Recordings are explicitly ended with I'm Finished.
- **Transcription fails:** audio is discarded; type the answer or record again. The app does not retain a retry audio copy.
- **Refresh during interview:** profile recovers if Auth is valid, but sensitive assessment state was intentionally memory-only; restart the practice.
- **Reset sign-out fails:** retry Next Student before another student uses the device. Feedback is cleared immediately.
- **CSP and self-hosted Supabase:** update `connect-src` in `next.config.ts` for the exact custom Supabase origin.

## Verification status

See `VERIFICATION.md` for recorded automated checks and remaining live setup boundaries. A successful deployment/build alone does not establish that unconfigured external services or classroom hardware work.

### Processing health and recovery

After configuring credentials, run `node --env-file=.env.local scripts/verify-processing.mjs`. This tests actual rate-counter writes and quota rejection, not just Redis PING. It checks Groq model availability without paid generation and prints no secrets or interview content. A read-only Redis token causes both voice and text processing to fail before Groq is called. Replace it with the standard REST token in `.env.local` and Vercel Production, then redeploy.

Uploads accept browser multipart bodies with or without Content-Length, bounded to 4 MB while streaming. Empty, oversized, unsupported, or incomplete recordings receive actionable errors. Students can switch to text while microphone permission is pending; late permission responses release their tracks. Recordings are discarded after transcription attempts. Successfully transcribed text remains in component memory when evaluation fails, so retry does not require another recording. Typed responses, including brief responses, are assessed without an arbitrary ten-character minimum. Empty answers remain blocked.

Client requests have a 65-second deadline and do not automatically repeat paid POSTs. Structured provider requests have at most two 12-second attempts; permanent 4xx errors do not retry, malformed responses do. Post evaluation and comparison remain independent. Transcription has one 45-second attempt. Server rate-counter errors and library timeout responses fail closed. No service can guarantee transcription accuracy or availability; text mode and explicit retry provide recovery. Use a quiet room and a working microphone. Real Chromebook/iPad testing remains a classroom rollout check.

### IGNITE visual identity

The supplied official PNG is preserved at `public/ignite-logo.png`; the shared Brand component displays it without stretching or recoloring. `public/ignite-bulb.svg` is a small favicon inspired by the logo's lightbulb. The global theme lives in `src/app/globals.css`: `--brand-blue`, `--brand-deep`, `--brand-yellow`, and their soft surface tokens. Blue anchors navigation, controls, scores, and advisor tables; yellow highlights the landing CTA, active recording, STAR cards, and score change. Dark blue text on yellow preserves readable contrast. Keep future strand wording in the strand config and visual colors in the shared theme.

### Learning tracking rollout
Apply `supabase db push` before deploying this version. The original learning_results table contains pre/post rubric category scores and transfer booleans. The newly requested interview_attempts table additionally retains assessment answers and feedback. Staff statistics use only paired pre/post assessments for growth calculations. Missing results display a dash, not zero. Rollback: revert the app commit; leave the additive table intact to preserve collected results.


## Staff analytics (October 19, 2026)

- `/staff/login`: existing email/password staff authentication; successful login lands at `/staff/dashboard`. The staff password was not changed.
- `/staff/dashboard`: server-rendered KPI cards and leaderboard, five Recharts views, URL-based multi-strand/date/name/minimum-attempt filters.
- `/staff/student/[id]`: numerical timeline, category-versus-strand radar, mastery, per-question attempts, and verbatim saved answers/feedback.
- `/staff`: paginated raw attempt table (50 rows/page), with CSV export. `/admin` preserves the existing registration table.
- `GET /api/staff/analytics`: aggregate-only JSON with `strand` (repeated or comma-separated IDs), `student` (name search), `from`/`to` (inclusive UTC dates), and `minAttempts`. Unauthenticated requests return 401; anonymous students and other non-admin accounts return 403. Every server page and data loader independently checks staff authorization. No raw answer or feedback fields are included in analytics JSON or chart props.
- `GET /api/staff/export-csv`: same filters, optionally `id=<student UUID>`, staff-only attachment containing raw fields and per-student/question first, best, latest, delta, attempts_count. Spreadsheet formula prefixes are neutralized; quotes and line breaks are escaped.

### Aggregation definitions

Within the selected date range, group attempts by **authenticated student UUID and question ID**, order by timestamp then attempt number/ID, and compute first, best, latest, and best-minus-first. First and best averages are computed across a student's questions; program/strand averages then weight students equally. Minimum attempts and student-name search are applied before every program chart. Empty averages are null, never zero. Best-minus-first is nonnegative by definition; the drilldown exposes latest score so declines are still visible. The practice curve is observational and has different contributors at different attempt counts; it does not establish causation. Weeks start Monday in UTC and gaps are filled with zero. Student strand-comparison averages use the same dates but ignore the selected student's name search and minimum-attempt threshold.

The original rubric is retained: **Situation & Task, Personal Actions, Result/Impact, Communication**, each 0–3. There is no fabricated independent Task score. Transfer assessments remain unscored and are excluded from /12 attempt counts.

Anonymous profiles are registration/session identities. Never merge two students by name. Reset signs out the current identity, so repeat registrations remain separate unless a future authenticated identity-linking flow is added. There is no reliable cross-session longitudinal identity matching in this version.

### Storage and migrations

Apply both `202610190001_learning_results.sql` and `202610190002_attempt_history.sql` using `supabase db push` **before deployment**. `interview_attempts` is append-only: its total is a generated SQL column; sequential numbers are assigned under a transaction advisory lock. UUID request IDs make retries idempotent. The server validates evaluation output and reuses an already-saved evaluation on a retry. Browser clients cannot write scores or execute the write RPC. Student SELECT is restricted to their own anonymous UUID; staff reads use the existing server-only allow-list and service-role client.

Existing numeric learning results are backfilled with `is_legacy=true`, null answer/feedback, and the last available session update timestamp. The historical original timestamps and answers cannot be reconstructed. No fake student records or fabricated answers are created.

### PDF reports and verification

PDF export lazily loads jsPDF/svg2pdf.js on click and converts **actual Recharts SVG** to vector paths/text; it does not rasterize charts or send student data to an external PDF service. An A3 landscape first-page summary includes KPI cards and all charts. The complete leaderboard/question summary continues in appendices as needed, with filter state, export time, and page numbering. Fonts and colors follow the existing IGNITE theme. No interview answers are included in these chart-summary PDFs.

React request-scoped cache deduplicates privileged data loads without retaining student data across requests. Responses use no-store. Recharts and PDF code are isolated to staff routes, with PDF modules dynamically imported only on demand. All chart animations are disabled; mobile chart regions scroll rather than squash. Each chart has an accessible data-table alternative, loading skeleton, and empty state.

Tests use mocked AI and a browser-only bundled UI fixture, never a production auth bypass. The fixture is not shipped as an application route. PGlite executes actual migrations and tests student isolation, write denial, backfill, generated totals, sequential numbering and duplicate request IDs. Browser checks cover 0/1/300 attempts, keyboard data tables, accessibility, mobile overflow, authenticated-route rejection, and vector PDF downloads for both views.

### Staff login reliability

Staff sign-in now posts to `/api/staff/login` on the application origin. The server authenticates with Supabase, checks the existing staff allow-list, and installs the session in cookies; no token payload is returned in JSON. Passwords are never logged or persisted by the application. Supabase Auth's sign-in rate limits still apply. `/api/staff/logout` ends the current staff session on the server. This avoids depending on direct browser-to-Supabase connectivity for staff login/logout. Failed submissions preserve the password for correction, a show/hide control supports checking pasted values, and provider/network failures are distinguished from invalid credentials.

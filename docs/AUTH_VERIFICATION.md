# Authentication verification — November 16, 2026

## Implemented and checked locally

- Supabase anonymous student identity is verified with `auth.getUser()` before profile or interview access. Staff identity additionally requires a permanent account and the server-side email allowlist. Browser-provided roles and IDs cannot authorize access.
- Profile responses include the verified opaque identity in `X-Student-Session`. Profile creation, evaluation, transcription, and transfer APIs require that pin to match the verified cookie session before reading/writing profile data or calling an AI provider. It is a consistency check, not a secret or substitute for authentication.
- Student tabs subscribe to Supabase auth events. A changed identity clears names, profile, drafts, feedback, story notes, request IDs, and optional session markers; unmounting releases the microphone and aborts transcription. Pending evaluation is aborted and late responses are ignored.
- Initial Supabase recovery can emit `SIGNED_IN` before `INITIAL_SESSION`; this does not invalidate a matching restored profile. Subsequent identity changes invalidate pending profile responses.
- Staff login/logout installs cookies through server routes and announces a non-sensitive session-change event to other tabs. No answers, identity, or credentials are stored in that notice. Browsers with messaging/storage disabled still enforce the identity pin at the API.
- Student reset uses local-session logout and blocks replacement signup if logout fails. This avoids revoking unrelated sessions for a staff member who visits the student page.
- Login/logout route cookie writes are strict: a failed write cannot be reported as successful. Failed staff session installation also revokes the temporary verifier session. The browser requires an explicit JSON success response before treating staff logout as complete.
- Supabase SSR 0.12.7 supplies no-cache headers on the first cookie write. Proxy preserves these headers and every cookie chunk across multiple writes in one request. This prevents a refreshed authentication response from becoming a reusable shared-cache entry.
- Production auth cookies are Secure and SameSite=Lax across the browser, server, and proxy clients. Supabase's browser-readable SSR cookies remain intentional: the browser SDK needs them. Authorization remains server-verified; no service-role credentials are exposed to the browser.

## Automated evidence

- `tests/auth-session.test.ts`: real auth helpers reject mismatched/missing identity, permanent users, and missing authentication before accessing profiles; profile creation rejects cross-tab identity races; recovered profile pins the server identity.
- `tests/session-route-security.test.ts`: all four protected processing routes reject stale or missing pins before reading request bodies, querying profiles, limiting requests, or calling providers/storage.
- `tests/supabase-cookies.test.ts`: multiple cookie refresh writes preserve first-write cache headers/chunks; required cookie writes fail closed.
- `tests/staff-login.test.ts`, `tests/staff-login-client.test.ts`, `tests/client-api.test.ts`: safe login failures, verifier cleanup, confirmed logout, immutable JSON/multipart identity headers, and cancellation.
- `tests/e2e/auth-isolation.spec.ts`: two real browser tabs using the Supabase browser SDK; logout clears the other tab, stale-cookie request retains the old identity pin and is rejected, late feedback cannot restore a logged-out student, and server-based staff login clears student work in another tab.
- Existing full student registration/interview/reset and stale-profile recovery browser checks remain covered. These tests use synthetic users and mocked auth/provider responses; they do not claim hosted auth settings were changed or validate a paid provider.

Latest focused verification: 47 unit/API tests passed, all 12 auth-isolation cases passed across desktop Chromium, mobile Chromium, and WebKit, and the full student registration/interview/reset browser flow passed. Targeted lint and TypeScript checks passed. WebKit used the workspace’s already-installed runtime libraries with its host-preflight override; no application expectations were skipped.

## Production HTTPS transport verification

The production build was also tested through the local-only HTTPS harness in `scripts/serve-test-build.mjs`. All 12 cross-tab isolation cases passed on desktop Chromium, mobile Chromium, and WebKit with Secure cookie fixtures matching the configured base URL. Fresh synthetic student registration in both WebKit and Chromium produced an actual SDK cookie marked `Secure` and `SameSite=Lax`; ending the session removed that cookie.

The harness serves the built Next app directly on TLS, with the public hostname/port configured in Next. It does not rewrite the browser's Origin. Real, unmocked staff-login requests with an empty body returned 400 for the matching origin (schema validation reached) and 403 for a foreign origin. A plain-HTTP production test had previously exposed WebKit correctly rejecting Secure cookies; no production cookie protection was weakened to make that test pass. The harness uses an ephemeral self-signed certificate, binds only to loopback, and removes its temporary certificate directory on shutdown. It is not a deployment server.

## Hosted evidence and access limits

Public checks of `https://ignite-interview-coach.vercel.app` found the landing page and student interview available. Unauthenticated profile/evaluation/transcription/staff analytics/admin profile endpoints returned 401 with no-store. The staff dashboard streamed a redirect to staff login without exposing student records.

The connected Vercel account returned no teams and project access returned 403 requiring team consent. No Supabase connector, authenticated Supabase/Vercel CLI configuration, or development secrets were available. Direct access to the deployed Supabase auth endpoint was rejected by the environment's outbound CONNECT proxy. No hosted auth settings, users, passwords, RLS policies, production environment variables, or deployments were modified. No anonymous or real user accounts were created, and no student records were inspected. Live anonymous signup, staff sign-in, deployed schema state, and hosted rate-limit/provider configuration therefore remain unverified from this workspace.

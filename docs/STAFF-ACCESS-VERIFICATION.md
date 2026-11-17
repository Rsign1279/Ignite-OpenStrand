# Advisor access — November 17, 2026

The existing confirmed, permanent account for `mtrump@bentonvillek12.org` was updated through Supabase's managed Auth Admin API. Its password is not stored in application source, tests, documentation or deployment configuration. The server's existing `ADMIN_EMAILS` authorization already includes this identity; no additional database privilege or RLS change was required.

Live verification at https://ignite-interview-coach.vercel.app/staff/login succeeded with the requested credentials. The dashboard loaded; registrations, analytics and CSV APIs returned 200 with `Cache-Control: no-store`. The verification session then signed out successfully. The expiring, account-scoped maintenance helper was immediately replaced with an inert response; its deployed source and enabled JWT verification were checked afterward. No student record was modified.

The dashboard refinement adds clearer navigation, metric hierarchy and active-filter scope while preserving every reporting value, caveat, drill-down and export payload. Raw-data pagination now clamps an oversized page to the final matching page. Mobile registration numbers stay intact, and expanded strand choices fit within the filter form.

Authorization tests exercise real server guards with controlled provider identities. Teacher access is allowed; anonymous sessions, missing/failed identity verification, other emails and forged user metadata are denied before privileged reads. Synthetic UI checks cover empty, single and larger cohorts, desktop/mobile Chromium and WebKit, keyboard interaction, full answer/feedback text, filters, CSV and PDF output. Live credential checks supplement these fixtures; synthetic data is not evidence of student learning or scoring accuracy.

Full release validation and CI are recorded in the pull request. Account authorization applies to the complete application dashboard, not to Supabase project administration.

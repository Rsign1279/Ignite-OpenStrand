# Interview pilot verification

The active rubric is `ignite-star-rubric-v3`: Situation, Task, Action, and Result each receive 0–3 points, for a total of 12. Communication is assessed within the relevant element. The supplied STAR reference defines the content; the program owner explicitly selected equal points rather than percentage weights. Real measurements are useful when available; invented metrics, professional experience, and successful outcomes are not requirements.

Recording stops into an editable draft. Students may append another recording or replace a selected phrase by voice before explicitly submitting. Pending audio stays only in the current browser tab's memory until transcribed/discarded; ending the session clears it. The app does not store audio. Submitted text, feedback, scores and comparison records are retained for authorized staff.

## Retry and capacity behavior

- Authenticated identities and response payloads are pinned across retries. Completed scores and comparisons are immutable; failed comparisons can resume without grading the answer again.
- Redis coordinates request ownership, bounded multipart uploads, rolling-minute provider admission and provider cooldowns across instances. A capacity retry counts as the same logical student submission.
- Automatic client retry is restricted to explicit short admission waits. Provider quota, network, and generic errors do not trigger silent paid resubmission. Students can cancel an admission wait without losing their draft.
- The QA lab exposes real observed request/day and token/minute headers, latency and current app traffic. Missing observations remain unknown. Refreshing does not call the provider.
- Default app budgets are 4 simultaneous/20 requests per minute for text, and 2 simultaneous/12 per minute for audio. Server environment variables can tune them within bounded ranges after provider capacity is confirmed. These defaults do not certify a hundreds-student event.

The configured provider is **Groq**. Extra API keys normally share organization/model quotas and do not add capacity. Quota increases or a paid tier require account-level provisioning, not key rotation. Public examples must not be presented as this account's limits.

Supabase anonymous signup is enabled. Its private per-IP signup rate is not exposed by the available project tools or public Auth settings. Supabase documents a default anonymous-signup limit of 30 per hour per IP; a school NAT can concentrate all students on one IP. This setting must be verified before a large simultaneous event. No private Auth setting was changed or claimed verified. The dashboard/browser capability was unavailable during this review. Leaked-password protection remains a hosted Auth advisory; student access is anonymous, while authorized staff use email/password.

## QA records and evidence

Synthetic identities are marked by exact UUID with a trusted `qa_cohort_id`, not by their display name. Students cannot set this marker. Student reports exclude marked QA by default; staff can review QA-only or combined scopes, including zero-answer registrations. Mixed exports identify synthetic rows. Teacher detail views show stored scoring/review versions and dates. Historical rubric values retain their original meanings.

The independent review cohort uses 24 distinct agent session fixtures across all 10 strands and both IGNITE years. Live execution and observed quota results are recorded separately after deployment; a prepared fixture is not a completed live session. The requested LLM counsel skill was not installed, so reviews use independent agents and explicit tests without claiming that skill ran.

Local checks before deployment: lint, types, 464 unit tests, production build; recorder editing: 39 browser cases across desktop Chrome, mobile Chrome and WebKit. Actual Redis tests: 200 simultaneous provider admissions admitted 4; 200 simultaneous upload admissions admitted 8. Excess requests were rejected with bounded retry handling. These are admission tests, not 200 complete real-provider interviews. Full CI and live teacher verification remain release gates.

Production dependency audit passes. The existing development-only picomatch advisory has no patched release and remains under its exact, time-limited exception expiring December 1, 2026; it is not fixed by this change.

References: [Groq rate limits](https://console.groq.com/docs/rate-limits), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

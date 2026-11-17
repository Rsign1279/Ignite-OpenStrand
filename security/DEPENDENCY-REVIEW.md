# Temporary development-tool advisory

Reviewed 2026-11-17: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects picomatch through 4.0.7. The advisory was expanded on November 17 after the preceding release. There is no published patched version. A forced Vitest downgrade does not repair picomatch; the referenced upstream PR also states that `+(*a)` remains vulnerable.

This is an accepted, temporary development-tool risk, **not a fixed vulnerability**. All affected installed paths are marked development-only in the lockfile. They belong to linting, test discovery, and build tooling. Application code does not accept or evaluate user-supplied glob patterns. The production dependency audit passes without an exception. Do not run this tooling against untrusted glob patterns or expose a development server to untrusted users.

The release audit still runs the strict production check and examines the full audit. Its sole exception requires this exact advisory, severity, affected range, reviewed picomatch versions, and development-only dependency paths. Unrelated advisories, production paths, unknown dependency chains, a new latest picomatch release, and the December 1 UTC expiry all block CI. Tests cover those boundaries. The CI log reports the exception explicitly.

Remove the exception and upgrade when a patched release is available. Do not broaden the affected versions or extend the expiry without another review. The rubric change does not change installed dependencies or their lockfile.

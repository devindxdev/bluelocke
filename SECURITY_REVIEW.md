# Security review — 2026-10-29

Reviewed the Scriptable source and dependency tree for v1.26.0 after the single-car rollback, session repairs, and first-run save fix. This is a source review with simulated Scriptable regression tests, not a penetration test of Hyundai/Kia/Genesis infrastructure or a guarantee of no vulnerabilities.

## Confirmed findings addressed

| Area | Finding and impact | Change |
| --- | --- | --- |
| API TLS — high | The shared API client explicitly accepted invalid certificates, exposing passwords and tokens to network interception. | Require HTTPS and normal certificate validation; reject URL credentials and unsafe redirects. Credential-bearing requests cannot redirect to another origin. Explicit authentication navigation can visit only configured regional hosts using a fresh GET without the original headers/body. |
| Session revocation — high | An existing client retained its in-memory credentials after an account change/reset and could initiate an old-account command or restore a deleted cache. | Check current account and session generation before requests/commands, after network responses, and before cache writes. Reset invalidates old instances even if the same account is configured again. Already accepted remote operations cannot be recalled. |
| Cache ownership — medium | Legacy keys removed spaces from script names and did not bind completed caches to an account. Distinct script names could reuse another profile's token/data. | Use exact script keys and bind completed snapshots to account identity and session generation. Do not import unbound legacy authentication/status. Retain only the v1.25 authentication migration whose exact-script configuration and account scope can be verified. |
| OAuth callbacks — medium | Prefix matching could accept lookalike callback paths/hosts, and the Kia Europe web login used a fixed state. Authentication values were interpolated without consistently encoding them. | Compare parsed HTTPS origins and exact callback paths; generate and check per-login state; require a single code value and encode values before reuse. |
| Update installation — medium | The downloaded update URL was not constrained to the project release asset, and installation moved the working script before confirming replacement could be written. | Require the configured repository's HTTPS release asset, restrict redirect hosts, reject unusable downloads, stage first, keep a backup, and restore it if installation fails. |
| Diagnostics — medium | PIN authorization fields such as `pAuth`/`authCode` were not included in the private-field detector. | Add redaction coverage for these fields and regression tests. Diagnostic HTML keeps escaped text and now has a restrictive content security policy. |
| API photos — defense in depth | Cleartext photo URLs and local network destinations were accepted. Decoded image dimensions were unbounded. | Require HTTPS without URL credentials, reject literal/local destinations and unsafe redirects, and cap decoded dimensions. No account authentication headers are sent. DNS behavior and native image decoding remain platform responsibilities. |
| Build dependencies | Initial full dependency audit reported 14 entries, including 7 high severity entries. | Upgrade affected packages, including Rollup and the Terser plugin; add a lockfile with integrity hashes. Full audit now reports no critical, high, or moderate entries. |

Scriptable documents that `allowInsecureRequest` accepts invalid certificates and that redirects are allowed by default: [Request documentation](https://docs.scriptable.app/request/). The fixed Rollup advisory is [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc).

## Remaining dependency finding

The full npm audit still reports **two low severity entries for one underlying `deepmerge` issue**, through `@rollup/plugin-node-resolve`. The installed upstream version has no published patch in the [reviewed advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). This is development/build tooling; no vulnerable merge path from vehicle API data was identified in the inspected code. npm's suggested resolver downgrade is a breaking change and was not applied blindly. Build only trusted source/configuration/plugins and reassess when an upstream fix is available.

`npm audit --omit=dev` reports zero entries, but that is not a separate runtime security certification: this project declares its tooling and polyfill provider as development dependencies. The full-tree audit is the relevant count above.

## Validation and practical limits

- Regression coverage includes stale-account commands, same-account reset races, in-flight status writes after reset, script-name collisions, TLS/redirect handling, callback confusion, update-source validation, failed-install restoration, private API authorization fields, and image restrictions.
- Existing tests continue to cover first-run autosave, regional status parsing, session/MFA recovery, photo editing, widgets, and public error messages.
- TypeScript, ESLint, production build, and generated JavaScript syntax are checked before delivery; the final response records the total passing test count.
- No real account credentials, live car commands, or OTP messages were used in this review. Regional login flows, especially the stricter Europe callback/redirect handling, still need device confirmation.
- Updates still trust the configured GitHub maintainer account, GitHub's HTTPS release delivery, and the user's install confirmation; there is no independent application signing key. Restricting the URL does not protect against a compromised maintainer account.
- Scriptable and iOS provide Keychain isolation/encryption, networking, image decoding and WebView behavior. This review does not audit those native implementations or protect against another deliberately malicious Scriptable script with equivalent access.

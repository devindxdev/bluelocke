# Bluelocke v1.26.1-beta.4 — Hyundai Europe test build

Includes the reviewed changes from [PR #3, “Fix Hyundai Europe login and hybrid status”](https://github.com/devindxdev/bluelocke/pull/3) by **mariancapota**, on top of beta.3. The reviewed PR head is **23d7d45a823d08de029ca35bd3142ba9b7c9c6f0**.

## Changes from beta.3

- Use the PR’s Hyundai Europe OneApp/CCI password login and token refresh, including its RSA password encryption and signed headers.
- Handle EU hybrid/ICE status without a charging section, retain reported fuel and 12V readings, and correct the door-lock interpretation.
- Preserve the modern Settings/setup, custom-photo editor with direct Save, image fallbacks, US climate fixes, and redacted diagnostics from beta.3.

The EU login changes follow the PR as submitted. No extra TLS, callback, RSA, or shared authentication changes were added. Other regions retain their v1.24.4 login, verification, and cache implementation. Kia Europe’s existing login methods are preserved.

## Review and validation

No malicious behavior was found in the reviewed source. The new login requests target Hyundai-owned hosts; there are no added analytics destinations, remote code loaders, install hooks, or unrelated account-data writes. The pinned **@noble/hashes 1.8.0** dependency was checked against the npm registry and installed without running lifecycle scripts. Its license notice is retained in the generated script. The PR’s prebuilt script was not used; this asset was rebuilt from the reviewed source.

All **318 automated tests** passed, together with TypeScript, lint, production build, generated-script syntax, and a runtime dependency audit with zero reported vulnerabilities. Tests cover the PR’s encryption, signed requests, login/refresh responses, hybrid/EV status, and log redaction, plus integration into the existing regional client and the beta.3 regression suite. Live Hyundai Europe login and native iOS behavior still need confirmation.

## Install for testing

1. Download the attached **bluelocke.js** asset.
2. Replace all code in your existing Bluelocke Scriptable script and save.
3. **Keep the existing script name** to reuse its settings and cache. Run it in Scriptable, with your account region set to **Europe**, and complete any instructions shown.
4. Confirm **v1.26.1-beta.4** in About, then test status and your widgets/Shortcuts.

For feedback, include manufacturer, model/year, the login or refresh step that failed, and fresh redacted logs from **Help & Support > Help & updates**. Beta.3 remains available for users whose existing setup is working. This prerelease does not replace stable **v1.26.0** or install through normal stable-update checks.

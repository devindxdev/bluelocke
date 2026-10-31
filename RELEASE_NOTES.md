# Bluelocke v1.27.0

Stable release of the beta.4 build, numbered v1.27.0 so the updater in v1.26.x recognizes a new minor release and prompts users, with the v1.24.4 authentication implementation for other regions and the reviewed Hyundai Europe login and hybrid-status fixes from [PR #3](https://github.com/devindxdev/bluelocke/pull/3) by **mariancapota**. No additional login or security changes were introduced when promoting this release.

## What changed

- Restore the v1.24.4 login, verification, token refresh, device-ID, and cache behavior outside the targeted Hyundai Europe update.
- Add Hyundai Europe OneApp/CCI login and token refresh, handle hybrid status without charging data, and correct EU door-lock reporting. Kia Europe’s existing login methods are preserved.
- Restore modern Settings and first-time setup, with Account, Vehicle, Climate, Appearance & Units, and Help & Support, plus autosave, Continue, and Back navigation.
- Import custom vehicle photos from Photos or Files and frame them in a live widget preview with drag, pinch, crop, and size/position controls. **Save** applies the photo immediately inside the editor, without closing first or confirming “Use Image.” Save errors stay inline for retry. Scriptable’s native Share control remains separate from this Save button.
- Read fuel range on vehicles without an EV status section, including older Tucson models, with kilometre/mile conversion. Restore 12V readings from alternate API fields.
- Select vehicle images in order: custom photo, matching GitHub model/trim/color image, API-provided photo, existing default.
- Correct Hyundai US petrol climate start/stop routes, temperature conversion, and petrol duration limits. Preserve confirmed command success when a follow-up status refresh fails, and omit unsupported options on older Hyundai EVs.
- Restore readable, indented API responses and debug logs. Redact sensitive account details, credentials, vehicle identifiers, and location data before viewing or sharing. Public errors do not display raw API requests.

## Update to v1.27.0

Open the information/About screen, or **Settings > Help & Support > Help & updates**, then choose **Click to Auto Install v1.27.0** and confirm installation.

**Update prompts:** v1.27.0 is a minor-version update, so v1.26.x installations with update prompts enabled can show the update notification when you run Bluelocke in Scriptable. If prompts were disabled, open **Help & updates** manually.

For a manual installation, download the attached **bluelocke.js**, replace all code in your existing Scriptable script, and save. **Keep the existing script name** to reuse its settings and cache. Run it once in Scriptable, complete any requested verification, and refresh your widgets. The About screen should show **v1.27.0**.

Custom photos are under **Settings > Vehicle > Vehicle photo**. For support, include your region, manufacturer, model/year, and fresh redacted debug logs from **Help & updates**.

## Validation

All **319 automated tests** passed, with TypeScript, lint, production build, generated-script syntax, and a runtime dependency audit reporting zero known vulnerabilities. Coverage includes original authentication/cache behavior, the reviewed EU login/status code, Settings/setup, startup of the generated script, photo Save/cancel/retry, vehicle image fallback, US climate commands, and diagnostic redaction.

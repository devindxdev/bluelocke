# Bluelocke v1.26.1-beta.3

Beta test build rebuilt from the supplied **v1.24.4** release, with the **v1.26.0 Settings UI** and the requested vehicle, climate, image, and diagnostic improvements. Login requests, verification, token refresh, device IDs, and cache storage use the v1.24.4 implementation.

## Included in this beta

- Modern Settings and first-time setup: Account, Vehicle, Climate, Appearance & Units, and Help & Support, with autosave, Continue, and Back navigation.
- Custom photos from Photos or Files, framed directly in a live widget preview using drag, pinch, crop, and size/position controls. **Save** applies the photo and crop immediately inside the editor; no closing first or confirming “Use Image.” Save errors stay inline for retry.
- Fuel range without an EV status section, including older Tucson models, with kilometre/mile conversion; alternate API fields restore 12V readings.
- Image priority: custom photo, matching GitHub model/trim/color image, API-provided photo, existing default.
- Correct Hyundai US petrol climate start/stop routes, US temperature conversion, and petrol duration limits. Confirmed commands remain successful when the follow-up status refresh fails. Older Hyundai EVs omit unsupported climate options.
- Indented API responses and debug logs, with account details, credentials, vehicle identifiers, and location data redacted before viewing or sharing. Public errors do not show raw API requests.

## Install or replace an earlier beta

1. Download the attached **bluelocke.js** asset.
2. Open your existing Bluelocke script in Scriptable and replace **all** its code with the downloaded file’s contents, then save.
3. **Keep the existing script name** to reuse its v1.24.4 settings and cache keys.
4. Run it in Scriptable, finish any requested verification, then refresh your widgets. The About screen should show **v1.26.1-beta.3**.

Custom photos are under **Settings > Vehicle > Vehicle photo**. Tap **Save** inside the editor before closing. Scriptable’s own native Share control remains; its WebView API does not expose a way to replace that toolbar button.

This prerelease requires manual installation. It does not replace the stable **v1.26.0** release or install through normal stable-update checks.

## Testing and feedback

Please test sign-in and verification, Settings/setup navigation, custom-photo Save/cancel/retry, widgets and Shortcuts, fuel range and 12V readings, and US climate commands where supported. Include your region, manufacturer, model/year, and the behavior you observed in feedback. Sanitized diagnostics are available through **Help & Support > Help & updates > Share Debug Logs**.

Validation: **272 automated tests** passed, along with TypeScript, lint, the production build, and generated-script syntax checks. Tests cover the original authentication methods, Settings parity with v1.26.0, startup of the generated script, photo-save behavior, status parsing, climate payloads, and log redaction. Live vehicle-service behavior and native iOS controls still need tester confirmation.

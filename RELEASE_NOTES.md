# Bluelocke v1.27.1-beta.3 — Australian timestamps and API diagnostics

Fixes API response sharing hiding the entire state.Vehicle payload. Vehicle readings and sensor states now remain visible while credentials, identifiers, and location stay redacted.

Fixes Australian last-update timestamps such as 20261102074326 being treated as milliseconds. Bluelocke now parses compact dates, prefers the vehicle’s UTC Date field, and waits for genuinely newer data during a forced refresh.

Replace the code in your existing Scriptable script with the attached bluelocke.js. Keep your existing script name and settings. Fetch a fresh API response after updating and share that new capture; previously redacted payloads cannot be recovered.

Also includes the earlier betas’ Hyundai Europe device recovery and multi-car vehicle picker.

All 403 automated tests, TypeScript, lint, and build checks pass. Live Australian, EU, and multi-car testing remain pending. The stable release remains v1.27.0.

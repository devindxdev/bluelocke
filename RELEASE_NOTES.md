# Bluelocke v1.27.1-beta.2 — Hyundai Europe device recovery

Fixes Hyundai Europe sessions that stop working with “Invalid deviceId,” including unlock succeeding before an immediate lock fails. Bluelocke now registers and saves a replacement device ID and retries the rejected request once. Control tokens are renewed when the device, session, or selected vehicle changes.

Replace the code in your existing Scriptable script with the attached bluelocke.js. You can keep the name bluelocke and your existing settings; renaming or resetting should not be necessary.

Also includes the previous beta’s Settings → Vehicle → Selected vehicle picker for multi-car accounts. Each script remembers its chosen car for the app, widgets, and Shortcuts.

Please test loading the app, unlocking then locking, and running the script again under its usual name. If it fails, use Share Debug Logs and report which action failed.

All 386 automated tests, TypeScript, lint, and build checks pass. Live EU and multi-car testing remain pending. The stable release remains v1.27.0.

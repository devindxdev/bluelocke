# Bluelocke v1.26.1

Restores the v1.24.4 sign-in, token-refresh, and verification flow while preserving compatibility with accounts saved by newer versions.

- Removes persistent sign-in locks and foreground-verification flags that could prevent another login attempt.
- Restores Canada's original verification flow and two-minute resend cooldown, and Kia US's send-code, enter-code, verify, and login sequence. Cancelling or failing verification starts a new challenge on the next attempt.
- Restores v1.24.4 regional response handling for authentication renewal.
- Preserves matching saved credentials, tokens, trusted-device IDs, settings, and completed vehicle snapshots when updating from v1.26.0 or v1.26.1-beta.1. No account reset is required. Expired sessions use the normal refresh/login flow.
- Keeps current TLS, log redaction, account isolation, and update-installation protections, along with the newer vehicle, climate, image, and Settings features.
- Includes patch releases in automatic update prompts from this version onward.

## Updating

Open **Settings > Help & Support > Help & updates**, or replace the existing Scriptable script with the release's `bluelocke.js`. Keep the same script name to retain saved data. Run it once after updating, then refresh your widgets. If verification is requested, finish it in Scriptable. The older stable and beta builds may require checking for this patch manually.

## Validation

Regression tests cover upgrades from both the stable and beta releases in app, widget, and Shortcut contexts, saved and expired sessions, interrupted setup, verification, and account/reset isolation. Real vehicle-service authentication and OTP delivery still require confirmation on a device with an actual account.

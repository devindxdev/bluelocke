# Bluelocke v1.26.1-beta.2

Beta build for users still having sign-in problems with v1.26.0 or v1.26.1-beta.1. This build restores the v1.24.4 login, token-refresh, and verification flow while keeping support for accounts saved by newer versions.

- Removes persistent sign-in locks and saved foreground-verification flags that can block another login attempt.
- Preserves matching saved credentials, sessions, trusted-device IDs, settings, and cached vehicle status when updating from v1.26.0 or v1.26.1-beta.1. A settings reset is not required.
- Restores Canada's original verification flow and two-minute resend cooldown, and Kia US's send-code, enter-code, verify, and login sequence. Cancelling or failing verification starts a new challenge on the next attempt.
- Keeps the newer vehicle, climate, image, and Settings features, along with TLS, log redaction, account isolation, and update-installation protections.

## Install this beta

1. Download the attached **bluelocke.js** file.
2. In Scriptable, open your existing Bluelocke script and replace all of its code with the downloaded file's contents, then save.
3. **Keep the existing script name** to retain your saved account and widget settings.
4. Run the script once in Scriptable, then refresh your widgets. If verification is requested, finish it in Scriptable.

If you installed beta.1, follow these same steps to replace it with beta.2. Normal stable update checks will not install this prerelease automatically. The stable release remains **v1.26.0**.

## Validation and feedback

The auth rollback passed all **354 automated regression tests**, including upgrades from the stable and previous beta releases in app, widget, and Shortcut contexts. TypeScript, lint, production build, and generated JavaScript syntax checks passed. Live vehicle-service login and OTP delivery still need confirmation on affected devices.

If sign-in still fails, enable **Diagnostic logging** in **Settings > Help & Support > Troubleshooting**, reproduce the problem, and share fresh logs using **Share Debug Logs**. Keep the same script name and saved settings while testing.

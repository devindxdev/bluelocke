---
title: Help / FAQ
nav_order: 10
---

# Help / FAQ

## Widgets stopped updating

- Open Scriptable and run `bluelocke` once manually.
- Confirm login/config are valid.
- Open the app and refresh the vehicle status. Widget refresh intervals are managed automatically.

## Script fails after working before

- Re-run setup and confirm credentials, region, and PIN.
- Force a status refresh from the app UI.
- If still failing, turn on **Diagnostic logging** under **Settings > Help & Support > Troubleshooting**. View logs under **Help & updates**.

Successful sign-ins are saved independently of vehicle/status loading. A temporary vehicle API failure should not discard your login. Widgets and Shortcuts never send verification codes: when verification is required, open the script in Scriptable. Sign-in and verification follow the v1.24.4 flow again. If you cancel or enter an incorrect code, reopen the script to start verification again. Canada retains its two-minute cooldown for verification-code requests.

## Sign-in stays in progress

Version 1.26.1 removes the persistent sign-in locks introduced after v1.24.4. Updating from v1.26.0 or v1.26.1-beta.1 automatically retires those locks and newer verification flags while preserving matching saved sessions, device IDs, settings, and vehicle status. Replace the script using the same Scriptable script name, then run it once and refresh the widget. An expired session renews normally; if the vehicle service requests verification, complete it in Scriptable.

## Siri command not recognized

- Ensure text is passed as Shortcut input to `Run Script`.
- Use exact command phrases (`auto lock`, `status remote`, `climate off`, etc.).

## Region or vehicle not behaving as expected

- Verify manufacturer + region match your account.
- Some API capabilities differ by market and model year.

## Getting support

Debug and error logs remove credentials, authentication tokens, verification codes, cookies, account and vehicle identifiers, and location/contact details before saving or sharing. Historical logs are also sanitized when read through the app. Error codes, model information, and vehicle readings remain available for troubleshooting. Use the in-app **Share Debug Logs** action to share the sanitized output.

Choose the path that fits the issue:

<div class="support-links">
  <a class="support-link-card" href="https://github.com/devindxdev/bluelocke/issues" target="_blank" rel="noopener noreferrer">
    <strong>GitHub Issues</strong>
    <span>Use this for bug reports, feature requests, and public issues that are useful for the project to track openly.</span>
  </a>

  <a class="support-link-card" href="https://cal.com/bydev.devind/30min" target="_blank" rel="noopener noreferrer">
    <strong>Bluelocke Setup &amp; Support Call</strong>
    <span>Use this if you want personal 1:1 help with setup, login problems, widgets, shortcuts, or troubleshooting.</span>
  </a>
</div>

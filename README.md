# Bluelocke

Bluelocke is a Scriptable app for iOS that lets you monitor and control Hyundai, Kia, and Genesis vehicles using Bluelink-compatible APIs.

## Features

- Home screen and lock screen widgets
- In-app controls for lock, unlock, climate, and status refresh
- Siri and Shortcuts support, including text-command workflows
- Automation support (for example walk-away lock patterns)
- Auto-update flow from GitHub releases
- Custom vehicle photos from Photos or Files, framed in a live widget preview with drag, pinch, and crop controls
- Vehicle image fallback: custom photo, matching GitHub model/trim/color image, API photo, existing default
- Fuel range and alternate 12V readings for older vehicles, plus corrected Hyundai US climate commands
- Readable diagnostics with account, vehicle, credential, and location redaction

## Documentation

- Main docs: [devindxdev.github.io/bluelocke](https://devindxdev.github.io/bluelocke/)
- Installation: [docs/installation](https://devindxdev.github.io/bluelocke/installation)
- Features: [docs/app-features](https://devindxdev.github.io/bluelocke/app-features)
- Widgets: [docs/widgets](https://devindxdev.github.io/bluelocke/widgets)
- Siri/Shortcuts: [docs/shortcuts](https://devindxdev.github.io/bluelocke/shortcuts)
- Auto-update and releases: [docs/auto-update](https://devindxdev.github.io/bluelocke/auto-update)

## Quick Install

1. Install [Scriptable](https://scriptable.app/) on iOS.
2. Open releases: [github.com/devindxdev/bluelocke/releases](https://github.com/devindxdev/bluelocke/releases)
3. Use the latest `bluelocke.js` release asset in your Scriptable script.
4. Run the script once and complete setup (region, brand, credentials, PIN, preferences).

## Need Help Setting It Up?

If you want personal help getting Bluelocke working, book a [Bluelocke Setup & Support Call](https://cal.com/bydev.devind/30min).

Use GitHub issues for public bugs and feature requests:
- [github.com/devindxdev/bluelocke/issues](https://github.com/devindxdev/bluelocke/issues)

## Development

### Repo Structure

- `/src`: app source code (TypeScript)
- `/build`: generated Scriptable output
- `/docs`: documentation site (GitHub Pages / Just the Docs)
- `/.github/workflows/docs.yml`: docs deploy workflow

### Build

Requires Node.js 20 or newer.

```bash
npm install
npm run build
```

### Lint

```bash
npm run lint
```

### Checks

```bash
npm test
npx tsc --noEmit
```

The rebuild starts from the exact v1.24.4 release supplied by the user; v1.26.1 adds the reviewed Hyundai Europe login and hybrid-status changes from PR #3. Authentication regression checks compare the executable sign-in, verification, token-refresh, device-ID, and cache methods against fingerprints from that release, with only the three reviewed EU authentication methods checked against PR #3 instead. Settings and first-time setup match the v1.26.0 UI, including autosave, Continue, and Back navigation. The generated script is also tested directly to verify its entry points and original login route.

The modern Settings page can be previewed with `node scripts/preview-app-ui.mjs /absolute/path/settings.html`.

The photo editor can be previewed locally with `node scripts/preview-vehicle-image.mjs /absolute/path/preview.html`. It uses sample data and does not contact a vehicle service. Final iOS touch behavior still needs a check in Scriptable.

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE).

<sub>This repo was forked from [Andy Fase's upstream work](https://github.com/andyfase/egmp-bluelink-scriptable) and overhauled to support HEV &amp; EV with a huge focus on widgets and walk-away auto lock.</sub>

# Bluelocke

Bluelocke is a Scriptable app for iOS that lets you monitor and control Hyundai, Kia, and Genesis vehicles using Bluelink-compatible APIs.

## Features

- Home screen and lock screen widgets
- In-app controls for lock, unlock, climate, and status refresh
- Siri and Shortcuts support, including text-command workflows
- Automation support (for example walk-away lock patterns)
- Auto-update flow from GitHub releases
- Vehicle image overrides by trim/color for supported Tucson variants, with API photos as a fallback

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
npm run test:app-ui
npm run test:vehicle-status
npm run test:us-climate
npm run test:vehicle-loading
npm run test:logs
npm run test:auth
npm run test:user-errors
npm run test:security
npm run test:vehicle-images
```

The UI checks exercise Settings navigation and saved preferences with simulated Scriptable APIs. To review Settings, run `node scripts/preview-app-ui.mjs /absolute/path/preview.html`. The preview reuses the Settings renderer; final fonts and selection behaviour are supplied by iOS.

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE).

<sub>This repo was forked from [Andy Fase's upstream work](https://github.com/andyfase/egmp-bluelink-scriptable) and overhauled to support HEV &amp; EV with a huge focus on widgets and walk-away auto lock.</sub>

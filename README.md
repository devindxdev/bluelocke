# Bluelocke

Bluelocke is a Scriptable app for iOS that lets you monitor and control Hyundai, Kia, and Genesis vehicles using Bluelink-compatible APIs.

## Project Origin

This project is forked from Andy Fase's upstream work:

- Upstream repo: [andyfase/egmp-bluelink-scriptable](https://github.com/andyfase/egmp-bluelink-scriptable)
- Upstream docs: [bluelink.andyfase.com](https://bluelink.andyfase.com)

Andy built the original foundation this project is based on. Credit to Andy for the core architecture, feature direction, and initial docs structure.

## Features

- Home screen and lock screen widgets
- In-app controls for lock, unlock, climate, and status refresh
- Siri and Shortcuts support, including text-command workflows
- Automation support (for example walk-away lock patterns)
- Auto-update flow from GitHub releases
- Vehicle image overrides by trim/color for supported Tucson variants

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

## Development

### Repo Structure

- `/src`: app source code (TypeScript)
- `/build`: generated Scriptable output
- `/docs`: documentation site (GitHub Pages / Just the Docs)
- `/.github/workflows/docs.yml`: docs deploy workflow

### Build

```bash
npm install
npm run build
```

### Lint

```bash
npm run lint
```

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE).

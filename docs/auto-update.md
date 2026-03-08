---
title: Auto Update
nav_order: 11
---

# Auto Update

Bluelocke checks GitHub releases and can prompt for updates on app launch.

## To Publish an Update

1. Bump `src/version.json` (for example `v1.16.0`).
2. Build:
   - `npm run build`
3. Commit and push changes.
4. Create and push a matching git tag.
5. Create a GitHub release for that tag and attach `build/bluelocke.js`.

If the installed script is older than the latest release, users will see an update prompt.

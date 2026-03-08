---
title: Siri & Shortcuts
nav_order: 6
---

# Siri & Shortcuts

Run `bluelocke` from Shortcuts and pass text through `Shortcut Input`.

## Example Commands

- `lock`
- `unlock`
- `auto lock`
- `status`
- `status remote`
- `data`
- `warm`
- `cool`
- `climate off`
- `start charging`
- `stop charging`

## Auto-Lock

`auto lock` performs logic before sending a lock command:

1. If already locked -> returns `Vehicle is already locked.`
2. If running -> returns `Vehicle running.`
3. Otherwise -> sends `lock`.

## Shortcut Setup

1. Create a new Shortcut.
2. Add `Run Script` (Scriptable).
3. Select `bluelocke`.
4. Pass a text value as input, for example `auto lock`.
5. Run manually or connect to Siri phrase / automation trigger.

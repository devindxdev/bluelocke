---
title: Automations
nav_order: 7
---

# Automations

Use iOS Shortcuts automations to run Bluelocke commands automatically.

## Common Automation Ideas

- Walk-away lock: trigger on disconnect from car Bluetooth and run `auto lock`
- Morning pre-heat/pre-cool: time-based `warm` or `cool`
- Charge routines: `start charging` / `stop charging` based on schedule
- Status checks: periodic `status remote` then later `status`

## Recommended Pattern

1. Build and test each command manually in a Shortcut first.
2. Add an automation trigger (time, location, Bluetooth, focus mode, etc.).
3. Reuse the same Shortcut to keep logic centralized.
4. Use notifications in the Shortcut to display result text.


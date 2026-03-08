---
title: Multi Car
nav_order: 9
---

# Multi Car

Bluelocke includes a `Multi Car Support` config option that changes cache handling.

## Current Behavior

- Vehicle selection is resolved from account vehicle data and cached state.
- In multi-vehicle accounts, Bluelocke uses available vehicle context from the API/cache path.
- Enabling `Multi Car Support` separates cache keys per script instance.

## Practical Setup

For cleaner separation, use one Scriptable script per car profile:

1. Duplicate script with a unique name.
2. Enable `Multi Car Support`.
3. Configure each script for the intended vehicle/account context.
4. Point widgets/shortcuts at the specific script name.


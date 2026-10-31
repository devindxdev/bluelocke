---
title: Multi Car
nav_order: 9
---

# Multi Car

Bluelocke can select any vehicle returned by your connected service account.

## Choose a Vehicle

1. Open Bluelocke in Scriptable.
2. Open **Settings → Vehicle → Selected vehicle**.
3. Choose a car. Each entry shows its name, model, and the last six characters of its VIN.

Bluelocke saves the choice and reopens with that car. Its widgets, Siri commands, and Shortcuts use the same selection. Switching cars reuses your account login and fetches fresh status, so readings and locations from the previous car do not carry over.

Display names and vehicle-type overrides are remembered separately for each car. Custom photos are already stored by VIN. Climate presets, appearance, and units remain script preferences.

If a selected vehicle is removed from the account, Bluelocke shows an error when resolving it. Use the error screen's **Settings** action to choose another vehicle.

## Practical Setup

To keep widgets or Shortcuts for different cars at the same time, use one Scriptable script per car:

1. Duplicate the script with a unique name.
2. Open each copy and choose its vehicle in **Settings → Vehicle → Selected vehicle**.
3. Point each widget or Shortcut at the corresponding script name.

Selecting a vehicle automatically enables separate script caches. There is no extra multi-car switch to enable. Each script remembers its own selection; changing the selected car in one script does not change another script's choice.

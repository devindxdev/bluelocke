---
title: Multi Car
nav_order: 9
---

# Multi Car

Each Scriptable script uses one selected vehicle. Its app, widgets, and Shortcuts all use that choice.

## Choose a Vehicle

Open the script in Scriptable after completing your account details. If your account has one vehicle, it is selected automatically. If it has several, choose one from the list. Bluelocke remembers your choice even if the API returns the vehicles in a different order.

To change it later, open **Settings > Vehicle > Selected vehicle**. The app loads the new vehicle's status before saving the change. If it cannot load or save, your previous vehicle remains selected. The display name and vehicle-type override reset when you change cars; custom photos stay associated with their vehicle.

The list shows the model/year and nickname where available. VIN is optional: Bluelocke uses a full VIN when supplied and the regional API's vehicle ID otherwise. There is no VIN to enter manually.

## A Second Vehicle

1. Duplicate the script in Scriptable and give it a different name, such as **Bluelocke — Santa Fe**.
2. Open that script, enter its account details, and choose the second vehicle.
3. Set each widget and Shortcut to run the appropriate script.

Account settings, vehicle selection, and status caches are separated automatically by exact script name. There is no multi-car toggle. Renaming a script creates a separate setup.

## Updating or Recovering

On the first run after this update, open each script in Scriptable to confirm its vehicle. Older account settings and preferences are kept where available, but old shared status is not used to guess your choice. Widgets and Shortcuts cannot choose a vehicle in the background.

If a selected vehicle disappears from the account, Bluelocke reports it instead of choosing another car automatically. Choose another vehicle in Settings. If initialization fails before the app opens, choose **Settings > Vehicle > Selected vehicle > Choose again**, then reopen the script.

---
title: App Features
nav_order: 4
---

# App Features

The app screen is designed for quick common actions and status visibility.

## Main Actions

- Refresh status
- Lock / unlock
- Climate on / off
- Charge start / stop (for supported vehicles)
- Charge limit selection (for supported vehicles)
- Open car location in Maps

## Settings

Open **Settings** from the main screen. Settings has five destinations:

- **Account** — manufacturer, region, credentials, PIN, and verification method
- **Vehicle** — selected vehicle, display name, and vehicle photo
- **Climate** — temperature, duration, defrost, and seat settings for Warm and Cool
- **Appearance & Units** — widget appearance, distance, and temperature units
- **Help & Support** — updates, diagnostics, vehicle detection, and recovery options

Settings save automatically when you change a switch, pick an option, or tap **Done** in a text field. **Cancel** keeps the previous field value. Nested Settings pages use **‹ Back**; Scriptable’s **Close** exits Settings. Account setup keeps partial progress, but continues to sign-in only once the required details are complete. Vehicle selection is applied after the new status loads successfully. Vehicle photos are saved separately after image confirmation.

Widget refresh intervals are managed automatically. Charge profiles, custom climate builders, and update-prompt toggles are not part of everyday settings. Existing saved charge and climate profiles remain available in the app and Shortcuts.

## Visuals

- Vehicle image with GitHub overrides for known models/trims/colors and an API photo fallback
- Custom vehicle images from Photos or Files, with a framing preview and size/position controls
- Last update time
- Odometer and 12V indicators where available

Vehicle images use this order: a saved custom photo, a matching GitHub model/trim/color image, the API-provided vehicle photo, then the existing default image. If a source is missing or fails to load, Bluelocke tries the next one. API photos are cached separately for each vehicle and script so later app and widget loads can use them offline. The photo request does not include your account credentials or API authentication headers.

## Custom Vehicle Images

After signing in, open **Settings > Vehicle > Vehicle photo**.

1. Choose an image from **Photos** or **Files**. A transparent PNG works well for a vehicle cutout; regular photos keep their background.
2. The widget itself is the live editor, with sample title, fuel/battery, range, and footer data around the photo. Drag the photo with one finger to position it; pinch with two fingers or drag its corner handle to resize it. Every change appears immediately inside the preview widget.
3. Use **Fit whole image** or **Fill frame** for a quick starting point. Expand **Fine-tune size and position** for sliders, or use a mouse wheel over the photo to zoom. **Light** and **Dark** change only the preview background, not your saved widget appearance.
4. The editor opens full screen so dragging the photo does not pull down or dismiss a sheet. Scroll outside the photo to reach the controls. Tap **Done**, then **Use Image** to save the framing you are viewing, or **Keep Current** to discard it. There is no separate read-only preview screen.
5. Close Settings to see the image in the app. Widgets show the same image on their next scheduled refresh.

The image is resized for the app and widgets, and a local copy is kept so you can adjust the crop later. Images stay on the device and are not uploaded. Each vehicle and script profile has its own image; it does not automatically sync to other devices.

Reopen **Vehicle photo** and choose **Preview & Adjust Image** to return directly to the live widget editor with your saved photo and crop, or to try framing the original vehicle picture. The editor uses the shared widget layout and image bounds; it does not refresh your vehicle, send commands, or change saved status.

**Restore Default Image** is always available. After confirmation it removes the custom photo and crop and returns to the matching GitHub model/trim/color image, the API photo, or the existing default, in that order. Image changes are saved separately from the vehicle name and type settings.


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

Open **Settings** from the main screen for the modern native layout:

- **Account** — manufacturer, region, credentials, PIN, and verification method
- **Vehicle** — display name and vehicle photo
- **Climate** — Warm and Cool presets
- **Appearance & Units** — widget appearance, distance, and temperature units
- **Help & Support** — updates, diagnostics, and recovery

Confirmed edits save automatically. **Cancel** keeps the previous value. Nested pages use **‹ Back**; Scriptable’s **Close** exits Settings. Existing climate profiles, charge limits, and widget intervals remain saved.

First-time setup uses the v1.26.0 **Welcome to Bluelocke** account page, with autosave and **Continue** once required details are complete. Closing and reopening setup preserves partial entries. The old configuration form is no longer included in the generated script. The modern pages use the original v1.24.4 configuration and vehicle-cache keys; login requests, verification, and token refresh are unchanged.

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
4. The editor opens full screen so dragging the photo does not pull down or dismiss a sheet. Scroll outside the photo to reach the controls. Tap **Save** inside the editor to apply the framing immediately. The button shows **Saved**, and further adjustments enable Save again. Closing without saving keeps your last saved image. There is no follow-up “Use Image” prompt.
5. Close Settings to see the image in the app. Widgets show the same image on their next scheduled refresh.

Scriptable supplies its own Close and Share toolbar; the direct **Save** button is in the editor itself.

The image is resized for the app and widgets, and a local copy is kept so you can adjust the crop later. Images stay on the device and are not uploaded. Each vehicle and script profile has its own image; it does not automatically sync to other devices.

Reopen **Vehicle photo** and choose **Preview & Adjust Image** to return directly to the live widget editor with your saved photo and crop, or to try framing the original vehicle picture. The editor uses the shared widget layout and image bounds; it does not refresh your vehicle, send commands, or change saved status.

**Restore Default Image** is always available. After confirmation it removes the custom photo and crop and returns to the matching GitHub model/trim/color image, the API photo, or the existing default, in that order. Image changes are saved separately from the vehicle name and type settings.


## Vehicle Status and US Climate

Reported fuel range is read even when the API omits an EV status section, including older Tucson models. Range values are converted between kilometres and miles when the API reports a different unit. Alternate 12V state-of-charge fields are supported.

Hyundai US petrol and hybrid vehicles use the remote engine start/stop routes. US climate temperatures are converted to Fahrenheit and petrol duration is limited to 1–10 minutes. Older Hyundai EVs omit unsupported duration and seat options. A confirmed command remains successful when a follow-up status refresh fails.

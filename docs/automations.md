---
title: Automations
nav_order: 6
---

# Automations

After [installing Bluelocke](./installation), use this guide to set up walk-away auto-lock with iOS Shortcuts. Start with **Auto-Lock (Safe)**, test it manually, then connect it to your car’s disconnect trigger.

<style>
  .automation-card {
    border: 1px solid #d0d7de;
    border-radius: 10px;
    padding: 0.95rem;
    margin: 0.8rem 0 1rem 0;
    background: #f8fafc;
  }
  .automation-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin: 0.6rem 0 0 0;
  }
  .automation-btn {
    display: inline-block;
    padding: 0.42rem 0.72rem;
    border-radius: 8px;
    border: 1px solid #1f6feb;
    background: #1f6feb;
    color: #ffffff !important;
    font-weight: 600;
    text-decoration: none !important;
    white-space: nowrap;
  }
  .automation-btn:hover {
    background: #1158c7;
    border-color: #1158c7;
  }
</style>

## Before You Start

- Open `bluelocke` in Scriptable, finish signing in, and check that the correct vehicle and its status appear.
- Keep the script named `bluelocke` so the ready-made shortcuts can find it.
- Make sure your iPhone has internet access after disconnecting from the car, such as cellular data. Bluelocke sends remote commands through your vehicle’s connected service.

## Recommended: Auto-Lock (Safe)

<blockquote class="warning-title">
  <p><strong>Warning: This can lock you out of the car.</strong></p>
  <p>If your phone is left inside the car and this automation runs, your car can lock while your phone is still inside.</p>
  <p>Always keep a key with you or ensure you have another unlock method available.</p>
</blockquote>

<div class="automation-card">
  <p><strong>Start here:</strong> Auto-Lock (Safe) checks whether the vehicle is unlocked and gives you a chance to confirm before locking.</p>
  <p><strong>Choose a trigger:</strong> Use Wi-Fi disconnect if your car’s wireless CarPlay network is available in Shortcuts. If it is unavailable, use the CarPlay disconnect option below.</p>
  <div class="automation-actions">
    <a class="automation-btn" href="https://www.icloud.com/shortcuts/dc6e0f8d1b5f4fff920f9de90d31bf45" target="_blank" rel="noopener noreferrer">Install Auto-Lock (Safe)</a>
    <a class="automation-btn" href="https://www.icloud.com/shortcuts/11e31f0ae30d4edcb001db6ae2ab082b" target="_blank" rel="noopener noreferrer">Install Auto-lock</a>
    <a class="automation-btn" href="./shortcuts">Open Shortcuts Docs</a>
  </div>
</div>

## 1. Install and Test the Safe Shortcut

1. On your iPhone, open [Auto-Lock (Safe)](https://www.icloud.com/shortcuts/dc6e0f8d1b5f4fff920f9de90d31bf45) and tap **Add Shortcut** in Shortcuts.
2. Open the shortcut’s editor. Check that its Scriptable **Run Script** actions point to `bluelocke`; select that script if an action has no script selected.
3. With the car parked and unlocked, stand outside with your phone and key. Run the shortcut manually and handle any Scriptable permission or sign-in prompts.
4. Confirm the lock prompt, then check that the car actually locks. Resolve any errors before adding the automation.

Installing the shortcut does not make it run automatically. Next, add the disconnect trigger.

## 2. Add the Disconnect Trigger

Open **Automation** in Shortcuts, tap **+** (or **New Automation**), and create a personal automation.

Menu names vary by iOS version. If you add a trigger directly to **Auto-Lock (Safe)** through **Edit → Automation**, use the same disconnect settings below; you do not need to add a **Run Shortcut** action.

### Wi-Fi Disconnect

Use this option if your iPhone connects to your car’s wireless CarPlay Wi-Fi network and Shortcuts lets you select it.

1. Connect to wireless CarPlay in your parked car, then choose **Wi-Fi** as the automation trigger.
2. Tap **Choose** beside the network field and select only your car’s network (SSID). Avoid **Any Network**, which could run the shortcut when you leave other Wi-Fi networks.
3. Choose **When I Disconnect**. If your iPhone does not offer that option or the car’s network is missing, use **CarPlay Disconnect** below.
4. Choose **Run Immediately** if shown. On versions with **Ask Before Running**, turn it off to let the automation start without a separate confirmation.
5. For an automation created from the **Automation** tab, tap **Next** if shown, then select your installed **Auto-Lock (Safe)** shortcut. If you get an action editor instead, add **Run Shortcut** and select it there.
6. Save the automation with **Done** or the save control shown on your iPhone.

**Run Immediately** controls whether the automation starts automatically. The safe shortcut’s own lock confirmation still needs your response.

### CarPlay Disconnect

If the Wi-Fi option is unavailable, choose **CarPlay → Disconnects** as the trigger and connect it to the same **Auto-Lock (Safe)** shortcut. Use the same run and save settings as above. This also provides an option for wired CarPlay.

A CarPlay disconnect can happen as soon as you turn the car off or unplug the phone, while you are still inside. Keep the safe shortcut’s confirmation and test the timing before relying on it.

For Apple’s instructions, see [adding an automation](https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios) and [CarPlay trigger options](https://support.apple.com/guide/shortcuts/apd8ebfc4e8e/9.0/ios/26). Select your iOS version at the top of the page.

## 3. Test the Full Automation

1. Park, turn the vehicle off, and take your phone and key with you. Leave the car unlocked for the test.
2. Disconnect in the way you normally would: walk out of Wi-Fi range, end CarPlay, or unplug your phone, depending on the trigger you selected.
3. Check your iPhone for the safe shortcut’s prompt and respond to it. If iOS asks you to unlock your phone, do so before continuing.
4. Allow time for the remote command, then check the car itself to confirm that it locked.

Repeat the test during a normal arrival before relying on it daily. A disconnect trigger does not measure how far you have walked from the car.

## Troubleshooting

- **The shortcut cannot find Bluelocke:** Open Scriptable and check that the script is named `bluelocke`. Re-select it in the shortcut’s **Run Script** actions.
- **The shortcut fails when run manually:** Open Bluelocke in Scriptable, resolve any sign-in or verification prompts, and check your internet connection. Get the manual shortcut working before troubleshooting the trigger.
- **Manual runs work, but nothing happens when leaving:** Check the chosen network and disconnect option, make sure the automation is enabled, and check its run setting. If Wi-Fi disconnect is unavailable, try CarPlay disconnect.
- **It stops at a prompt:** Respond to the safe shortcut’s confirmation. Setting the automation to **Run Immediately** does not remove prompts inside the shortcut.
- **It runs too early or more than once:** Check for duplicate automations and keep only one disconnect trigger enabled while testing. Use the safe shortcut while adjusting the setup.

## Advanced: Direct Auto-Lock

Use the direct **Auto-lock** shortcut only if you deliberately want the automation to lock without a confirmation prompt.

- Shortcut: [Install Auto-lock](https://www.icloud.com/shortcuts/11e31f0ae30d4edcb001db6ae2ab082b)
- After testing the safe version, switch your disconnect trigger to **Auto-lock**. Keep only one version enabled for the same trigger.
- Risk: if your phone is left inside the vehicle and the automation runs, you can lock yourself out more easily than with the safe version.

## Other Useful Automation Ideas

- Time-based warm/cool shortcut before commute
- Scheduled charge start/stop routines
- Periodic status refresh shortcut

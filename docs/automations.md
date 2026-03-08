---
title: Automations
nav_order: 7
---

# Automations

Use iOS Shortcuts automations to run Bluelocke commands automatically.

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

## Recommended: Walk-Away Auto-Lock (Wi-Fi Disconnect)

<blockquote class="warning-title">
  <p><strong>Warning: This can lock you out of the car.</strong></p>
  <p>If your phone is left inside the car and this automation runs, your car can lock while your phone is still inside.</p>
  <p>Always keep a key with you or ensure you have another unlock method available.</p>
</blockquote>

<div class="automation-card">
  <p><strong>Why this trigger:</strong> For Bluelocke, using <strong>Wi-Fi disconnect</strong> from your vehicle’s CarPlay Wi-Fi SSID is often more reliable than Bluetooth-only disconnect triggers.</p>
  <div class="automation-actions">
    <a class="automation-btn" href="https://www.icloud.com/shortcuts/b413eaa53d054242abaa0cddc3e3c951" target="_blank" rel="noopener noreferrer">Install Auto-Lock Shortcut</a>
    <a class="automation-btn" href="./shortcuts">Open Shortcuts Docs</a>
  </div>
</div>

## Setup Steps

1. Install the Auto-Lock shortcut:
   [https://www.icloud.com/shortcuts/b413eaa53d054242abaa0cddc3e3c951](https://www.icloud.com/shortcuts/b413eaa53d054242abaa0cddc3e3c951)
2. In iOS Shortcuts, go to `Automation` and tap `+` to create a new personal automation.
3. Choose `Wi-Fi` as the trigger.
4. Set trigger to `When I Disconnect` and select your vehicle’s CarPlay Wi-Fi network (SSID).
5. Add `Run Shortcut` and select your installed Auto-Lock shortcut.
6. Set it to run immediately (disable ask-before-running if desired).
7. Test while near your vehicle before relying on it daily.

## Fallback Trigger (If Needed)

If your vehicle setup does not provide stable CarPlay Wi-Fi disconnect events, use Bluetooth disconnect from the car profile as fallback.

## Other Useful Automation Ideas

- Time-based warm/cool shortcut before commute
- Scheduled charge start/stop routines
- Periodic status refresh shortcut


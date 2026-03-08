---
title: Siri & Shortcuts
nav_order: 6
---

# Siri & Shortcuts

Run `bluelocke` from Shortcuts and pass text through `Shortcut Input`.

<style>
  .shortcut-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.9rem;
    margin: 1rem 0 1.4rem 0;
  }
  .shortcut-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.9rem;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    background: #f8fafc;
  }
  .shortcut-icon {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    background: #e7eef8;
    flex: 0 0 auto;
  }
  .shortcut-body {
    flex: 1 1 auto;
    min-width: 0;
  }
  .shortcut-title {
    font-weight: 700;
    margin: 0 0 0.15rem 0;
  }
  .shortcut-desc {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.35;
  }
  .shortcut-caution {
    margin-top: 0.35rem;
    color: #7a2e00;
    font-size: 0.86rem;
    line-height: 1.3;
    font-weight: 600;
  }
  .shortcut-btn {
    flex: 0 0 auto;
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
  .shortcut-btn:hover {
    background: #1158c7;
    border-color: #1158c7;
  }
</style>

## Example Commands

- `lock`
- `unlock`
- `auto`
- `status`
- `status remote`
- `data`
- `warm`
- `cool`
- `climate off`
- `start charging`
- `stop charging`

## Auto-Lock

`auto` performs logic before sending a lock command:

1. If already locked -> returns `Vehicle is already locked.`
2. If running -> returns `Vehicle running.`
3. Otherwise -> sends `lock`.

## Ready-Made Shortcuts

<div class="shortcut-grid">
  <div class="shortcut-card">
    <div class="shortcut-icon">🛡️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Auto-Lock</p>
      <p class="shortcut-desc">Checks vehicle state first, then locks if appropriate. You can pair this with automations like Wi-Fi disconnect or Bluetooth disconnect to mimic walk-away lock behavior.</p>
      <p class="shortcut-caution">⚠️ Caution: If your phone is left inside the car and this runs, it can lock you out.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/b413eaa53d054242abaa0cddc3e3c951" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔓</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Unlock</p>
      <p class="shortcut-desc">Sends an immediate unlock command through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/b413eaa53d054242abaa0cddc3e3c951" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔒</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Lock</p>
      <p class="shortcut-desc">Sends an immediate lock command through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/6fc83bb72ba7417fad9ee4a3b1f8aa37" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>
</div>

## Shortcut Setup

1. Create a new Shortcut.
2. Add `Run Script` (Scriptable).
3. Select `bluelocke`.
4. Pass a text value as input, for example `auto`.
5. Run manually or connect to Siri phrase / automation trigger.

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

## Auto-Lock Shortcuts

<blockquote class="warning-title">
  <p><strong>Use care with auto-lock shortcuts.</strong></p>
  <p>If your phone is left inside the car and the shortcut runs, you can lock yourself out.</p>
</blockquote>

<div class="shortcut-grid">
  <div class="shortcut-card">
    <div class="shortcut-icon">🛡️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Auto Lock - Safe</p>
      <p class="shortcut-desc">Checks whether the vehicle is unlocked and prompts you before sending the lock command.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/280c50ea17d249b0bc2f253e88026c44" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">⚠️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Auto Lock</p>
      <p class="shortcut-desc">Immediately locks when its automation runs. Only use this if you understand the lockout risk.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/60993d114c28487a88851e7bf871fbf0" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>
</div>

## Ready-Made Shortcuts

<div class="shortcut-grid">
  <div class="shortcut-card">
    <div class="shortcut-icon">🔓</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Unlock</p>
      <p class="shortcut-desc">Sends an immediate unlock command through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/7a8a1f23728b4ffb87ef3fdcacb0cd86" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔒</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Lock</p>
      <p class="shortcut-desc">Sends an immediate lock command through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/647e2f473f964c8ea7bdf727219dac7f" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">❄️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Cool the Car</p>
      <p class="shortcut-desc">Starts the default cool climate preset through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/305654e50b174843b931d7fdec830147" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔥</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Warm the Car</p>
      <p class="shortcut-desc">Starts the default warm climate preset through Scriptable.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/7f226eb58405428392ae785068dd19a0" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>
</div>

## Shortcut Setup

1. Create a new Shortcut.
2. Add `Run Script` (Scriptable).
3. Select `bluelocke`.
4. Pass a text value as input, for example `lock` or `unlock`.
5. Run manually or connect to Siri phrase / automation trigger.

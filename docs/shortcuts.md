---
title: Siri & Shortcuts
nav_order: 7
---

# Siri & Shortcuts

Use the shortcuts below to lock, unlock, warm, or cool your car. Tap **Add Shortcut** on your iPhone, then tap **Add Shortcut** again in the Shortcuts app.

Bluelocke must be [installed and signed in](./installation) first. Your iPhone needs an internet connection to use these shortcuts.

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

Want your car to lock when you leave? The [Automations guide](./automations) explains the two options and how to set them up. Adding a shortcut below lets you try it by tapping it; follow that guide to make it run automatically.

<blockquote class="warning-title">
  <p><strong>Use care with auto-lock shortcuts.</strong></p>
  <p>If your phone is left inside the car and the shortcut runs, you can lock yourself out.</p>
</blockquote>

<div class="shortcut-grid">
  <div class="shortcut-card">
    <div class="shortcut-icon">🛡️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Auto-Lock (Safe)</p>
      <p class="shortcut-desc">Checks whether your car is unlocked, then asks you before locking it.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/dc6e0f8d1b5f4fff920f9de90d31bf45" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">⚠️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Auto-lock</p>
      <p class="shortcut-desc">Locks your car without asking first. Always take your phone and key with you.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/11e31f0ae30d4edcb001db6ae2ab082b" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>
</div>

## More Shortcuts

<div class="shortcut-grid">
  <div class="shortcut-card">
    <div class="shortcut-icon">🔓</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Unlock</p>
      <p class="shortcut-desc">Unlocks your car.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/7a8a1f23728b4ffb87ef3fdcacb0cd86" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔒</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Lock</p>
      <p class="shortcut-desc">Locks your car.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/647e2f473f964c8ea7bdf727219dac7f" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">❄️</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Cool the Car</p>
      <p class="shortcut-desc">Cools your car using your saved Cool settings.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/305654e50b174843b931d7fdec830147" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>

  <div class="shortcut-card">
    <div class="shortcut-icon">🔥</div>
    <div class="shortcut-body">
      <p class="shortcut-title">Warm the Car</p>
      <p class="shortcut-desc">Warms your car using your saved Warm settings.</p>
    </div>
    <a class="shortcut-btn" href="https://www.icloud.com/shortcuts/7f226eb58405428392ae785068dd19a0" target="_blank" rel="noopener noreferrer">Add Shortcut</a>
  </div>
</div>

{% include coffee_hint.html %}

## Try a Shortcut

Open the **Shortcuts** app and tap the shortcut you added. Follow any instructions on your phone to allow access or sign in.

You can also ask Siri to run it by saying “Hey Siri” followed by the shortcut’s name, such as “Lock”. Give your shortcuts clear names that are easy to say.

## Make Your Own Shortcut

The buttons above are the easiest way to get started. If you want to make your own:

1. In **Shortcuts**, create a new shortcut.
2. Add Scriptable’s **Run Script** action.
3. Select **bluelocke** as the script.
4. In **Shortcut Input**, enter what you want it to do, such as `lock` or `unlock`.
5. Give the shortcut a name and tap it to try it.

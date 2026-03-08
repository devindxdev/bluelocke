---
title: Installation
nav_order: 5
---

# Install Guide

<blockquote class="info-title">
  <p><strong>This is not an App Store standalone app.</strong></p>
  <p>Bluelocke runs inside the <a href="https://scriptable.app/" target="_blank" rel="noopener noreferrer">Scriptable iOS app</a>. You install Scriptable first, then install the <code>bluelocke.js</code> script file.</p>
  <p>Once installed, Bluelocke can prompt for new releases and supports one-tap upgrade from the app.</p>
</blockquote>

<style>
  .install-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.7rem;
    margin: 1rem 0 1.2rem 0;
  }
  .install-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.45rem;
    padding: 0.58rem 0.72rem;
    border-radius: 8px;
    border: 1px solid #1f6feb;
    background: #1f6feb;
    color: #ffffff !important;
    font-weight: 600;
    text-decoration: none !important;
    text-align: center;
  }
  .install-btn.secondary {
    background: #ffffff;
    color: #1f6feb !important;
  }
  .install-btn:hover {
    background: #1158c7;
    border-color: #1158c7;
    color: #ffffff !important;
  }
  .install-btn.secondary:hover {
    background: #f2f7ff;
    color: #0f4fb1 !important;
    border-color: #0f4fb1;
  }
  .install-shot {
    margin: 0.7rem 0 1.2rem 0;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .install-shot img {
    display: block;
    width: 100%;
    height: auto;
  }
  .install-shot figcaption {
    padding: 0.5rem 0.7rem;
    font-size: 0.86rem;
    color: #57606a;
    border-top: 1px solid #d0d7de;
  }
  .install-step {
    border: 1px solid #d8dee4;
    border-radius: 10px;
    padding: 0.85rem 0.9rem;
    margin: 0 0 0.75rem 0;
    background: #fcfdff;
  }
  .install-step h3 {
    margin: 0 0 0.4rem 0;
    font-size: 1.01rem;
  }
  .install-step p {
    margin: 0 0 0.45rem 0;
  }
</style>

## Quick Links

<div class="install-actions">
  <a class="install-btn" href="https://apps.apple.com/us/app/scriptable/id1405459188?uo=4" target="_blank" rel="noopener noreferrer">📱 Install Scriptable</a>
  <a class="install-btn" href="https://github.com/devindxdev/bluelocke/releases" target="_blank" rel="noopener noreferrer">🚀 Open Releases</a>
  <a class="install-btn secondary" href="https://github.com/devindxdev/bluelocke/releases/latest/download/bluelocke.js" target="_blank" rel="noopener noreferrer">⬇️ Direct Download bluelocke.js</a>
</div>

## Installation Steps

<div class="install-step">
  <h3>Step 1: Install and open Scriptable</h3>
  <p>Install <a href="https://apps.apple.com/us/app/scriptable/id1405459188?uo=4" target="_blank" rel="noopener noreferrer">Scriptable from the App Store</a>, then open it once.</p>
</div>

<div class="install-step">
  <h3>Step 2: Download <code>bluelocke.js</code> from Releases</h3>
  <p>Open the <a href="https://github.com/devindxdev/bluelocke/releases" target="_blank" rel="noopener noreferrer">Bluelocke releases page</a> and download the latest <code>bluelocke.js</code> asset.</p>
  <p>You can also use the direct asset link: <a href="https://github.com/devindxdev/bluelocke/releases/latest/download/bluelocke.js" target="_blank" rel="noopener noreferrer">latest/download/bluelocke.js</a>.</p>
</div>

<figure class="install-shot">
  <img src="./images/install-release-download.png" alt="GitHub release page highlighting the bluelocke.js asset download" />
  <figcaption>Download the <strong>bluelocke.js</strong> file from the release assets.</figcaption>
</figure>

<div class="install-step">
  <h3>Step 3: Move file to iCloud Drive → Scriptable</h3>
  <p>In the iOS <strong>Files</strong> app, move <code>bluelocke.js</code> from Downloads into <strong>iCloud Drive</strong> → <strong>Scriptable</strong>.</p>
</div>

<div class="install-step">
  <h3>Step 4: Launch Bluelocke in Scriptable</h3>
  <p>Open Scriptable and tap <code>bluelocke</code>. On first launch, enter your region, brand, login credentials, PIN, and preferences.</p>
</div>

<div class="install-step">
  <h3>Step 5: Run it again after saving settings</h3>
  <p>After tapping Save, Scriptable may close. Open <code>bluelocke</code> again to load the full app.</p>
</div>

<div class="install-step">
  <h3>Step 6: Add Widget (optional, recommended)</h3>
  <p>Add a Scriptable widget and configure:</p>
  <ul>
    <li><strong>Script:</strong> <code>bluelocke</code></li>
    <li><strong>When Interacting:</strong> Run Script</li>
  </ul>
  <p>Need help adding widgets? See Apple’s guide: <a href="https://support.apple.com/en-ca/118610" target="_blank" rel="noopener noreferrer">How to add widgets on iPhone</a>.</p>
</div>

<div class="install-step">
  <h3>Step 7: Enable Siri/Automation shortcuts (optional)</h3>
  <p>For lock/unlock/auto flows and automations, continue here:</p>
  <ul>
    <li><a href="./shortcuts">Siri / Shortcuts page</a></li>
    <li><a href="./automations">Automations page</a></li>
    <li><a href="./control-center">Control Center page</a></li>
  </ul>
</div>

## Security Note

Your Bluelink credentials are stored in iOS keychain-backed storage through Scriptable usage patterns and are used to authenticate against Bluelink APIs.


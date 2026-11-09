---
title: Automations
nav_order: 6
---

# Automations

Set up your iPhone to lock your car when it disconnects from CarPlay or your car’s Wi-Fi. First, choose whether you want to be asked before the car locks.

<style>
  .automation-card {
    border: 1px solid #d0d7de;
    border-radius: 10px;
    padding: 0.95rem;
    margin: 0.8rem 0 1rem 0;
    background: #f8fafc;
  }
  .automation-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: 0.8rem;
    margin: 1rem 0;
  }
  .automation-options .automation-card {
    display: flex;
    flex-direction: column;
    margin: 0;
  }
  .automation-options h3 { margin-top: 0; }
  .automation-warning { font-size: 0.9rem; color: #704f13; }
  .automation-options .automation-actions { margin-top: auto; padding-top: 0.6rem; }
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

## 1. Choose How Your Car Locks

<div class="automation-options">
  <div class="automation-card">
    <h3 id="ask-before-locking">Ask before locking</h3>
    <p><strong>Auto-Lock (Safe)</strong> checks whether your car is unlocked, then asks you before locking it.</p>
    <p>Choose this if you want to confirm each time. It is a good place to start if you are unsure.</p>
    <div class="automation-actions">
      <a class="automation-btn" href="https://www.icloud.com/shortcuts/dc6e0f8d1b5f4fff920f9de90d31bf45" target="_blank" rel="noopener noreferrer">Use Auto-Lock (Safe)</a>
    </div>
  </div>
  <div class="automation-card">
    <h3 id="lock-without-asking">Lock without asking</h3>
    <p><strong>Auto-lock</strong> locks your car without asking you first.</p>
    <p class="automation-warning"><strong>Warning:</strong> Take your phone and key with you to avoid locking yourself out.</p>
    <div class="automation-actions">
      <a class="automation-btn" href="https://www.icloud.com/shortcuts/11e31f0ae30d4edcb001db6ae2ab082b" target="_blank" rel="noopener noreferrer">Use Auto-lock</a>
    </div>
  </div>
</div>

Tap the button for the option you want, then tap **Add Shortcut** on your iPhone. Follow the steps below for either option.

{% include coffee_hint.html %}

## Before You Continue

- [Install Bluelocke](./installation) if you have not already.
- Open **bluelocke** in Scriptable, sign in, and check that your car appears.
- In Scriptable, the script should be called **bluelocke**.
- Your iPhone needs an internet connection for Bluelocke and its shortcuts to work.

## 2. Set It to Run When You Leave

In the **Shortcuts** app, open **Automation** and tap **+** or **New Automation**. An automation tells your iPhone when to run your shortcut.

Choose one of these options. You only need one.

### Recommended: When Your Phone Leaves the Car’s Wi-Fi

This is the recommended option for walk-away auto-lock. Your phone starts the shortcut when it disconnects from your car’s Wi-Fi. You need wireless CarPlay and your car’s Wi-Fi must appear in Shortcuts.

1. While connected to your car’s wireless CarPlay, choose **Wi-Fi** in the new automation.
2. Tap **Choose** and select your car’s Wi-Fi name. Do not choose **Any Network**, or it may run when you leave other Wi-Fi networks too.
3. Choose **When I Disconnect**. If this option or your car’s Wi-Fi is missing, use the **CarPlay** option below instead.
4. Choose **Run Immediately** if shown. If you see **Ask Before Running** instead, turn it off.
5. Tap **Next** if shown, then choose **Auto-Lock (Safe)** or **Auto-lock**. If you see a screen for adding actions, add **Run Shortcut** and choose it there.
6. Tap **Done** to save.

### When CarPlay Disconnects

This also works with wired or wireless CarPlay. CarPlay can disconnect as soon as you turn the car off or unplug your phone, so add a **Wait** step to give yourself time to get out.

1. Choose **CarPlay**, then **Disconnects**.
2. Choose **Run Immediately** if shown. If you see **Ask Before Running** instead, turn it off.
3. Tap **Next** if shown, then choose **New Blank Automation** or the option to add your own actions.
4. Search for **Wait** and add it. Set the number of seconds you want to wait before locking.
5. Add **Run Shortcut** below **Wait**, then choose **Auto-Lock (Safe)** or **Auto-lock**.
6. Tap **Done** to save.

The steps must be in this order: **Wait → Run Shortcut**. If it still locks too quickly, increase the number of seconds in **Wait**.

The screens may look a little different depending on your iPhone’s software version. For Apple’s instructions, see [adding an automation](https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios).

**If you chose Auto-Lock (Safe):** Your phone will still ask before locking the car. **Run Immediately** starts the shortcut; it does not skip that question.

## 3. Check That It Works

1. Park, leave the car unlocked, and take your phone and key with you.
2. End CarPlay or leave the car’s Wi-Fi, depending on the option you chose.
3. If you chose **Auto-Lock (Safe)**, answer the question on your phone. Unlock your phone if asked.
4. Wait, then check the car door to make sure it locked.

Try this a few times before relying on it. Your phone starts the shortcut when it disconnects; it does not measure how far you have walked from the car.

## If Something Goes Wrong

- **It cannot find Bluelocke:** In Scriptable, check that the script is called **bluelocke**. In the shortcut’s **Run Script** steps, select **bluelocke**.
- **It does not work when you tap it:** Open Bluelocke, sign in if asked, and check your internet connection. Get this working before trying the automatic setup.
- **It works when tapped, but not when leaving:** Check that your automation is turned on and uses the right shortcut. If you chose Wi-Fi, check the network name or try CarPlay instead.
- **It is waiting for an answer:** **Auto-Lock (Safe)** needs you to confirm before it locks. Check your phone.
- **It runs too early with CarPlay:** Increase the **Wait** time before **Run Shortcut**, or use the recommended Wi-Fi option.
- **It runs more than once:** Check the Automation list for extra copies. Keep only one enabled while testing.

You can change your mind later: edit the automation and choose the other shortcut. You do not need to set up a second automation.

## More Shortcuts

You can also use shortcuts to lock, unlock, warm, or cool your car. See [Siri & Shortcuts](./shortcuts).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uiHarness } from './ui-harness.mjs'

const plain = (value) => JSON.parse(JSON.stringify(value))

test('fresh setup saves every account field without requiring a vehicle cache', async () => {
  const h = uiHarness({ account: false })
  const opening = h.screens.loadConfigScreen()
  h.choices.push('kia')
  await h.tap('Manufacturer')
  assert.equal(h.config.getConfig().manufacturer, 'kia')
  h.choices.push('usa')
  await h.tap('Region')
  h.choices.push('email')
  await h.tap('Verification code')
  h.alerts.push({ text: 'new-driver@example.test' }, { text: 'new-password' }, { text: '4321' })
  await h.tap('Email or username')
  await h.tap('Password')
  await h.tap('Vehicle PIN')
  assert.deepEqual(plain(h.config.getConfig().auth), {
    username: 'new-driver@example.test',
    password: 'new-password',
    pin: '4321',
    region: 'usa',
  })
  assert.equal(h.config.getConfig().mfaPreference, 'email')
  assert.equal(h.config.configExists(), true)
  assert.ok(!h.messages.some((message) => message.title === 'Could not save this change'))
  await h.tap('Continue')
  await opening
})

test('first-run account details save progressively and Continue waits for a complete account', async () => {
  const h = uiHarness({ account: false })
  const opening = h.screens.loadConfigScreen()
  assert.ok(h.texts().includes('Welcome to Bluelocke'))
  await assert.rejects(h.tap('Continue'), /No enabled action/)
  h.choices.push('canada')
  await h.tap('Region')
  h.alerts.push({ text: 'driver@example.test' })
  await h.tap('Email or username')
  assert.equal(h.config.getConfig().auth.username, 'driver@example.test')
  assert.equal(h.screens.hasCompleteAccountSettings(), false)
  h.top().close()
  await opening
  const reopening = h.screens.loadConfigScreen()
  assert.ok(h.texts().includes('driver@example.test'))
  h.alerts.push({ text: 'password' }, { text: '1234' })
  await h.tap('Password')
  await assert.rejects(h.tap('Continue'), /No enabled action/)
  await h.tap('Vehicle PIN')
  assert.equal(h.screens.hasCompleteAccountSettings(), true)
  await h.tap('Continue')
  await reopening
})

test('Settings has five destinations, explains autosave, and has no Save button', async () => {
  const h = uiHarness()
  const opening = h.screens.loadConfigScreen(h.bl)
  await h.flush()
  assert.deepEqual(
    plain(
      h
        .texts()
        .filter((text) => ['Vehicle', 'Climate', 'Appearance & Units', 'Account', 'Help & Support'].includes(text)),
    ),
    ['Account', 'Vehicle', 'Climate', 'Appearance & Units', 'Help & Support'],
  )
  assert.ok(h.texts().includes('Changes save automatically.'))
  for (const removed of [
    'Save',
    'Charge Limit Profiles',
    'Advanced Widget Settings',
    'Optional Custom Climates',
    'Hide default climate options',
    'Enable prompting for app updates',
  ]) {
    assert.ok(!h.texts().includes(removed))
  }
  h.top().close()
  await opening
  assert.equal(h.writes, 0)
})

test('display name edits directly from Vehicle and saves on Done without another page', async () => {
  const h = uiHarness()
  const opening = h.screens.loadCarSettingsScreen(h.bl)
  h.alerts.push({ text: ' My Tucson ' })
  await h.tap('Display name')
  assert.equal(h.config.getConfig().displayNameOverride, 'My Tucson')
  assert.ok(h.texts().includes('My Tucson'))
  assert.equal(h.tables.length, 1)
  h.alerts.push({ text: 'Discard this', button: -1 })
  await h.tap('Display name')
  assert.equal(h.config.getConfig().displayNameOverride, 'My Tucson')
  h.alerts.push({ text: '' })
  await h.tap('Display name')
  assert.equal(h.config.getConfig().displayNameOverride, '')
  assert.ok(h.texts().includes('Use vehicle name'))
  h.top().close()
  await opening
})

test('nested pages use one native table and Back returns one level while Close exits the whole Settings view', async () => {
  const h = uiHarness()
  const opening = h.screens.loadConfigScreen(h.bl)
  const climate = h.tap('Climate')
  await h.flush()
  assert.ok(h.texts().includes('‹ Back'))
  const warm = h.tap('Warm')
  await h.flush()
  h.alerts.push({ text: '23' })
  await h.tap('Temperature (°C)')
  assert.equal(h.config.getConfig().standardClimateConfig.warm.temp, 23)
  await h.tap('‹ Back')
  await warm
  assert.ok(h.texts().includes('23°C · 15 minutes'))
  await h.tap('‹ Back')
  await climate
  assert.ok(h.texts().includes('Appearance & Units'))
  assert.ok(!h.texts().includes('‹ Back'))
  assert.equal(h.tables.length, 1)
  const appearance = h.tap('Appearance & Units')
  await h.flush()
  h.top().close()
  await Promise.all([appearance, opening])
  assert.equal(h.top(), undefined)
})

test('autosave updates only the changed field and preserves newer values saved elsewhere', async () => {
  const h = uiHarness()
  const opening = h.screens.loadAppearanceSettingsScreen()
  h.config.setConfig({ ...h.config.getConfig(), widgetAppearance: 'dark', debugLogging: true })
  h.choices.push('mi')
  await h.tap('Distance')
  const next = h.config.getConfig()
  assert.equal(next.distanceUnit, 'mi')
  assert.equal(next.widgetAppearance, 'dark')
  assert.equal(next.debugLogging, true)
  h.top().close()
  await opening
})

test('changing temperature units immediately converts Warm and Cool while preserving other settings', async () => {
  const h = uiHarness()
  const current = h.config.getConfig()
  current.standardClimateConfig.warm.temp = 22
  current.standardClimateConfig.warm.durationMinutes = 23
  current.standardClimateConfig.cool.temp = 19
  h.config.setConfig(current)
  const opening = h.screens.loadAppearanceSettingsScreen()
  h.choices.push('F')
  await h.tap('Temperature')
  const next = h.config.getConfig()
  assert.equal(next.tempType, 'F')
  assert.equal(next.standardClimateConfig.warm.temp, 72)
  assert.equal(next.standardClimateConfig.cool.temp, 66)
  assert.equal(next.standardClimateConfig.warm.durationMinutes, 23)
  assert.equal(next.climateTempWarm, 72)
  h.top().close()
  await opening
})

test('pickers mark the current option and cancellation or choosing it again does not write settings', async () => {
  const h = uiHarness()
  const opening = h.screens.loadAppearanceSettingsScreen()
  await h.tap('Distance')
  assert.deepEqual(plain(h.pickers[0].options), [
    { label: '✓ Kilometres', value: 'km' },
    { label: 'Miles', value: 'mi' },
  ])
  assert.equal(h.writes, 0)
  h.choices.push('km')
  await h.tap('Distance')
  assert.equal(h.writes, 0)
  h.top().close()
  await opening
})

test('account edits clear the original vehicle cache while verification preference changes preserve it', async () => {
  const h = uiHarness()
  const cacheKey = 'egmp-scriptable-bl-cache-Bluelocke'
  h.keys.set(cacheKey, 'original cached vehicle data')
  h.bl.deleteCache = () => {
    h.invalidations++
    h.keys.delete(cacheKey)
  }
  const opening = h.screens.loadAccountSettingsScreen(h.bl)
  h.choices.push('email')
  await h.tap('Verification code')
  assert.equal(h.keys.has(cacheKey), true)
  assert.equal(h.invalidations, 0)
  h.alerts.push({ text: 'other@example.test' })
  await h.tap('Email or username')
  assert.equal(h.keys.has(cacheKey), false)
  assert.equal(h.invalidations, 1)
  assert.ok(![...h.keys.keys()].some((key) => key.startsWith('bluelocke:auth-session:')))
  assert.ok(!h.messages.some((message) => message.title === 'Could not save this change'))
  assert.equal(h.config.getConfig().auth.username, 'other@example.test')
  assert.equal(h.config.getConfig().auth.password, 'password')
  assert.equal(h.config.getConfig().mfaPreference, 'email')
  h.top().close()
  await opening
})

test('an existing account can change manufacturer without an active client or status cache', async () => {
  const h = uiHarness()
  const opening = h.screens.loadAccountSettingsScreen()
  h.choices.push('kia')
  await h.tap('Manufacturer')
  assert.equal(h.config.getConfig().manufacturer, 'kia')
  assert.ok(!h.messages.some((message) => message.title === 'Could not save this change'))
  h.top().close()
  await opening
})

test('modern preferences keep the v1.24.4 configuration key and do not replace credentials or tokens', async () => {
  const h = uiHarness()
  const before = plain(h.config.getConfig().auth)
  const cacheKey = 'egmp-scriptable-bl-cache-Bluelocke'
  h.keys.set(cacheKey, 'original token and status')
  const opening = h.screens.loadAppearanceSettingsScreen()
  h.choices.push('dark')
  await h.tap('Widget appearance')
  assert.equal(h.config.getConfig().widgetAppearance, 'dark')
  assert.deepEqual(plain(h.config.getConfig().auth), before)
  assert.equal(h.keys.get(cacheKey), 'original token and status')
  assert.ok(h.keys.has('egmp-scriptable-config-Bluelocke'))
  assert.ok(!h.keys.has('bluelocke:config:["Bluelocke"]'))
  h.top().close()
  await opening
})

test('invalid numbers stay in the editor and never replace the last saved climate value', async () => {
  const h = uiHarness()
  const opening = h.screens.loadStandardClimatePresetScreen('warm')
  h.alerts.push({ text: '1.5' }, { button: -1 })
  await h.tap('Duration (minutes)')
  assert.ok(h.alertHistory.some((alert) => alert.message === 'Choose 1–30 whole minutes.'))
  assert.equal(h.config.getConfig().standardClimateConfig.warm.durationMinutes, 15)
  assert.equal(h.writes, 0)
  h.alerts.push({ text: '99' }, { text: '21' })
  await h.tap('Duration (minutes)')
  assert.equal(h.config.getConfig().standardClimateConfig.warm.durationMinutes, 21)
  assert.ok(h.texts().includes('21'))
  h.top().close()
  await opening
})

test('a failed autosave keeps the previous value visible and explains that the change was not saved', async () => {
  const h = uiHarness()
  const opening = h.screens.loadAppearanceSettingsScreen()
  h.failWrites = true
  h.choices.push('mi')
  await h.tap('Distance')
  assert.equal(h.config.getConfig().distanceUnit, 'km')
  assert.ok(h.texts().includes('Kilometres'))
  assert.equal(h.messages.at(-1).title, 'Could not save this change')
  h.failWrites = false
  h.choices.push('mi')
  await h.tap('Distance')
  assert.equal(h.config.getConfig().distanceUnit, 'mi')
  h.top().close()
  await opening
})

test('autosave retains Shortcut profiles and configured refresh defaults', async () => {
  const h = uiHarness()
  const config = h.config.getConfig()
  config.customClimates = [{ name: 'Commute', temp: 22 }]
  config.chargeLimits = [{ name: 'Existing trip', acPercent: 90, dcPercent: 80 }]
  config.widgetConfig.remotePollPeriod = 6
  h.config.setConfig(config)
  const opening = h.screens.loadAppearanceSettingsScreen()
  h.choices.push('mi')
  await h.tap('Distance')
  const next = h.config.getConfig()
  assert.deepEqual(plain(next.customClimates), plain(config.customClimates))
  assert.deepEqual(plain(next.chargeLimits), plain(config.chargeLimits))
  assert.equal(next.widgetConfig.remotePollPeriod, 6)
  h.top().close()
  await opening
})

test('Vehicle settings keeps name and photo without a vehicle picker', async () => {
  const h = uiHarness()
  const opening = h.screens.loadCarSettingsScreen(h.bl)
  assert.ok(h.texts().includes('Display name'))
  assert.ok(h.texts().includes('Vehicle photo'))
  assert.ok(!h.texts().includes('Selected vehicle'))
  h.top().close()
  await opening
})

test('Troubleshooting switches save immediately without exposing the multi-car switch', async () => {
  const h = uiHarness()
  const opening = h.screens.loadTroubleshootingScreen()
  assert.ok(!h.texts().includes('Separate vehicle profiles'))
  await h.tap('Diagnostic logging')
  assert.equal(h.config.getConfig().debugLogging, true)
  h.top().close()
  await opening
})

test('Vehicle photo opens the existing live photo editor without changing account settings', async () => {
  const h = uiHarness()
  const before = JSON.stringify(h.config.getConfig())
  const opening = h.screens.loadCarSettingsScreen(h.bl)
  await h.tap('Vehicle photo')
  assert.equal(h.photoEdits, 1)
  assert.equal(JSON.stringify(h.config.getConfig()), before)
  assert.equal(h.invalidations, 0)
  h.top().close()
  await opening
})

test('incomplete v1.24.4 settings reopen modern setup, including a previously missing PIN', async () => {
  const h = uiHarness({ account: false })
  h.keys.set(
    'egmp-scriptable-config-Bluelocke',
    JSON.stringify({
      manufacturer: 'hyundai',
      auth: { username: 'driver@example.test', password: 'password', region: 'canada' },
    }),
  )
  const opening = h.screens.loadConfigScreen()
  assert.ok(h.texts().includes('Welcome to Bluelocke'))
  assert.equal(h.legacyForms.length, 0)
  assert.equal(h.screens.hasCompleteAccountSettings(), false)
  h.alerts.push({ text: '1234' })
  await h.tap('Vehicle PIN')
  assert.equal(h.screens.hasCompleteAccountSettings(), true)
  await h.tap('Continue')
  await opening
})

test('a saved numeric v1.24.4 PIN opens modern Account without changing stored values', async () => {
  const h = uiHarness()
  h.config.setConfig({ ...h.config.getConfig(), auth: { ...h.config.getConfig().auth, pin: 1234 } })
  const before = h.keys.get('egmp-scriptable-config-Bluelocke')
  const opening = h.screens.loadAccountSettingsScreen()
  assert.ok(h.texts().includes('Account'))
  assert.ok(h.texts().includes('••••••••'))
  assert.equal(h.screens.hasCompleteAccountSettings(), true)
  h.top().close()
  await opening
  assert.equal(h.keys.get('egmp-scriptable-config-Bluelocke'), before)
})

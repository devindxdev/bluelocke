import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { builtAppHarness } from './built-app-harness.mjs'

const destinations = ['Account', 'Vehicle', 'Climate', 'Appearance & Units', 'Help & Support']

test('release script boots the v1.26.0 Welcome UI on a new installation', async () => {
  const h = builtAppHarness()
  await h.flush()
  assert.deepEqual(h.errors, [])
  assert.ok(h.texts().includes('Welcome to Bluelocke'), h.texts().join(', '))
  assert.equal(h.requests.length, 0)
  await assert.rejects(h.tap('Continue'), /No enabled action/)
  h.top().close()
  await h.execution
})

test('release script opens modern Settings through the sign-in failure recovery action', async () => {
  const h = builtAppHarness({ account: true })
  await h.flush()
  assert.deepEqual(h.errors, [])
  for (const label of destinations) assert.ok(h.texts().includes(label), label)
  assert.ok(h.texts().includes('Changes save automatically.'))
  h.top().close()
  await h.execution
})

test('release script autosaves setup to the original key and continues through the original login route', async () => {
  const h = builtAppHarness()
  await h.flush()
  h.choices.push('Canada')
  await h.tap('Region')
  for (const [label, text] of [
    ['Email or username', 'driver@example.test'],
    ['Password', 'password'],
    ['Vehicle PIN', '1234'],
  ]) {
    h.answers.push({ text })
    await h.tap(label)
  }
  const stored = JSON.parse(h.keys.get('egmp-scriptable-config-BuiltTest'))
  assert.equal(stored.auth.username, 'driver@example.test')
  assert.equal(stored.auth.pin, '1234')
  assert.equal(h.requests.length, 0)
  await h.tap('Continue')
  assert.deepEqual(h.errors, [])
  const login = h.requests.find((request) => request.url === 'https://mybluelink.ca/tods/api/v2/login')
  assert.ok(login)
  assert.deepEqual(JSON.parse(login.body), { loginId: 'driver@example.test', password: 'password' })
  for (const label of destinations) assert.ok(h.texts().includes(label), label)
  h.top().close()
  await h.execution
})

test('release script has no old configuration page or replacement auth-session store', () => {
  const source = fs.readFileSync(new URL('../build/bluelocke.js', import.meta.url), 'utf8')
  for (const old of [
    'Bluelink Configuration settings',
    'Optional Advanced Widget Settings',
    'Optional Custom Climates',
    'auth-session',
  ])
    assert.ok(!source.includes(old), old)
})

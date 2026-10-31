import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { authFingerprints } from './auth-baseline.mjs'
import { runtime } from './auth-harness.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/v1.24.4-auth.json')))
const euPr = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/europe-pr-3.json')))
const plain = (value) => JSON.parse(JSON.stringify(value))
for (const [file, expected] of Object.entries(baseline.fingerprints)) {
  test(`${file}: sign-in and cache methods match v1.24.4 except the reviewed EU PR methods`, () => {
    const actual = authFingerprints(fs.readFileSync(path.join(ROOT, file), 'utf8'))
    const reviewed = file.endsWith('/europe.ts') ? { ...expected, ...euPr.authMethods } : expected
    assert.deepEqual(actual, reviewed)
  })
}

test('the replacement session store is absent from the release source', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'src/lib/auth-session.ts')), false)
})

for (const mode of ['app', 'widget', 'shortcut']) {
  for (const multiCar of [false, true]) {
    test(`${mode}, multiCar=${multiCar}: the original v1.24.4 cache is reused without another login`, async () => {
      const h = runtime({ background: mode === 'widget', siri: mode === 'shortcut' })
      const cache = {
        token: { accessToken: 'trusted-token', expiry: Date.now() / 1000 + 3600 },
        car: { id: 'original-car', vin: 'original-vin', modelName: 'Tucson', nickName: 'Tucson' },
        status: { range: 415, twelveSoc: 84 },
      }
      h.keys.set('egmp-scriptable-bl-cache-Bluelocke', JSON.stringify(cache))
      const bl = new h.Base({ ...h.account, multiCar })
      bl.login = async () => {
        throw Error('Unexpected login')
      }
      await bl.superInit(bl.getConfig(), true)
      assert.deepEqual(plain(bl.getCachedStatus()), { car: cache.car, status: cache.status })
      assert.ok([...h.keys.keys()].every((key) => !key.startsWith('bluelocke:auth')))
    })
  }
}

test('transport keeps the v1.24.4 authentication headers, retry count and redirect handling', async () => {
  const h = runtime(),
    bl = new h.Base(h.account)
  bl.cache = {
    token: { accessToken: 'old-token', expiry: 0, authId: 'trusted-auth-id', authCookie: 'sid=trusted-cookie' },
    car: {},
    status: {},
  }
  bl.tokens = undefined
  bl.authIdHeader = 'vinkey'
  bl.additionalHeaders = { deviceid: 'trusted-device' }
  let renewals = 0
  bl.refreshLogin = async () => {
    renewals++
    bl.tokens = { ...bl.cache.token, accessToken: 'renewed-token' }
  }
  h.transport = async () => ({ valid: h.requests.length > 1 })
  await bl.request({
    url: 'https://service.example.test/status',
    data: '{"test":true}',
    validResponseFunction: (_resp, data) => ({ valid: data.valid, retry: !data.valid }),
  })
  assert.equal(renewals, 1)
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[0].headers.Authentication, 'old-token')
  assert.equal(h.requests[1].headers.Authentication, 'renewed-token')
  assert.equal(h.requests[0].headers.vinkey, 'trusted-auth-id')
  assert.equal(h.requests[0].headers.deviceid, 'trusted-device')
  assert.equal(h.requests[0].body, '{"test":true}')
  assert.equal(h.requests[0].onRedirect, undefined)
  const response = await bl.request({
    url: 'https://service.example.test/login',
    noAuth: true,
    noRedirect: true,
    validResponseFunction: () => ({ valid: true, retry: false }),
  })
  const login = h.requests.at(-1)
  assert.equal(login.headers.Authentication, undefined)
  assert.equal(login.onRedirect({}), null)
  assert.ok(response)
})

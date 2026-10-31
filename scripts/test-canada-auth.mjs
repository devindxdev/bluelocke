import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const plain = (value) => JSON.parse(JSON.stringify(value))
const car = { id: 'first-car', vin: '5NMS3CADXLH123456', nickName: 'Daily', modelName: 'Tucson', modelYear: '2022' }
function runtime({ keys = new Map(), background = false, siri = false } = {}) {
  const h = { keys, requests: [], prompts: 0, now: Date.now(), code: '123456', devices: [] }
  const RealDate = Date
  class Clock extends RealDate {
    static now() {
      return h.now
    }
  }
  const context = vm.createContext({
    Error,
    Date: Clock,
    Script: { name: () => 'Bluelocke' },
    config: { runsInWidget: background, runsWithSiri: siri },
    UUID: { string: () => `device-${Math.random()}` },
    Keychain: {
      contains: (key) => keys.has(key),
      get: (key) => keys.get(key),
      set: (key, value) => keys.set(key, value),
      remove: (key) => keys.delete(key),
    },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 200, headers: {}, cookies: [] }
      }
      async loadJSON() {
        h.requests.push(this)
        h.devices.push(this.headers.deviceid)
        return h.backend(this)
      }
    },
    console,
  })
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
    const require = (name) => {
      if (name === 'url') return { default: Url }
      if (name.endsWith('/secure-url')) return load('src/lib/secure-url.ts')
      if (name.endsWith('/logger'))
        return {
          Logger: class {
            log() {}
          },
        }
      if (name.replace(/\/$/, '').endsWith('/scriptable-utils'))
        return {
          textInput: async () => {
            h.prompts++
            return h.code
          },
        }
      if (name.endsWith('/vehicle-photo')) return { getVehiclePhotoUrl: () => undefined }
      if (name.endsWith('/util')) return {}
      const resolved = name.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), name + '.ts'))
        : `src/${name}.ts`
      if (
        [
          'src/config.ts',
          'src/lib/auth-session.ts',
          'src/lib/storage.ts',
          'src/lib/log-sanitizer.ts',
          'src/lib/user-error.ts',
          'src/lib/bluelink-regions/base.ts',
          'src/lib/bluelink-regions/canada.ts',
        ].includes(resolved)
      )
        return load(resolved)
      return {}
    }
    vm.runInContext(`(function(require,module,exports){\n${source}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.settings = load('src/config.ts')
  h.saveAccount = () =>
    h.settings.setConfig({
      ...h.settings.getConfig(),
      manufacturer: 'hyundai',
      auth: { username: 'driver@example.test', password: 'private', pin: '9876', region: 'canada' },
    })
  h.client = () => {
    const { BluelinkCanada } = load('src/lib/bluelink-regions/canada.ts')
    const bl = new BluelinkCanada(h.settings.getConfig())
    bl.getSessionCookie = async () => 'cookie=private'
    bl.getCarStatus = async () => {
      if (h.failStatus) throw Error('Server unavailable')
      return { lastStatusCheck: h.now, twelveSoc: 84, range: 415 }
    }
    bl.initialize = () => bl.superInit(bl.config, background || siri)
    return bl
  }
  const success = (result) => ({ responseHeader: { responseCode: 0 }, result })
  h.backend = (req) => {
    const endpoint = req.url.split('/').pop()
    if (endpoint === 'login') return { responseHeader: { responseCode: 1 }, error: { errorCode: '7110' } }
    if (endpoint === 'selverifmeth') return success({ userInfoUuid: 'user', emailList: ['driver@example.test'] })
    if (endpoint === 'sendotp') {
      if (h.failSend) throw Error('Timeout')
      return success({ otpKey: 'challenge' })
    }
    if (endpoint === 'validateotp') {
      if (h.badCode) return { responseHeader: { responseCode: 1 }, error: { errorCode: '7549' } }
      return success({ verifiedOtp: true, otpValidationKey: 'verified' })
    }
    if (endpoint === 'genmfatkn')
      return success({ token: { accessToken: 'trusted-session', refreshToken: 'refresh', expireIn: 3600 } })
    if (endpoint === 'vhcllst') {
      assert.equal(req.body, undefined, 'Must not send a set-car request')
      return success({ vehicles: [car] })
    }
    throw Error(`Unexpected endpoint ${endpoint}`)
  }
  h.count = (endpoint) => h.requests.filter((req) => req.url.endsWith('/' + endpoint)).length
  return h
}

test('successful Canada MFA survives a status outage and reuses the same device/session next launch', async () => {
  const h = runtime()
  h.saveAccount()
  h.failStatus = true
  await assert.rejects(h.client().initialize(), /Server unavailable/)
  assert.equal(h.count('sendotp'), 1)
  const device = h.devices[0]
  const next = runtime({ keys: h.keys })
  const bl = next.client()
  await bl.initialize()
  assert.equal(next.count('login'), 0)
  assert.equal(next.count('sendotp'), 0)
  assert.equal(next.prompts, 0)
  assert.equal(next.devices[0], device)
  assert.equal(bl.getCachedStatus().status.range, 415)
})

for (const mode of ['widget', 'shortcut'])
  test(`${mode}: restored Canada login never sends codes or prompts in the background`, async () => {
    const h = runtime({ background: mode === 'widget', siri: mode === 'shortcut' })
    h.saveAccount()
    const bl = h.client()
    await bl.initialize()
    assert.equal(bl.loginFailed(), true)
    assert.equal(h.count('sendotp'), 0)
    assert.equal(h.prompts, 0)
    const next = runtime({ keys: h.keys, background: mode === 'widget', siri: mode === 'shortcut' })
    const retry = next.client()
    await retry.initialize()
    assert.equal(next.count('login'), 1, 'A previous failure must not persistently block retrying')
    assert.equal(next.count('sendotp'), 0)
    assert.equal(next.prompts, 0)
  })

test('cancelling code entry returns to the original sign-in flow on the next launch', async () => {
  const h = runtime()
  h.saveAccount()
  h.code = null
  const first = h.client()
  await first.initialize()
  assert.equal(first.loginFailed(), true)
  const next = runtime({ keys: h.keys })
  await next.client().initialize()
  assert.equal(next.count('login'), 1)
  assert.equal(next.count('sendotp'), 1)
  assert.equal(next.prompts, 1)
})

test('an incorrect code restarts Canada verification with a fresh challenge and device', async () => {
  const h = runtime()
  h.saveAccount()
  h.badCode = true
  const first = h.client()
  await first.initialize()
  assert.equal(first.loginFailed(), true)
  const next = runtime({ keys: h.keys })
  await next.client().initialize()
  assert.equal(next.count('sendotp'), 1)
  assert.equal(next.count('login'), 1)
  assert.notEqual(next.devices[0], h.devices[0])
})

test('a send timeout uses the original two-minute cooldown, then permits a new login', async () => {
  const h = runtime()
  h.saveAccount()
  h.failSend = true
  await assert.rejects(h.client().initialize(), /Sign-in timed out/)
  const next = runtime({ keys: h.keys })
  const blocked = next.client()
  await blocked.initialize()
  assert.equal(blocked.loginFailed(), true)
  assert.equal(next.count('sendotp'), 0)
  next.now += 121000
  const retried = next.client()
  await retried.initialize()
  assert.equal(next.count('sendotp'), 1)
  assert.equal(retried.loginFailed(), false)
})

test('the original Canada cooldown suppresses duplicate verification sends across runs', async () => {
  const h = runtime()
  h.saveAccount()
  let finish
  const original = h.backend
  h.backend = (req) =>
    req.url.endsWith('/sendotp')
      ? new Promise((resolve) => {
          finish = () => resolve({ responseHeader: { responseCode: 0 }, result: { otpKey: 'challenge' } })
        })
      : original(req)
  const first = h.client().initialize()
  for (let i = 0; i < 20 && !finish; i++) await Promise.resolve()
  assert.ok(finish)
  const next = runtime({ keys: h.keys })
  const second = next.client()
  await second.initialize()
  assert.equal(second.loginFailed(), true)
  assert.equal(next.count('sendotp'), 0)
  finish()
  await first
})

test('Canada recognizes the v1.24.4 expired, deleted and IP-validation responses', () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  for (const errorDesc of ['Token expired', 'Session deleted', 'ip validation failed'])
    assert.equal(bl.requestResponseValid({}, { responseHeader: { responseCode: 1 }, error: { errorDesc } }).retry, true)
  assert.deepEqual(
    plain(
      bl.requestResponseValid(
        {},
        {
          responseHeader: { responseCode: 1 },
          error: { errorCode: '7406', errorDesc: 'Try again' },
        },
      ),
    ),
    { valid: false, retry: false },
  )
})

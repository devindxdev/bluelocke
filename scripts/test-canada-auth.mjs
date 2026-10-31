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
  test(`${mode}: MFA never sends codes and later background runs do not keep logging in`, async () => {
    const h = runtime({ background: mode === 'widget', siri: mode === 'shortcut' })
    h.saveAccount()
    await h.client().initialize()
    assert.equal(h.count('login'), 1)
    assert.equal(h.count('sendotp'), 0)
    assert.equal(h.prompts, 0)
    const next = runtime({ keys: h.keys, background: mode === 'widget', siri: mode === 'shortcut' })
    await assert.rejects(next.client().initialize(), /Scriptable/)
    assert.equal(next.count('login'), 0)
    assert.equal(next.count('sendotp'), 0)
  })

test('cancelling and reopening resumes the existing code instead of sending another', async () => {
  const h = runtime()
  h.saveAccount()
  h.code = null
  await assert.rejects(h.client().initialize(), /cancelled/)
  const device = h.devices[0]
  const next = runtime({ keys: h.keys })
  await next.client().initialize()
  assert.equal(next.count('login'), 0)
  assert.equal(next.count('sendotp'), 0)
  assert.equal(next.prompts, 1)
  assert.ok(next.devices.every((id) => id === device))
})

test('an incorrect code keeps the challenge and trusted device for a retry', async () => {
  const h = runtime()
  h.saveAccount()
  h.badCode = true
  await assert.rejects(h.client().initialize(), /could not be confirmed/)
  const next = runtime({ keys: h.keys })
  await next.client().initialize()
  assert.equal(next.count('sendotp'), 0)
  assert.equal(next.count('login'), 0)
  assert.equal(next.devices[0], h.devices[0])
})

test('a send timeout retains the resend cooldown and the device identity', async () => {
  const h = runtime()
  h.saveAccount()
  h.failSend = true
  await assert.rejects(h.client().initialize(), /Sign-in timed out/)
  const next = runtime({ keys: h.keys })
  await assert.rejects(next.client().initialize(), /Wait two minutes/)
  assert.equal(next.count('sendotp'), 0)
  assert.equal(next.devices[0], h.devices[0])
})

test('a concurrent foreground run cannot send a second verification code', async () => {
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
  await assert.rejects(next.client().initialize(), /Sign-in is already in progress/)
  assert.equal(next.count('sendotp'), 0)
  finish()
  await first
})

test('7406/service outages are not treated as expired sessions', () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  const bad = bl.requestResponseValid(
    { statusCode: 200 },
    { responseHeader: { responseCode: 1 }, error: { errorCode: '7406', errorDesc: 'Try again' } },
  )
  assert.deepEqual(plain(bad), { valid: false, retry: false })
  for (const errorCode of ['7403', '7602', '7606'])
    assert.equal(bl.requestResponseValid({}, { responseHeader: { responseCode: 1 }, error: { errorCode } }).retry, true)
})

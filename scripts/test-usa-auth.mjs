import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const success = (payload = {}) => ({ status: { statusCode: 0 }, payload })
const failure = (code = 2000) => ({ status: { statusCode: 1, errorType: 1, errorCode: code } })
const vehicle = { vehicleKey: 'vehicle-key', vin: '5NMS3CADXLH123456', modelName: 'Tucson', modelYear: '2022' }

function runtime({ widget = false, siri = false, keys = new Map() } = {}) {
  const h = { keys, inputs: [], prompts: [], calls: [], routes: new Map(), logs: [], nextUuid: 0, now: 1793300000000 }
  const account = {
    manufacturer: 'kia',
    auth: { region: 'usa', username: 'driver@example.test', password: 'private-password', pin: '1234' },
    mfaPreference: 'sms',
    debugLogging: true,
    distanceUnit: 'mi',
    displayNameOverride: '',
  }
  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [h.now]))
    }
    static now() {
      return h.now
    }
  }
  const context = vm.createContext({
    Error,
    Date: FakeDate,
    Script: { name: () => 'Bluelocke' },
    config: { runsInWidget: widget, runsWithSiri: siri },
    Keychain: {
      contains: (key) => keys.has(key),
      get: (key) => keys.get(key),
      set: (key, value) => keys.set(key, value),
      remove: (key) => keys.delete(key),
    },
    UUID: { string: () => `00000000-0000-4000-8000-${String(++h.nextUuid).padStart(12, '0')}` },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 200, headers: {}, cookies: [] }
      }
      async loadJSON() {
        const endpoint = this.url.split('/apigw/v1/')[1]
        h.calls.push({ endpoint, headers: { ...this.headers }, data: this.body })
        const queued = h.routes.get(endpoint) || []
        const next = queued.shift()
        if (!next) throw Error(`Unexpected API request: ${endpoint}`)
        if (next instanceof Error) throw next
        this.response = { statusCode: next.statusCode ?? 200, headers: next.headers || {}, cookies: [] }
        return next.json
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
    const require = (dependency) => {
      if (dependency === 'url') return { default: Url }
      if (dependency.endsWith('/secure-url')) return load('src/lib/secure-url.ts')
      if (dependency === 'buffer') return { Buffer }
      if (dependency.endsWith('/vehicle-photo')) return { getVehiclePhotoUrl: () => undefined }
      if (dependency.endsWith('/logger'))
        return {
          Logger: class {
            log(text) {
              h.logs.push(text)
            }
          },
        }
      if (dependency.replace(/\/$/, '').endsWith('/scriptable-utils'))
        return {
          textInput: async (title) => {
            h.prompts.push(title)
            return h.inputs.shift() ?? null
          },
        }
      const resolved = dependency.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), dependency + '.ts'))
        : 'src/' + dependency + '.ts'
      if (
        [
          'src/lib/bluelink-regions/base.ts',
          'src/lib/bluelink-regions/usa-kia.ts',
          'src/lib/auth-session.ts',
          'src/lib/storage.ts',
          'src/lib/user-error.ts',
          'src/lib/log-sanitizer.ts',
          'src/config.ts',
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
  h.account = account
  h.load = load
  h.sessions = () => new (load('src/lib/auth-session.ts').AuthSessionStore)(account)
  h.client = () => new (load('src/lib/bluelink-regions/usa-kia.ts').BluelinkUSAKia)(account)
  h.reply = (endpoint, json, headers = {}, statusCode = 200) => {
    const queue = h.routes.get(endpoint) || []
    queue.push({ json, headers, statusCode })
    h.routes.set(endpoint, queue)
  }
  h.fail = (endpoint) => {
    const queue = h.routes.get(endpoint) || []
    queue.push(new Error('Network unavailable'))
    h.routes.set(endpoint, queue)
  }
  h.count = (endpoint) => h.calls.filter((call) => call.endpoint === endpoint).length
  h.tokens = (extra = {}) => ({
    accessToken: 'stored-sid',
    expiry: Math.floor(h.now / 1000) + 3600,
    additionalTokens: { rmToken: 'remembered-token', deviceId: 'trusted-device', clientuuid: 'trusted-client' },
    ...extra,
  })
  return h
}

function challenge(h) {
  h.reply('prof/authUser', success({ phoneVerifyStatus: true, otpKey: 'challenge-key' }), { xid: 'challenge-request' })
}

function verify(h, { finalLogin = true } = {}) {
  h.reply('cmm/verifyOTP', success(), { sid: 'verified-sid', rmtoken: 'remember-me-token' })
  if (finalLogin) h.reply('prof/authUser', success(), { sid: 'final-sid' })
}

test('device identity remains stable before any vehicle cache exists and across failed login attempts', async () => {
  const h = runtime()
  const first = h.client()
  const headers = first.getAdditionalHeaders()
  h.reply('prof/authUser', failure(), {}, 503)
  await assert.rejects(first.login(), /vehicle service is temporarily unavailable/)
  const next = h.client()
  assert.equal(next.getAdditionalHeaders().deviceId, headers.deviceId)
  assert.equal(next.getAdditionalHeaders().clientuuid, headers.clientuuid)
})

test('a normal SID login persists authentication before vehicle metadata and uses seconds for expiry', async () => {
  const h = runtime()
  const bl = h.client()
  h.reply('prof/authUser', success(), { sid: 'new-sid' })
  const token = await bl.login()
  assert.equal(token.accessToken, 'new-sid')
  assert.equal(token.expiry - Math.floor(h.now / 1000), 86400)
  assert.ok(token.additionalTokens.deviceId)
  assert.ok(token.additionalTokens.clientuuid)
  assert.equal(h.sessions().read().accessToken, 'new-sid')
  assert.equal(h.count('ownr/gvl'), 0)
})

test('remembered rmToken/device identity survive successful login without new MFA', async () => {
  const h = runtime()
  h.sessions().write(h.tokens())
  const bl = h.client()
  bl.tokens = h.tokens()
  h.reply('prof/authUser', success(), { sid: 'new-sid' })
  const token = await bl.login()
  assert.equal(h.calls[0].headers.rmtoken, 'remembered-token')
  assert.equal(token.additionalTokens.rmToken, 'remembered-token')
  assert.equal(token.additionalTokens.deviceId, 'trusted-device')
  assert.equal(token.additionalTokens.clientuuid, 'trusted-client')
  assert.equal(h.prompts.length, 0)
})

test('new session additionalTokens take priority over stale vehicle-cache device values', () => {
  const h = runtime()
  const bl = h.client()
  bl.cache = { token: h.tokens({ additionalTokens: { deviceId: 'stale-device', clientuuid: 'stale-client' } }) }
  bl.tokens = h.tokens()
  assert.equal(bl.getAdditionalHeaders().deviceId, 'trusted-device')
  assert.equal(bl.getAdditionalHeaders().clientuuid, 'trusted-client')
})

test('the first returned car supplies a persisted session-specific vehicle key before status', async () => {
  const h = runtime()
  const bl = h.client()
  bl.tokens = h.tokens()
  h.reply('ownr/gvl', success({ vehicleSummary: [vehicle, { ...vehicle, vehicleKey: 'second-car' }] }))
  const car = await bl.getCar()
  assert.equal(car.id, 'vehicle-key')
  assert.equal(bl.tokens.authId, 'vehicle-key')
  assert.equal(h.sessions().read().authId, 'vehicle-key')
})

for (const mode of ['widget', 'siri']) {
  test(`${mode} requests foreground verification without sending or prompting for an OTP`, async () => {
    const h = runtime({ [mode]: true })
    const bl = h.client()
    challenge(h)
    await assert.rejects(bl.login(), /Open Bluelocke in Scriptable/)
    assert.equal(h.count('cmm/sendOTP'), 0)
    assert.equal(h.prompts.length, 0)
    await assert.rejects(bl.mfa('EMAIL', 'challenge-key', 'challenge-request'), /Open Bluelocke in Scriptable/)
    assert.equal(h.count('cmm/sendOTP'), 0)
  })
}

test('Kia follows the v1.24.4 send, prompt, verify and final-login sequence', async () => {
  const h = runtime()
  challenge(h)
  h.reply('cmm/sendOTP', success())
  h.inputs.push('123456')
  verify(h)
  const token = await h.client().login()
  assert.equal(token.accessToken, 'final-sid')
  assert.deepEqual(
    h.calls.map((call) => call.endpoint),
    ['prof/authUser', 'cmm/sendOTP', 'cmm/verifyOTP', 'prof/authUser'],
  )
  assert.equal(h.calls[1].headers.notifytype, 'SMS')
  assert.equal(h.calls[2].headers.otpkey, 'challenge-key')
  assert.equal(h.calls[3].headers.sid, 'verified-sid')
  assert.equal(h.calls[3].headers.rmtoken, 'remember-me-token')
  assert.equal(h.sessions().read().additionalTokens.rmToken, 'remember-me-token')
})

test('cancelling code entry starts a fresh Kia challenge on the next launch', async () => {
  const h = runtime()
  challenge(h)
  h.reply('cmm/sendOTP', success())
  assert.equal(await h.client().login(), undefined)
  assert.equal(h.count('cmm/sendOTP'), 1)
  challenge(h)
  h.reply('cmm/sendOTP', success())
  h.inputs.push('123456')
  verify(h)
  const token = await h.client().login()
  assert.equal(token.accessToken, 'final-sid')
  assert.equal(h.count('cmm/sendOTP'), 2)
  assert.equal(h.count('prof/authUser'), 3)
  assert.equal(h.count('cmm/verifyOTP'), 1)
})

test('an unsuccessful code can retry through a new Kia login instead of a retained challenge', async () => {
  const h = runtime()
  challenge(h)
  h.reply('cmm/sendOTP', success())
  h.inputs.push('wrong-code')
  h.reply('cmm/verifyOTP', failure())
  assert.equal(await h.client().login(), undefined)
  challenge(h)
  h.reply('cmm/sendOTP', success())
  h.inputs.push('123456')
  verify(h)
  assert.equal((await h.client().login()).accessToken, 'final-sid')
  assert.equal(h.count('cmm/sendOTP'), 2)
})

test('a failed final login can restart with a new challenge', async () => {
  const h = runtime()
  h.inputs.push('123456')
  h.reply('cmm/sendOTP', success())
  verify(h, { finalLogin: false })
  h.fail('prof/authUser')
  await assert.rejects(h.client().mfa('SMS', 'challenge-key', 'challenge-request'), /Network unavailable/)
  challenge(h)
  h.inputs.push('654321')
  h.reply('cmm/sendOTP', success())
  verify(h)
  assert.equal((await h.client().login()).accessToken, 'final-sid')
  assert.equal(h.count('cmm/sendOTP'), 2)
  assert.equal(h.count('cmm/verifyOTP'), 2)
})

test('Kia restores the v1.24.4 response rules for session renewal', () => {
  const h = runtime()
  const bl = h.client()
  assert.equal(bl.requestResponseValid({ statusCode: 200 }, success()).retry, false)
  for (const statusCode of [401, 403, 429, 500, 503])
    assert.equal(bl.requestResponseValid({ statusCode }, failure()).retry, true)
  for (const code of [1001, 1003, 1005, 2000, 7406])
    assert.equal(bl.requestResponseValid({ statusCode: 200 }, failure(code)).retry, true)
})

test('cached-status service failure never triggers a forced login', async () => {
  const h = runtime()
  const bl = h.client()
  bl.tokens = h.tokens({ authId: 'vehicle-key' })
  let renewals = 0
  bl.refreshLogin = async () => {
    renewals++
  }
  h.reply('cmm/gvi', failure(), {}, 503)
  await assert.rejects(bl.getCarStatus('vehicle-key', false), /vehicle service is temporarily unavailable/)
  assert.equal(renewals, 0)
})

test('auth refresh reloads the session-specific vehicle key and updates the cached car', async () => {
  const h = runtime()
  const bl = h.client()
  bl.tokens = h.tokens()
  bl.cache = { token: bl.tokens, car: { ...vehicle, id: 'old-key' }, status: { range: 415 } }
  h.reply('ownr/gvl', success({ vehicleSummary: [{ ...vehicle, vehicleKey: 'new-key' }] }))
  await bl.onAuthRefreshed()
  assert.equal(bl.tokens.authId, 'new-key')
  assert.equal(bl.cache.car.id, 'new-key')
  assert.equal(h.sessions().read().authId, 'new-key')
})

test('a vehicle-list outage after login does not lose the SID or request another login on restart', async () => {
  const h = runtime()
  h.reply('prof/authUser', success(), { sid: 'new-sid' })
  h.fail('ownr/gvl')
  const first = h.client()
  await assert.rejects(first.superInit(h.account, false), /Network unavailable/)
  assert.equal(h.sessions().read().accessToken, 'new-sid')
  h.reply('ownr/gvl', success({ vehicleSummary: [vehicle] }))
  const next = h.client()
  next.getCarStatus = async () => ({ range: 415, twelveSoc: 84, lastStatusCheck: h.now })
  await next.superInit(h.account, false)
  assert.equal(h.count('prof/authUser'), 1)
  assert.equal(next.getCachedStatus().car.id, 'vehicle-key')
})

test('one rejected status request renews once and sends the new vehicle key on the replay', async () => {
  const h = runtime()
  h.sessions().write(h.tokens({ authId: 'old-key' }))
  const bl = h.client()
  bl.cache = { token: bl.tokens, car: { ...vehicle, id: 'old-key' }, status: { range: 415 } }
  bl.returnCarStatus = (status) => status
  h.reply('cmm/gvi', failure(1003))
  h.reply('prof/authUser', success(), { sid: 'new-sid' })
  h.reply('ownr/gvl', success({ vehicleSummary: [{ ...vehicle, vehicleKey: 'new-key' }] }))
  h.reply(
    'cmm/gvi',
    success({ vehicleInfoList: [{ lastVehicleInfo: { vehicleStatusRpt: { vehicleStatus: { battery: 84 } } } }] }),
  )
  assert.equal((await bl.getCarStatus('old-key', false)).battery, 84)
  assert.equal(h.count('prof/authUser'), 1)
  assert.equal(h.count('ownr/gvl'), 1)
  const replay = h.calls.filter((call) => call.endpoint === 'cmm/gvi')[1]
  assert.equal(replay.headers.sid, 'new-sid')
  assert.equal(replay.headers.vinkey, 'new-key')
  assert.deepEqual(JSON.parse(replay.data).vinKey, ['new-key'])
})

test('a rejected status replay does not trigger a second forced login', async () => {
  const h = runtime()
  h.sessions().write(h.tokens({ authId: 'old-key' }))
  const bl = h.client()
  bl.cache = { token: bl.tokens, car: { ...vehicle, id: 'old-key' }, status: {} }
  h.reply('cmm/gvi', failure(1003))
  h.reply('prof/authUser', success(), { sid: 'new-sid' })
  h.reply('ownr/gvl', success({ vehicleSummary: [vehicle] }))
  h.reply('cmm/gvi', failure(1005))
  await assert.rejects(bl.getCarStatus('old-key', false), /Failed to retrieve vehicle status/)
  assert.equal(h.count('prof/authUser'), 1)
  assert.equal(h.count('cmm/gvi'), 2)
})

test('a widget can retry login after verification was required, while keeping OTP entry in Scriptable', async () => {
  const h = runtime({ widget: true })
  challenge(h)
  await assert.rejects(h.client().superInit(h.account, true), /Open Bluelocke in Scriptable/)
  challenge(h)
  await assert.rejects(h.client().superInit(h.account, true), /Open Bluelocke in Scriptable/)
  assert.equal(h.count('prof/authUser'), 2)
  assert.equal(h.count('cmm/sendOTP'), 0)
  assert.equal(h.prompts.length, 0)
})

test('a metadata outage after renewing a cached SID recovers on restart without signing in again', async () => {
  const h = runtime()
  h.sessions().write(h.tokens({ authId: 'old-key' }))
  const first = h.client()
  first.cache = {
    token: first.tokens,
    car: { ...vehicle, id: 'old-key' },
    status: { range: 415, twelveSoc: 84, lastStatusCheck: h.now },
  }
  first.saveCache()
  h.reply('prof/authUser', success(), { sid: 'renewed-sid' })
  h.fail('ownr/gvl')
  await assert.rejects(first.refreshLogin(true), /Network unavailable/)
  assert.equal(h.sessions().read().accessToken, 'renewed-sid')
  assert.equal(h.sessions().read().authId, undefined)
  h.reply('ownr/gvl', success({ vehicleSummary: [{ ...vehicle, vehicleKey: 'renewed-key' }] }))
  const next = h.client()
  await next.superInit(h.account, true)
  assert.equal(h.count('prof/authUser'), 1)
  assert.equal(h.count('ownr/gvl'), 2)
  assert.equal(h.count('cmm/sendOTP'), 0)
  assert.equal(next.getCachedStatus().car.id, 'renewed-key')
  assert.equal(next.tokens.authId, 'renewed-key')
  assert.equal(h.sessions().read().authId, 'renewed-key')
  next.returnCarStatus = (status) => status
  h.reply(
    'cmm/gvi',
    success({ vehicleInfoList: [{ lastVehicleInfo: { vehicleStatusRpt: { vehicleStatus: { battery: 84 } } } }] }),
  )
  assert.equal((await next.getCarStatus('renewed-key', false)).battery, 84)
  const statusCall = h.calls.find((call) => call.endpoint === 'cmm/gvi')
  assert.equal(statusCall.headers.sid, 'renewed-sid')
  assert.deepEqual(JSON.parse(statusCall.data).vinKey, ['renewed-key'])
})

test('cache loading defers expired-session metadata to normal authentication renewal', async () => {
  const h = runtime()
  const bl = h.client()
  bl.tokens = h.tokens({ expiry: Math.floor(h.now / 1000) - 60 })
  bl.cache = { token: bl.tokens, car: { ...vehicle, id: 'old-key' }, status: {} }
  await bl.onCacheLoaded()
  assert.equal(h.count('ownr/gvl'), 0)
})

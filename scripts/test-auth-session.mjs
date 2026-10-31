import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
let nextUuid = 0
const plain = (value) => JSON.parse(JSON.stringify(value))
const FIRST_CAR = {
  id: 'first-car',
  vin: '5NMS3CADXLH123456',
  nickName: 'Daily',
  modelName: 'Tucson',
  modelYear: '2022',
}
const PREVIOUS_CAR = {
  id: 'previous-choice',
  vin: '5NMS3CADXLH654321',
  nickName: 'Other',
  modelName: 'Santa Fe',
  modelYear: '2024',
}
const ACCOUNT = { username: 'driver@example.test', password: 'private-password', pin: '4321', region: 'usa' }
const token = (accessToken = 'session-token', expiry = Math.floor(Date.now() / 1000) + 3600) => ({
  accessToken,
  refreshToken: `refresh-${accessToken}`,
  expiry,
  additionalTokens: { deviceid: 'trusted-device', deviceId: 'trusted-kia-device', clientuuid: 'trusted-client' },
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function runtime({ keys = new Map(), name = 'Blue locke', background = false, siri = false } = {}) {
  const h = {
    keys,
    authCalls: [],
    metadataCalls: [],
    statusCalls: [],
    requests: [],
    logs: [],
    token: token(),
    now: Date.now(),
  }
  class Clock extends Date {
    static now() {
      return h.now
    }
  }
  const context = vm.createContext({
    Error,
    Date: Clock,
    Script: { name: () => name },
    config: { runsInWidget: background, runsWithSiri: siri },
    UUID: { string: () => `00000000-0000-4000-8000-${String(++nextUuid).padStart(12, '0')}` },
    Keychain: {
      contains: (key) => keys.has(key),
      get: (key) => keys.get(key),
      set: (key, value) => keys.set(key, value),
      remove: (key) => keys.delete(key),
    },
    Timer: { schedule: () => ({ invalidate() {} }) },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 200, headers: {}, cookies: [] }
        h.requests.push(this)
      }
      async loadJSON() {
        if (!h.transport) throw Error(`Unexpected network request: ${this.url}`)
        return h.transport(this)
      }
      async loadString() {
        return this.loadJSON()
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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const require = (dependency) => {
      if (dependency.endsWith('/secure-url')) return load('src/lib/secure-url.ts')
      if (dependency.endsWith('/user-error')) return load('src/lib/user-error.ts')
      if (dependency === 'url') return { default: Url }
      if (dependency === 'buffer') return { Buffer }
      if (dependency.endsWith('/logger'))
        return {
          Logger: class {
            log(message) {
              h.logs.push(message)
            }
          },
        }
      if (dependency.replace(/\/$/, '').endsWith('/scriptable-utils'))
        return {
          quickOptions: async () => {
            throw Error('Authentication must not open a vehicle picker')
          },
          textInput: async () => {
            throw Error('Unexpected MFA prompt')
          },
        }
      if (dependency.endsWith('/util'))
        return { isNotEmptyObject: (object) => !!object && Object.keys(object).length > 0 }
      const resolved = dependency.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), dependency + '.ts'))
        : 'src/' + dependency + '.ts'
      if (
        resolved === 'src/config.ts' ||
        /^src\/lib\/(?:storage|log-sanitizer|vehicle-photo|[^/]*auth[^/]*|[^/]*session[^/]*)\.ts$/.test(resolved) ||
        /^src\/lib\/bluelink-regions\/(?:base|usa|usa-kia|canada|australia)\.ts$/.test(resolved)
      )
        return load(resolved)
      return {}
    }
    vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.load = load
  h.settings = load('src/config.ts')
  h.base = load('src/lib/bluelink-regions/base.ts')
  h.configKey = `bluelocke:config:${JSON.stringify([name])}`
  h.account = (overrides = {}) => ({
    ...h.settings.getConfig(),
    manufacturer: 'hyundai',
    auth: { ...ACCOUNT },
    ...overrides,
  })
  h.saveAccount = (overrides = {}) => h.settings.setConfig(h.account(overrides))
  h.seedV125 = ({ selectionAccount, config = h.account(), sourceName = name } = {}) => {
    const account = JSON.stringify([config.manufacturer, config.auth.region, config.auth.username.trim()])
    const selection = {
      id: PREVIOUS_CAR.id,
      vin: PREVIOUS_CAR.vin,
      label: 'Old selected car',
      account: selectionAccount ?? account,
    }
    h.keys.set(h.configKey, JSON.stringify({ ...config, selectedVehicle: selection }))
    h.keys.set(
      `bluelocke:vehicle-cache:${JSON.stringify([sourceName, selection.account, selection.vin])}`,
      JSON.stringify({
        token: token('migrated-session'),
        car: PREVIOUS_CAR,
        status: { lastStatusCheck: Date.now(), range: 999, twelveSoc: 12 },
      }),
    )
  }
  h.decorate = (bl) => {
    bl.getCar = async () => {
      h.metadataCalls.push({
        token: bl.tokens?.accessToken ?? bl.cache?.token?.accessToken,
        values: [...keys.values()],
      })
      if (h.failMetadata) throw Error('Vehicle metadata unavailable')
      return plain(FIRST_CAR)
    }
    bl.getCarStatus = async (id) => {
      h.statusCalls.push({
        id,
        token: bl.tokens?.accessToken ?? bl.cache?.token?.accessToken,
        values: [...keys.values()],
      })
      if (h.failStatus) throw Error('Vehicle status unavailable')
      return { lastStatusCheck: Date.now(), lastRemoteStatusCheck: 0, range: 415, twelveSoc: 84 }
    }
    bl.initialize = (refreshAuth = background || siri) => bl.superInit(bl.config, refreshAuth)
    return bl
  }
  h.client = () => {
    const bl = h.decorate(new h.base.Bluelink(h.settings.getConfig()))
    bl.login = async (...args) => {
      h.authCalls.push(args)
      return plain(h.token)
    }
    return bl
  }
  return h
}

for (const mode of ['app', 'widget', 'shortcut']) {
  for (const stage of ['metadata', 'status']) {
    test(`${mode}: successful authentication survives a subsequent ${stage} failure`, async () => {
      const h = runtime({ background: mode === 'widget', siri: mode === 'shortcut' })
      h.saveAccount()
      h[stage === 'metadata' ? 'failMetadata' : 'failStatus'] = true
      await h
        .client()
        .initialize()
        .catch(() => {})
      assert.equal(h.authCalls.length, 1)
      const attempted = stage === 'metadata' ? h.metadataCalls : h.statusCalls
      assert.equal(attempted.length, 1)
      assert.ok(
        attempted[0].values.some((value) => value.includes('session-token')),
        'Authentication must be saved before vehicle requests',
      )
      const next = runtime({ keys: h.keys, background: mode === 'widget', siri: mode === 'shortcut' })
      const client = next.client()
      await client.initialize()
      assert.equal(next.authCalls.length, 0, 'Vehicle failure must not force another login or MFA')
      assert.equal(client.getCachedStatus().car.id, FIRST_CAR.id)
      assert.equal(client.getCachedStatus().status.range, 415)
      assert.equal(client.getCachedStatus().car.id, FIRST_CAR.id)
      assert.equal(client.cache.token.accessToken, 'session-token')
      assert.equal(client.cache.token.additionalTokens.deviceid, 'trusted-device')
    })
  }
}

test('a matching v1.25 session migrates without restoring the old car choice or status', async () => {
  const h = runtime()
  h.seedV125()
  const bl = h.client()
  await bl.initialize()
  assert.equal(h.authCalls.length, 0)
  assert.equal(h.metadataCalls[0].token, 'migrated-session')
  assert.equal(bl.getCachedStatus().car.id, FIRST_CAR.id)
  assert.equal(bl.getCachedStatus().status.range, 415)
  assert.equal(bl.cache.token.additionalTokens.deviceid, 'trusted-device')
  assert.equal(h.settings.getConfig().selectedVehicle, undefined)
})

test('v1.25 authentication from another account or another exact script name is not imported', async () => {
  for (const mismatch of ['account', 'script']) {
    const h = runtime()
    h.seedV125(
      mismatch === 'account'
        ? { selectionAccount: JSON.stringify(['hyundai', 'usa', 'another@example.test']) }
        : { sourceName: 'Bluelocke' },
    )
    const bl = h.client()
    await bl.initialize()
    assert.equal(h.authCalls.length, 1, `${mismatch} mismatch must require its own authentication`)
    assert.equal(bl.cache.token.accessToken, 'session-token')
  }
})

for (const field of ['username', 'password', 'pin']) {
  test(`changing ${field} invalidates saved and retired authentication`, async () => {
    const h = runtime()
    h.seedV125()
    await h.client().initialize()
    const old = h.settings.getConfig()
    h.settings.setConfig({ ...old, auth: { ...old.auth, [field]: `changed-${field}` } })
    h.token = token('new-account-session')
    const next = runtime({ keys: h.keys })
    next.token = h.token
    const bl = next.client()
    await bl.initialize()
    assert.equal(next.authCalls.length, 1)
    assert.equal(bl.cache.token.accessToken, 'new-account-session')
  })
}

test('resetting and signing in again cannot resurrect retired authentication', async () => {
  const h = runtime()
  h.seedV125()
  const bl = h.client()
  await bl.initialize()
  const account = h.settings.getConfig()
  bl.deleteCache(true)
  h.settings.deleteConfig()
  h.settings.setConfig(account)
  const next = runtime({ keys: h.keys })
  next.token = token('after-reset')
  const current = next.client()
  await current.initialize()
  assert.equal(next.authCalls.length, 1)
  assert.equal(current.cache.token.accessToken, 'after-reset')
})

test('forced renewal works and persists its result before a vehicle cache exists', async () => {
  const h = runtime()
  h.saveAccount()
  h.failMetadata = true
  const bl = h.client()
  await bl.initialize().catch(() => {})
  h.token = token('renewed-session')
  await bl.refreshAuth(true)
  assert.equal(h.authCalls.length, 2)
  const next = runtime({ keys: h.keys })
  const current = next.client()
  await current.initialize()
  assert.equal(next.authCalls.length, 0)
  assert.equal(current.cache.token.accessToken, 'renewed-session')
})

test('background renewal uses a stored refresh token without a vehicle cache', async () => {
  const h = runtime()
  h.saveAccount()
  h.token = token('expired-session', Math.floor(Date.now() / 1000) - 60)
  h.failMetadata = true
  await h
    .client()
    .initialize()
    .catch(() => {})
  const next = runtime({ keys: h.keys, background: true })
  const Regional = next.load('src/lib/bluelink-regions/usa.ts').BluelinkUSA
  const bl = next.decorate(new Regional(next.settings.getConfig()))
  const refreshes = []
  bl.request = async (props) => {
    assert.match(props.url, /oauth\/token\/refresh$/)
    refreshes.push(JSON.parse(props.data))
    return {
      resp: { statusCode: 200 },
      json: { access_token: 'refreshed-usa-session', refresh_token: 'next-refresh', expires_in: 3600 },
    }
  }
  bl.login = async () => {
    throw Error('Refresh must not require another full login')
  }
  await bl.initialize()
  assert.equal(refreshes.length, 1)
  assert.equal(refreshes[0].refresh_token, 'refresh-expired-session')
  assert.equal(bl.cache.token.accessToken, 'refreshed-usa-session')
})

test('a late rejection of an old token reuses the new session without a second login', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  await bl.initialize()
  h.authCalls.length = 0
  h.token = token('renewed-once')
  const firstResponse = deferred()
  const secondResponse = deferred()
  h.transport = (request) => {
    if (request.headers.Authentication === 'session-token')
      return request.url.endsWith('/first') ? firstResponse.promise : secondResponse.promise
    assert.equal(request.headers.Authentication, 'renewed-once')
    return { ok: true }
  }
  const validResponseFunction = (_response, body) => ({ valid: !!body.ok, retry: !body.ok })
  const first = bl.request({ url: 'https://example.test/first', validResponseFunction })
  const second = bl.request({ url: 'https://example.test/second', validResponseFunction })
  assert.equal(h.requests.length, 2)
  firstResponse.resolve({ ok: false })
  await first
  assert.equal(h.authCalls.length, 1)
  secondResponse.resolve({ ok: false })
  await second
  assert.equal(h.authCalls.length, 1, 'The second failure refers to the already-replaced token')
  assert.equal(h.requests.length, 4)
})

test('Kia USA saves its new SID and remembered device before fetching vehicle metadata', async () => {
  const h = runtime()
  h.saveAccount({ manufacturer: 'kia' })
  const Regional = h.load('src/lib/bluelink-regions/usa-kia.ts').BluelinkUSAKia
  const bl = new Regional(h.settings.getConfig())
  bl.request = async () => ({
    resp: { statusCode: 200, headers: { sid: 'fresh-kia-sid' } },
    json: { status: { statusCode: 0 }, payload: {} },
  })
  bl.getCar = async () => {
    throw Error('Kia vehicle list unavailable')
  }
  const login = bl.login.bind(bl)
  bl.login = () => login({ rmtoken: 'remembered-mfa', sid: 'verified-sid' })
  await assert.rejects(bl.superInit(bl.config, false), /vehicle list unavailable/)
  const device = bl.getAdditionalHeaders().deviceId
  const next = runtime({ keys: h.keys })
  const client = next.client()
  await client.initialize()
  assert.equal(next.authCalls.length, 0)
  assert.equal(client.cache.token.accessToken, 'fresh-kia-sid')
  assert.equal(client.cache.token.additionalTokens.rmToken, 'remembered-mfa')
  assert.equal(client.cache.token.additionalTokens.deviceId, device)
})

test('Canada single-car metadata loading never posts the rejected set-car mutation', async () => {
  const h = runtime()
  h.saveAccount({ auth: { ...ACCOUNT, region: 'canada' } })
  const Regional = h.load('src/lib/bluelink-regions/canada.ts').BluelinkCanada
  const bl = new Regional(h.settings.getConfig())
  const requests = []
  bl.request = async (props) => {
    requests.push(props)
    assert.equal(props.data, undefined, 'Loading the default car must not send { vehicleId } to vhcllst')
    return {
      resp: { statusCode: 200 },
      json: {
        responseHeader: { responseCode: 0 },
        result: { vehicles: [{ vehicleId: FIRST_CAR.id, vin: FIRST_CAR.vin, modelName: 'Tucson', modelYear: '2022' }] },
      },
    }
  }
  const car = await bl.getCar()
  assert.equal(car.id, FIRST_CAR.id)
  assert.equal(requests.length, 1)
})

test('adopting another client’s completed sign-in clears an earlier login failure', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  await bl.initialize()
  bl.login = async () => undefined
  await bl.refreshAuth(true)
  assert.equal(bl.loginFailed(), true)
  const peer = runtime({ keys: h.keys })
  peer.token = token('peer-completed-signin')
  await peer.client().initialize(true)
  await bl.refreshAuth(true)
  assert.equal(bl.loginFailed(), false)
  assert.equal(bl.tokens.accessToken, 'peer-completed-signin')
})

test('a late old-account authentication result cannot overwrite a changed account’s session', async () => {
  const h = runtime()
  h.saveAccount()
  const old = h.client()
  await old.initialize()
  const config = h.settings.getConfig()
  h.settings.setConfig({ ...config, auth: { ...config.auth, username: 'new-driver@example.test' } })
  const next = runtime({ keys: h.keys })
  next.token = token('new-driver-session')
  next.failMetadata = true
  await next
    .client()
    .initialize()
    .catch(() => {})
  try {
    old.saveAuthSession(token('late-old-account-session'))
  } catch {
    /* Rejection is also safe. */
  }
  const current = runtime({ keys: h.keys })
  const client = current.client()
  await client.initialize()
  assert.equal(current.authCalls.length, 0, 'A late result must not destroy the new account’s completed sign-in')
  assert.equal(client.cache.token.accessToken, 'new-driver-session')
})

test('changing accounts blocks commands and cached data on an existing client', async () => {
  const h = runtime()
  h.saveAccount()
  const old = h.client()
  await old.initialize()
  let commands = 0
  old.lock = async () => {
    commands++
    return { isSuccess: true, data: old.cache.status }
  }
  const current = h.settings.getConfig()
  h.settings.setConfig({ ...current, auth: { ...current.auth, username: 'another-driver@example.test' } })
  await assert.rejects(
    old.processRequest('lock', undefined, () => {}),
    /changed/,
  )
  assert.throws(() => old.getCachedStatus(), /changed/)
  assert.equal(commands, 0)
})

test('resetting with the same credentials revokes old commands and late authentication results', async () => {
  const h = runtime()
  h.saveAccount()
  const old = h.client()
  await old.initialize()
  old.deleteCache()
  assert.throws(() => old.saveAuthSession(token('resurrected')), /reset/)
  assert.throws(() => old.saveCache(), /reset/)
  await assert.rejects(
    old.processRequest('lock', undefined, () => {}),
    /reset/,
  )
  const next = h.client()
  await next.initialize()
  assert.notEqual(next.tokens.accessToken, 'resurrected')
})

test('an in-flight status result cannot recreate a reset cache', async () => {
  const h = runtime()
  h.saveAccount()
  const old = h.client()
  await old.initialize()
  const pending = deferred()
  old.getCarStatus = async () => pending.promise
  const status = old.getStatus(false, true)
  const cacheKey = old.getCacheKey()
  old.deleteCache()
  pending.resolve({ lastStatusCheck: Date.now(), range: 999 })
  await assert.rejects(status, /reset/)
  assert.equal(h.keys.has(cacheKey), false)
})

test('script names differing by spaces cannot share a cache or unbound legacy authentication', async () => {
  const keys = new Map()
  const first = runtime({ keys, name: 'Blue locke' })
  first.saveAccount()
  const a = first.client()
  await a.initialize()
  const other = runtime({ keys, name: 'Bluelocke' })
  other.saveAccount({ auth: { ...ACCOUNT, username: 'other-driver@example.test' } })
  keys.set(
    'egmp-scriptable-bl-cache-Bluelocke',
    JSON.stringify({ token: token('unbound-other-account'), car: PREVIOUS_CAR, status: {} }),
  )
  const b = other.client()
  await b.initialize()
  assert.notEqual(a.getCacheKey(), b.getCacheKey())
  assert.equal(other.authCalls.length, 1)
  assert.notEqual(b.tokens.accessToken, 'unbound-other-account')
})

test('API transport validates TLS and stops credential-bearing or downgraded redirects', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  await bl.initialize()
  h.transport = () => ({})
  await bl.request({ url: 'https://api.example.test/status', validResponseFunction: () => ({ valid: true }) })
  const req = h.requests.at(-1)
  assert.equal(req.allowInsecureRequest, false)
  assert.equal(req.onRedirect({ url: 'http://api.example.test/status' }), null)
  assert.equal(req.onRedirect({ url: 'https://attacker.example.test/collect' }), null)
  const safe = { url: 'https://api.example.test/next' }
  assert.equal(req.onRedirect(safe), safe)
  await assert.rejects(bl.request({ url: 'http://api.example.test/status' }), /HTTPS/)
  await assert.rejects(bl.request({ url: 'https://user:secret@api.example.test/status' }), /Unsafe/)
})

test('abandoned widget sign-in leases expire quickly and ordinary sign-in remains exclusive', () => {
  const h = runtime()
  h.saveAccount()
  const { AuthSessionStore, BACKGROUND_LOGIN_LEASE_MS } = h.load('src/lib/auth-session.ts')
  const first = new AuthSessionStore(h.settings.getConfig())
  const owner = first.acquireLogin(BACKGROUND_LOGIN_LEASE_MS)
  assert.ok(owner)
  const second = new AuthSessionStore(h.settings.getConfig())
  assert.equal(second.acquireLogin(), undefined)
  h.now += 31_000
  const replacement = second.acquireLogin()
  assert.ok(replacement)
  assert.notEqual(replacement, owner)
  first.releaseLogin(owner)
  assert.equal(new AuthSessionStore(h.settings.getConfig()).acquireLogin(), undefined)
})

test('corrupt or implausibly far-future leases cannot block sign-in indefinitely', () => {
  for (const until of [null, '999999999999999', Number.MAX_SAFE_INTEGER, Date.now() + 24 * 60 * 60 * 1000]) {
    const h = runtime()
    h.saveAccount()
    const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
    const store = new AuthSessionStore(h.settings.getConfig())
    store.acquireLogin()
    const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:login-lease:'))
    const record = JSON.parse(h.keys.get(key))
    record.until = until
    h.keys.set(key, JSON.stringify(record))
    assert.ok(new AuthSessionStore(h.settings.getConfig()).acquireLogin())
  }
})

test('a recovered login lease rejects late results from its previous owner', async () => {
  const h = runtime()
  h.saveAccount()
  const { AuthSessionStore, BACKGROUND_LOGIN_LEASE_MS } = h.load('src/lib/auth-session.ts')
  const store = new AuthSessionStore(h.settings.getConfig())
  const old = store.acquireLogin(BACKGROUND_LOGIN_LEASE_MS)
  h.now += 31_000
  const peer = new AuthSessionStore(h.settings.getConfig())
  const replacement = peer.acquireLogin()
  assert.ok(replacement)
  assert.throws(() => store.renewLogin(old), /sign-in attempt has ended/)
  const stale = h.client()
  stale.loginLeaseOwner = old
  assert.throws(() => stale.saveAuthSession(token('late-stale-session')), /sign-in attempt has ended/)
  assert.equal(peer.read(), undefined)
})

test('authentication progress renews a background lease while an abandoned attempt expires', () => {
  const h = runtime()
  h.saveAccount()
  const { AuthSessionStore, BACKGROUND_LOGIN_LEASE_MS } = h.load('src/lib/auth-session.ts')
  const first = new AuthSessionStore(h.settings.getConfig())
  const owner = first.acquireLogin(BACKGROUND_LOGIN_LEASE_MS)
  h.now += 20_000
  first.renewLogin(owner)
  h.now += 20_000
  const peer = new AuthSessionStore(h.settings.getConfig())
  assert.equal(peer.acquireLogin(), undefined)
  h.now += 11_000
  assert.ok(peer.acquireLogin())
})

test('an in-flight authentication response cannot overwrite the session that recovered its abandoned lock', async () => {
  const h = runtime({ background: true })
  h.saveAccount()
  const pending = deferred()
  h.transport = () => pending.promise
  const old = h.client()
  old.login = async () => {
    const result = await old.request({
      url: 'https://example.test/signin',
      noAuth: true,
      validResponseFunction: () => ({ valid: true, retry: false }),
    })
    return result.json
  }
  const first = old.initialize()
  assert.equal(h.requests.length, 1)
  h.now += 31_000
  const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
  const peer = new AuthSessionStore(h.settings.getConfig())
  assert.ok(peer.acquireLogin())
  peer.write(token('recovered-session'))
  pending.resolve(token('late-stale-session'))
  await assert.rejects(first, /sign-in attempt has ended/)
  assert.equal(peer.read().accessToken, 'recovered-session')
  assert.equal(peer.acquireLogin(), undefined, 'A late finally handler must not release the replacement lease')
})

for (const region of ['australia', 'usa']) {
  test(`${region}: upgrading a working v1.26 session retires its stuck lock and preserves authentication and cached status`, async () => {
    const h = runtime()
    h.saveAccount({ auth: { ...ACCOUNT, region } })
    const old = h.client()
    await old.initialize()
    const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
    const record = JSON.parse(h.keys.get(key))
    record.lease = { owner: 'interrupted-v126-run', until: h.now + 5 * 60 * 1000 }
    h.keys.set(key, JSON.stringify(record))
    const next = runtime({ keys: h.keys, background: true })
    const upgraded = next.client()
    await upgraded.initialize()
    assert.equal(upgraded.tokens.accessToken, old.tokens.accessToken)
    assert.equal(upgraded.getCachedStatus().status.range, 415)
    assert.equal(next.authCalls.length, 0)
    assert.equal(next.metadataCalls.length, 0)
    assert.equal(next.statusCalls.length, 0)
    assert.equal(JSON.parse(h.keys.get(key)).lease, undefined)
    assert.throws(() => old.saveAuthSession(token('late-v126-login')), /reset/)
  })
}

test('concurrent session/device writes cannot erase an active sign-in lock', () => {
  const h = runtime()
  h.saveAccount()
  const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
  const first = new AuthSessionStore(h.settings.getConfig())
  first.read()
  const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
  const stale = JSON.parse(h.keys.get(key))
  const owner = first.acquireLogin()
  // Another process started reading this record before the lock was claimed,
  // then saved a device/session update. It must not overwrite the lock.
  h.keys.set(key, JSON.stringify({ ...stale, devices: { deviceId: 'remembered-device' } }))
  const peer = new AuthSessionStore(h.settings.getConfig())
  assert.equal(peer.acquireLogin(), undefined)
  first.releaseLogin(owner)
  assert.ok(peer.acquireLogin())
})

test('a delayed session/device write cannot resurrect a completed sign-in lock', () => {
  const h = runtime()
  h.saveAccount()
  const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
  const first = new AuthSessionStore(h.settings.getConfig())
  const owner = first.acquireLogin()
  const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
  const stale = JSON.parse(h.keys.get(key))
  first.releaseLogin(owner)
  h.keys.set(key, JSON.stringify({ ...stale, devices: { deviceId: 'remembered-device' } }))
  assert.ok(new AuthSessionStore(h.settings.getConfig()).acquireLogin())
})

test('retiring a v1.26 lock never adopts a cache from a different account, script, or reset generation', async () => {
  for (const field of ['identity', 'script', 'generation']) {
    const h = runtime()
    h.saveAccount()
    const old = h.client()
    await old.initialize()
    const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
    const record = JSON.parse(h.keys.get(key))
    record.lease = { owner: 'interrupted-v126-run', until: h.now + 5 * 60 * 1000 }
    h.keys.set(key, JSON.stringify(record))
    const cacheKey = old.getCacheKey()
    const cache = JSON.parse(h.keys.get(cacheKey))
    cache[field] = 'another-owner'
    cache.status.range = 9999
    h.keys.set(cacheKey, JSON.stringify(cache))
    const next = runtime({ keys: h.keys, background: true })
    const upgraded = next.client()
    await upgraded.initialize()
    assert.equal(upgraded.getCachedStatus().status.range, 415)
    assert.equal(next.metadataCalls.length, 1)
    assert.equal(next.statusCalls.length, 1)
    assert.equal(next.authCalls.length, 0)
  }
})

test('Australia foreground sign-in completes and authentication requests have bounded timeouts', async () => {
  const h = runtime()
  h.saveAccount({ auth: { ...ACCOUNT, region: 'australia' } })
  const Regional = h.load('src/lib/bluelink-regions/australia.ts').BluelinkAustralia
  const bl = h.decorate(new Regional(h.settings.getConfig()))
  h.transport = (req) => {
    assert.equal(req.timeoutInterval, 30)
    if (req.url.includes('/oauth2/authorize') || req.url.endsWith('/session')) return ''
    if (req.url.endsWith('/signin'))
      return { redirectUrl: 'https://au-apigw.ccs.hyundai.com.au:8080/api/v1/user/oauth2/redirect?code=test-code' }
    if (req.url.endsWith('/oauth2/token'))
      return { access_token: 'australian-session', refresh_token: 'au-refresh', expires_in: 3600 }
    if (req.url.endsWith('/notifications/register')) return { resMsg: { deviceId: 'au-device' } }
    throw Error(`Unexpected auth route: ${req.url}`)
  }
  await bl.initialize()
  assert.equal(bl.tokens.accessToken, 'Bearer australian-session')
  assert.equal(bl.tokens.authId, 'au-device')
  const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
  assert.equal(JSON.parse(h.keys.get(key)).lease, undefined)
})

test('Australia widgets renew saved sessions and reconnect with saved credentials when refresh is rejected', async () => {
  const h = runtime({ background: true })
  h.saveAccount({ auth: { ...ACCOUNT, region: 'australia' } })
  const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
  new AuthSessionStore(h.settings.getConfig()).write(token('expired-au', Math.floor(h.now / 1000) - 60))
  const Regional = h.load('src/lib/bluelink-regions/australia.ts').BluelinkAustralia
  const bl = h.decorate(new Regional(h.settings.getConfig()))
  h.transport = (req) => {
    assert.equal(req.timeoutInterval, 5)
    if (req.url.endsWith('/oauth2/token'))
      return { access_token: 'renewed-au', refresh_token: 'au-refresh', expires_in: 3600 }
    if (req.url.endsWith('/notifications/register')) return { resMsg: { deviceId: 'au-device' } }
    throw Error('A widget must not start the full sign-in flow')
  }
  await bl.initialize()
  assert.equal(bl.tokens.accessToken, 'Bearer renewed-au')
  const key = [...h.keys.keys()].find((key) => key.startsWith('bluelocke:auth-session:'))
  const record = JSON.parse(h.keys.get(key))
  record.token.expiry = Math.floor(h.now / 1000) - 60
  h.keys.set(key, JSON.stringify(record))
  const retry = h.decorate(new Regional(h.settings.getConfig()))
  h.requests.length = 0
  h.transport = (req) => {
    if (req.url.endsWith('/oauth2/token') && req.body.includes('grant_type=refresh_token')) {
      req.response.statusCode = 400
      return { error: 'invalid_grant' }
    }
    if (req.url.includes('/oauth2/authorize') || req.url.endsWith('/session')) return ''
    if (req.url.endsWith('/signin')) {
      assert.equal(JSON.parse(req.body).email, ACCOUNT.username)
      assert.equal(JSON.parse(req.body).password, ACCOUNT.password)
      return { redirectUrl: 'https://au-apigw.ccs.hyundai.com.au:8080/api/v1/user/oauth2/redirect?code=test-code' }
    }
    if (req.url.endsWith('/oauth2/token'))
      return { access_token: 'reconnected-au', refresh_token: 'au-refresh', expires_in: 3600 }
    if (req.url.endsWith('/notifications/register')) return { resMsg: { deviceId: 'au-device' } }
    throw Error(`Unexpected auth route: ${req.url}`)
  }
  await retry.initialize()
  assert.equal(retry.tokens.accessToken, 'Bearer reconnected-au')
  assert.equal(JSON.parse(h.keys.get(key)).lease, undefined)
})

test('a failed Australian authentication request releases the lock for the next attempt', async () => {
  const h = runtime()
  h.saveAccount({ auth: { ...ACCOUNT, region: 'australia' } })
  const Regional = h.load('src/lib/bluelink-regions/australia.ts').BluelinkAustralia
  h.transport = () => {
    throw Error('The request timed out.')
  }
  await assert.rejects(new Regional(h.settings.getConfig()).superInit(h.settings.getConfig(), false), /timed out/)
  const { AuthSessionStore } = h.load('src/lib/auth-session.ts')
  assert.ok(new AuthSessionStore(h.settings.getConfig()).acquireLogin())
})

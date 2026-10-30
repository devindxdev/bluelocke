import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const SECRET = 'very-private-test-token'
const EMAIL = 'private.driver@example.test'
const VIN = '5NMS3CADXLH123456'

function runtime() {
  const h = { files: new Map(), keys: new Map(), persisted: '', console: [] }
  const fm = {
    fileExists: (file) => h.files.has(file),
    fileSize: (file) => (h.files.get(file)?.length || 0) / 1024,
    readString: (file) => h.files.get(file),
    writeString: (file, value) => h.files.set(file, value),
    move: (from, to) => {
      h.files.set(to, h.files.get(from))
      h.files.delete(from)
    },
    remove: (file) => h.files.delete(file),
  }
  const context = vm.createContext({
    Error,
    Script: { name: () => 'Bluelocke' },
    config: { runsInWidget: false },
    Keychain: {
      contains: (key) => h.keys.has(key),
      get: (key) => h.keys.get(key),
      remove: (key) => h.keys.delete(key),
      set: (key, value) => h.keys.set(key, value),
    },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: h.statusCode || 200, cookies: [{ name: 'sid', value: SECRET }] }
      }
      async loadJSON() {
        if (h.failRequest) throw Error('Request failed: ' + SECRET)
        return h.payload
      }
    },
    FileManager: { iCloud: () => fm },
    DateFormatter: class {
      string() {
        return '20261029120000'
      }
    },
    Device: { isPhone: () => true },
    console: { warn: (text) => h.console.push(text), log: (text) => h.console.push(text) },
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
      if (dependency === './persisted')
        return {
          default: () => ({
            getData: async () => h.persisted,
            write: async ({ data }) => {
              h.persisted = data
            },
            reset: async () => {
              h.persisted = ''
            },
          }),
        }
      if (dependency.endsWith('configRegister'))
        return { getConfig: (key) => (key === 'PERSISTED_LOG_MAX_LINES' ? 200 : 'error-log') }
      if (dependency === '../date') return { formatDate: () => '20261029' }
      if (dependency.endsWith('/logger')) return load('src/lib/logger.ts')
      if (dependency.endsWith('/auth-session')) return load('src/lib/auth-session.ts')
      if (dependency.endsWith('/user-error')) return load('src/lib/user-error.ts')
      if (dependency === 'url') return { default: Url }
      if (dependency.endsWith('secure-url')) return load('src/lib/secure-url.ts')
      if (dependency === './storage') return load('src/lib/storage.ts')
      if (file.endsWith('/base.ts') && !dependency.endsWith('log-sanitizer')) return {}
      if (dependency.endsWith('log-sanitizer')) return load('src/lib/log-sanitizer.ts')
      if (dependency.endsWith('log-format')) return load('src/lib/log-format.ts')
      throw Error(`Unexpected dependency: ${dependency}`)
    }
    vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.load = load
  Object.assign(h, load('src/lib/log-sanitizer.ts'))
  Object.assign(h, load('src/lib/log-format.ts'))
  return h
}

function absent(text, values) {
  for (const value of values) assert.ok(!text.includes(String(value)), `Leaked ${value} in ${text}`)
}

for (const key of [
  'pAuth',
  'authCode',
  'AccessToken',
  'access_token',
  'refresh_token',
  'ccsAccessToken',
  'nonCcsRefreshToken',
  'cookie',
  'Set-Cookie',
  'Authorization',
  'Authentication',
  'sid',
  'rmtoken',
  'password',
  'pwd',
  'username',
  'email',
  'userId',
  'loginId',
  'accountId',
  'PIN',
  'blueLinkServicePin',
  'otpKey',
  'otpValidationKey',
  'otpCode',
  'verificationCode',
  'authId',
  'deviceId',
  'clientuuid',
  'vin',
  'vinkey',
  'vehicleId',
  'vehicleKey',
  'regid',
  'nickName',
  'ownerName',
  'phoneNumber',
  'photoURL',
  'imageURL',
]) {
  test(`removes ${key} from structured and embedded JSON logs`, () => {
    const h = runtime()
    const raw = { [key]: SECRET, resCode: '4002', battery: { batSoc: 84 } }
    for (const input of [
      raw,
      JSON.stringify(raw),
      `response data: ${JSON.stringify(raw)}`,
      JSON.stringify({ data: JSON.stringify(raw) }),
    ]) {
      const output = h.sanitizeLog(input)
      absent(output, [SECRET])
      assert.match(output, /4002/)
      assert.match(output, /84/)
    }
  })
}

test('location objects, coordinate arrays, addresses, numeric credentials, and nested cookies are private', () => {
  const h = runtime()
  const output = h.sanitizeLog({
    location: { coord: { lat: 49.28123, lon: -123.12098 }, address: '123 Private Street' },
    gpsDetail: [49.28123, -123.12098],
    pin: 9876,
    vehicleId: 123456789,
    response: { cookies: [{ name: 'sid', value: SECRET }] },
    latitude: 49.28123,
    longitude: -123.12098,
    city: 'PrivateCity',
  })
  absent(output, [49.28123, -123.12098, '123 Private Street', 9876, 123456789, SECRET])
})

test('valid status values, units, errors, endpoints, timestamps, model, and range remain useful', () => {
  const h = runtime()
  const raw = {
    resCode: '4002',
    errorCode: 'E_NETWORK',
    statusCode: 401,
    valid: false,
    modelName: 'Tucson',
    modelYear: '2022',
    dte: { value: 415, unit: 1 },
    battery: { batSoc: 84 },
    fuelLevel: 42,
    doorLock: true,
    lastStatusCheck: 1793286000000,
  }
  const output = h.sanitizeLog(raw)
  assert.deepEqual(JSON.parse(output), raw)
  assert.match(
    h.sanitizeLog('2026-10-29T12:00:00Z GET https://example.test/api/v1/spa/vehicles/status'),
    /2026-10-29T12:00:00Z GET https:\/\/example.test\/api\/v1\/spa\/vehicles\/status/,
  )
})

test('URL parameters, callback codes, credentials, account paths, and fragments are removed', () => {
  const h = runtime()
  const output = h.sanitizeLog(
    'GET https://alice:private-pass@example.test/enrollment/details/private-user?code=oauth-secret&unknown=opaque-secret#private-fragment',
  )
  absent(output, ['alice', 'private-pass', 'private-user', 'oauth-secret', 'opaque-secret', 'private-fragment'])
  assert.match(output, /example.test\/enrollment\/details\//)
})

test('form credentials are removed even without a trailing ampersand', () => {
  const h = runtime()
  for (const input of [
    `country=CA&username=${EMAIL}&password=${SECRET}`,
    `password=${SECRET}`,
    `code=${SECRET}`,
    `pin=9876`,
    `payload=${encodeURIComponent(JSON.stringify({ password: SECRET, region: 'CA' }))}`,
    `payload=${encodeURIComponent(encodeURIComponent(JSON.stringify({ password: SECRET })))}`,
  ]) {
    const output = h.sanitizeLog(input)
    absent(output, [SECRET, encodeURIComponent(SECRET), EMAIL, '9876'])
  }
})

test('truncated and escaped historical entries still redact secrets', () => {
  const h = runtime()
  for (const input of [
    `request {"headers":{"AccessToken":"${SECRET}","statusCode":401`,
    String.raw`request {\"password\":\"${SECRET}\"}`,
    String.raw`request {\\\"refreshToken\\\":\\\"${SECRET}\\\"}`,
    `password: '${SECRET}'`,
    `password: "${SECRET}`,
    `MFA Code entered: 987654`,
    `expiry: 123, control token: ${SECRET}`,
    `Authorization: Bearer ${SECRET}`,
    `Basic c2VjcmV0OnNlY3JldA==`,
  ])
    absent(h.sanitizeLog(input), [SECRET, '987654', 'c2VjcmV0OnNlY3JldA=='])
})

test('personal identifiers are removed from free text and locally known secrets from echoed errors', () => {
  const h = runtime()
  h.registerLogSecrets(['p@ss word+&"!', 'private-user', '9876'])
  const output = h.sanitizeLog(
    `Failed private-user p@ss word+&"! ${encodeURIComponent('p@ss word+&"!')} 9876 ${EMAIL} ${VIN} (604) 555-0199 +16045550198 66c12b42-c3d6-41f3-80bb-1a14d6faad8d eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWxpY2UifQ.signature`,
  )
  absent(output, [
    'private-user',
    'p@ss word+&"!',
    encodeURIComponent('p@ss word+&"!'),
    '9876',
    EMAIL,
    VIN,
    '604',
    '16045550198',
    '66c12b42',
    'eyJhbGci',
  ])
})

test('HTML, malformed encodings, deep nesting, and cyclic objects fail closed', () => {
  const h = runtime()
  assert.equal(h.sanitizeLog(`<html><input value="${SECRET}"></html>`), '[HTML response omitted]')
  absent(h.sanitizeLog(`data=%7B%broken${SECRET}`), [SECRET])
  const cyclic = {}
  cyclic.self = cyclic
  cyclic.password = SECRET
  absent(h.sanitizeLog(cyclic), [SECRET])
  let deep = { password: SECRET }
  for (let i = 0; i < 30; i++) deep = { nested: deep }
  absent(h.sanitizeLog(deep), [SECRET])
})

test('nested request bodies remain valid JSON after redaction', () => {
  const h = runtime()
  const output = h.sanitizeLog({ data: JSON.stringify({ password: SECRET, battery: { batSoc: 84 } }) })
  const body = JSON.parse(JSON.parse(output).data)
  assert.equal(body.password, '[REDACTED]')
  assert.equal(body.battery.batSoc, 84)
  assert.equal(h.sanitizeLog(output), output)
})

test('standalone named cookie/header pairs hide values without removing range values', () => {
  const h = runtime()
  const output = h.sanitizeLog([{ name: 'sid', value: SECRET }, { dte: { value: 415 } }])
  absent(output, [SECRET])
  assert.match(output, /415/)
})

test('sanitizing twice keeps already sanitized logs stable', () => {
  const h = runtime()
  const once = h.sanitizeLog(
    `request ${JSON.stringify({ Authorization: SECRET, location: { lat: 49.28 }, statusCode: 401 })}`,
  )
  assert.equal(h.sanitizeLog(once), once)
})

test('Logger sanitizes before writing, including old contents, Error messages, and plain read()', () => {
  const h = runtime()
  const { Logger } = h.load('src/lib/logger.ts')
  const logger = new Logger('test.log')
  const path = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/test.log'
  h.files.set(path, `legacy {"refreshToken":"${SECRET}"}`)
  logger.log(new Error(`network failed for ${EMAIL}`))
  absent(h.files.get(path), [SECRET, EMAIL])
  assert.match(logger.read(), /network failed/)
  h.files.set(path, `old password=${SECRET}`)
  absent(logger.read(), [SECRET])
  absent(h.files.get(path), [SECRET])
})

test('rotated logs are sanitized on disk and in shared output', () => {
  const h = runtime()
  const { Logger } = h.load('src/lib/logger.ts')
  const logger = new Logger('test.log', 0.01)
  const path = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/test.log'
  h.files.set(path, `legacy {"access_token":"${SECRET}"}`)
  logger.log('Request failed: HTTP 401')
  assert.equal(h.files.size, 2)
  for (const contents of h.files.values()) absent(contents, [SECRET])
  absent(logger.readAndRedact(), [SECRET])
  assert.match(logger.readAndRedact(), /HTTP 401/)
})

test('the secondary persisted error log sanitizes writes and historical reads', async () => {
  const h = runtime()
  const persisted = h.load('src/lib/scriptable-utils/io/PersistedLog.ts').default()
  h.persisted = `legacy password=${SECRET}`
  await persisted.log(new Error(`Failed ${EMAIL}`))
  absent(h.persisted, [SECRET, EMAIL])
  h.persisted = `legacy {"vin":"${VIN}"}`
  absent(await persisted.get(), [VIN])
})

test('real API request logs and response snapshots redact credentials without changing the request or response', async () => {
  const h = runtime()
  const base = h.load('src/lib/bluelink-regions/base.ts')
  const bl = new base.Bluelink({
    auth: { username: EMAIL, password: 'private-password', pin: '9876' },
    debugLogging: true,
  })
  bl.tokens = { accessToken: SECRET, expiry: 9999999999 }
  h.payload = { resCode: '0000', vehicleId: 'private-vehicle', location: { lat: 49.28123 }, battery: { batSoc: 84 } }
  base.queueNextApiResponseCapture()
  const data = JSON.stringify({ password: 'private-password', pin: '9876' })
  const response = await bl.request({
    url: 'https://example.test/api/v1/spa/vehicles/private-vehicle/status',
    data,
    validResponseFunction: () => ({ valid: true, retry: false }),
  })
  assert.equal(response.json.vehicleId, 'private-vehicle')
  assert.equal(response.json.location.lat, 49.28123)
  assert.equal(bl.debugLastRequest.headers.Authentication, SECRET)
  assert.equal(bl.debugLastRequest.data, data)
  for (const contents of h.files.values())
    absent(contents, [SECRET, EMAIL, 'private-password', '9876', 'private-vehicle', '49.28123'])
  const snapshot = base.getBluelinkResponseLogger().readAndRedact()
  assert.match(snapshot, /batSoc/)
  assert.match(snapshot, /84/)
  h.failRequest = true
  await assert.rejects(
    bl.request({ url: 'https://example.test/api/test', validResponseFunction: () => ({ valid: true }) }),
    (error) => {
      absent(error.message, [SECRET])
      return true
    },
  )
})

test('historical URL vehicle and notification identifiers are hidden even if not known locally', () => {
  const h = runtime()
  const output = h.sanitizeLog(
    'GET https://example.test/api/v1/spa/vehicles/123456789/status https://example.test/api/v1/spa/notifications/private-notification/records',
  )
  absent(output, ['123456789', 'private-notification'])
  assert.match(output, /status/)
  assert.match(output, /records/)
  assert.equal(h.sanitizeLog(output), output)
})

test('numeric credentials echoed elsewhere are hidden and replacement markers stay stable', () => {
  const h = runtime()
  const output = h.sanitizeLog({ pin: 9876, message: 'Rejected PIN 9876' })
  absent(output, ['9876'])
  h.registerLogSecrets(['REDACTED'])
  const sanitized = h.sanitizeLog('password=REDACTED')
  assert.equal(h.sanitizeLog(sanitized), sanitized)
})

test('legacy set-car errors hide opaque identifiers even if the original request was truncated', () => {
  const h = runtime()
  absent(h.sanitizeLog('Failed to set car opaque-private-vehicle==: {"errorCode":"7406"}'), [
    'opaque-private-vehicle==',
  ])
  absent(h.sanitizeLog({ pin: 123, message: 'Rejected PIN 123' }), ['123'])
})

test('service outages and rate limits never fall back from refresh to a new login', async () => {
  for (const statusCode of [429, 500, 503]) {
    const h = runtime()
    const base = h.load('src/lib/bluelink-regions/base.ts')
    const bl = new base.Bluelink({
      auth: { username: EMAIL, password: 'private-password', pin: '9876' },
      debugLogging: false,
    })
    bl.tokens = { accessToken: SECRET, refreshToken: 'remembered', expiry: 0 }
    let logins = 0
    bl.login = async () => {
      logins++
      throw Error('Must not sign in during an outage')
    }
    bl.refreshTokens = async () => {
      h.payload = { error: 'service unavailable' }
      await bl.request({
        url: 'https://example.test/token/refresh',
        noAuth: true,
        validResponseFunction: () => ({ valid: false, retry: true }),
      })
    }
    h.statusCode = statusCode
    await assert.rejects(bl.refreshLogin(), /temporarily unavailable/)
    assert.equal(logins, 0)
    assert.equal(bl.tokens.accessToken, SECRET)
  }
})

test('API snapshots retain header lines and show indented redacted payloads', () => {
  const h = runtime()
  const input = [
    'URL: https://example.test/status',
    'Method: POST',
    'Status: 200',
    'Payload:',
    JSON.stringify({ result: { token: SECRET, battery: { batSoc: 84 }, range: { value: 415, unit: 1 } } }),
  ].join('\n')
  const output = h.formatLogForDisplay(input)
  assert.match(output, /Status: 200\nPayload:\n\{\n  "result": \{\n/)
  assert.match(output, /"battery": \{\n      "batSoc": 84\n    \}/)
  absent(output, [SECRET])
  assert.equal(h.formatLogForDisplay(output), output)
})

test('request/response logs keep separate timestamps and expand encoded request bodies for display', () => {
  const h = runtime()
  const request = {
    method: 'POST',
    headers: { Authorization: SECRET },
    data: JSON.stringify({ airCtrl: 1, airTemp: { value: '22', unit: 0 }, pin: 9876 }),
  }
  const response = { statusCode: 200, result: { lastStatusCheck: 1793286000000, range: 415 } }
  const input = `2026-10-29 10:00:00 - Sending request ${JSON.stringify(request)}\n2026-10-29 10:00:01 - response ${JSON.stringify(response)}`
  const output = h.formatLogForDisplay(input)
  assert.match(output, /Sending request\n\{\n  "method": "POST"/)
  assert.match(output, /"data": \{\n    "airCtrl": 1,\n    "airTemp": \{\n      "value": "22"/)
  assert.match(output, /\}\n2026-10-29 10:00:01 - response\n\{\n  "statusCode": 200/)
  absent(output, [SECRET, '9876'])
  assert.equal(h.formatLogForDisplay(output), output)
  const saved = JSON.parse(h.sanitizeLog(request))
  assert.equal(typeof saved.data, 'string', 'Presentation must not change the saved request body type')
  assert.equal(JSON.parse(saved.data).airCtrl, 1)
})

test('Logger reads and sharing return formatted logs without changing stored body types or leaking secrets', () => {
  const h = runtime()
  const { Logger } = h.load('src/lib/logger.ts')
  const logger = new Logger('format.log')
  logger.log('Sending request ' + JSON.stringify({ data: JSON.stringify({ temp: 22, password: SECRET }) }))
  logger.log('response ' + JSON.stringify({ statusCode: 200, battery: { batSoc: 84 } }))
  const first = logger.readAndRedact()
  assert.match(first, /"data": \{\n    "temp": 22/)
  assert.match(first, /response\n\{\n  "statusCode": 200/)
  absent(first, [SECRET])
  assert.equal(logger.readAndRedact(), first)
  assert.equal(logger.read(), first)
  for (const contents of h.files.values()) absent(contents, [SECRET])
})

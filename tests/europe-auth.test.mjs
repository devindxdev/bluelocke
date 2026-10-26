import assert from 'node:assert/strict'
import { constants, createHmac, generateKeyPairSync, privateDecrypt, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { rollup } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import polyfills from 'rollup-plugin-polyfill-node'
import ts from 'typescript'

const directory = await mkdtemp(path.join(tmpdir(), 'bluelocke-auth-'))
const transpile = {
  name: 'typescript-test',
  transform(source, id) {
    if (!id.endsWith('.ts')) return null
    return ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText
  },
}
const inputs = {
  auth: 'src/lib/bluelink-regions/hyundai-europe-auth.ts',
  crypto: 'src/lib/bluelink-regions/europe-crypto.ts',
  fingerprint: 'src/lib/bluelink-regions/europe-fingerprint.ts',
  logger: 'src/lib/logger.ts',
}
const bundle = await rollup({
  input: inputs,
  plugins: [transpile, nodeResolve({ extensions: ['.mjs', '.js', '.json', '.ts'] }), polyfills()],
})
await bundle.write({ dir: directory, format: 'es', entryFileNames: '[name].mjs' })
await bundle.close()
after(() => rm(directory, { recursive: true, force: true }))
const load = (name) => import(pathToFileURL(path.join(directory, `${name}.mjs`)))
const { HyundaiEuropeAuth } = await load('auth')
const { encryptPasswordWithRsaJwk } = await load('crypto')
const { hyundaiAuthHeaders } = await load('fingerprint')
const { Logger } = await load('logger')
globalThis.UUID = { string: randomUUID }

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }
const deviceId = '4a3c4a91-e7ab-471c-8d8f-16e076217b96'
const username = 'marian+test@example.invalid'
const password = 'Parolă pentru test 🔑'
const cciTokens = {
  accessToken: 'cci-access',
  refreshToken: 'cci-refresh',
  exchangeableAccessToken: 'exchange-access',
  exchangeableRefreshToken: 'exchange-refresh',
  nonCcsToken: 'non-ccs',
  nonCcsRefreshToken: 'non-ccs-refresh',
  idToken: 'id-token',
}
const response = (json, statusCode = 200, headers = {}, cookies = '') => ({
  json,
  resp: { statusCode, headers },
  cookies,
})

function mockClient(responses) {
  const calls = []
  const auth = new HyundaiEuropeAuth(async (request) => {
    calls.push(request)
    assert.ok(responses.length, `Unexpected request: ${request.url}`)
    const next = responses.shift()
    if (next instanceof Error) throw next
    return structuredClone(next)
  }, '+02:00')
  return { auth, calls }
}

function loginResponses(overrides = {}) {
  const replies = [
    response('<html>Sign in</html>', 200, {}, 'session=old; preserve=a=b'),
    response({ retValue: jwk }, 200, {}, 'session=new; cert=present'),
    response('', 302, { LoCaTiOn: 'https://oneapp.hyundai.com/redirect?code=abc%2B%2F%3D' }),
    response(cciTokens),
    response({ accessToken: 'vehicle-token', expiresTime: 86400 }),
  ]
  for (const [index, reply] of Object.entries(overrides)) replies[index] = reply
  return replies
}

function expectedSignature(headers, body = '') {
  const identity = ['client-id', 'client-name', 'client-version', 'client-os-code'].map((key) => headers[key]).join('')
  const key = `${identity}OsZDfDuCyVXyfqjCoA2JbX2MrLpGwNBC`
  const message = identity + headers['client-os-version'] + headers['X-Timestamp'] + body.replace(/[ \t\n\v\f\r]/g, '')
  return createHmac('sha256', key).update(message).digest('hex')
}

function decryptedPassword(hex) {
  const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(hex, 'hex'))
  assert.equal(block[0], 0)
  assert.equal(block[1], 2)
  const separator = block.indexOf(0, 2)
  assert.ok(separator >= 10, 'PKCS#1 padding must contain at least eight nonzero bytes')
  return block.subarray(separator + 1).toString('utf8')
}

test('fingerprint matches an independent HMAC implementation, including body normalization', () => {
  const body = '{ "token": "a b\t\r\n\v\f", "unicode": "a\u00a0b" }'
  const headers = hyundaiAuthHeaders(deviceId, '+02:00', body)
  assert.equal(headers['X-Fingerprint'], expectedSignature(headers, body))
  assert.equal(headers['client-name'], 'HyundaiEU')
  assert.equal(headers['Content-Type'], 'application/json')
  assert.match(headers['App-Request-Id'], /^[A-F0-9]{24}_[a-f0-9]{32}_AOS$/)
  assert.notEqual(headers['X-Fingerprint'], expectedSignature(headers, body.replace('\u00a0', ' ')))
})

test('password encryption uses valid randomized PKCS#1 padding and preserves Unicode', () => {
  const first = encryptPasswordWithRsaJwk(password, jwk)
  const second = encryptPasswordWithRsaJwk(password, jwk)
  assert.equal(first.length, 512)
  assert.notEqual(first, second)
  assert.equal(decryptedPassword(first), password)
  assert.equal(decryptedPassword(second), password)
  assert.throws(() => encryptPasswordWithRsaJwk('x'.repeat(246), jwk), /too long/)
  assert.throws(() => encryptPasswordWithRsaJwk(password, {}), /missing/)
  assert.throws(() => encryptPasswordWithRsaJwk(password, { n: jwk.n, e: 'AA' }), /invalid/)
})

test('login exchanges signed OneApp tokens and retains the device ID and relative expiry', async () => {
  const { auth, calls } = mockClient(loginResponses())
  const before = Math.floor(Date.now() / 1000)
  const tokens = await auth.login(username, password, deviceId)
  assert.equal(tokens.accessToken, 'Bearer vehicle-token')
  assert.equal(tokens.authId, deviceId)
  assert.equal(tokens.refreshToken, 'cci-refresh')
  assert.equal(tokens.additionalTokens.cciAccessToken, 'cci-access')
  assert.ok(tokens.expiry >= before + 86400 && tokens.expiry <= Math.floor(Date.now() / 1000) + 86400)
  assert.equal(calls.length, 5)
  assert.ok(calls.every((call) => call.noAuth && call.disableAdditionalHeaders))
  assert.ok(calls.every((call) => !call.url.includes('integrationinfo')))
  assert.ok(calls[0].url.startsWith('https://idpconnect-eu.hyundai.com/auth/api/v2/user/oauth2/authorize?'))
  assert.match(calls[0].url, /client_id=4f4953b5-/)
  const signin = new URLSearchParams(calls[2].data)
  assert.equal(signin.get('username'), username)
  assert.equal(signin.get('encryptedPassword'), 'true')
  assert.equal(signin.get('kid'), 'test-key')
  assert.equal(decryptedPassword(signin.get('password')), password)
  assert.equal(calls[2].noRedirect, true)
  assert.equal(calls[2].headers.Cookie, 'session=new; preserve=a=b; cert=present')
  assert.equal(calls[3].url, 'https://cci-api-eu.hyundai.com/auth/v1/token?code=abc%2B%2F%3D')
  for (const call of calls.slice(3)) assert.equal(call.headers['X-Fingerprint'], expectedSignature(call.headers))
  assert.equal(calls[4].headers.authorization, 'Bearer cci-access')
  assert.equal(calls[4].headers.Authentication, 'non-ccs')
})

for (const [label, reply, pattern] of [
  ['server failure', response({}, 503), /HTTP 503/],
  ['server block', response('Abusing request'), /blocked/],
  ['network failure', new Error('password=secret&accessToken=secret'), /Could not connect/],
]) {
  test(`login stops on ${label} without leaking credentials`, async () => {
    const { auth, calls } = mockClient([reply])
    await assert.rejects(auth.login(username, password, deviceId), (error) => {
      assert.match(error.message, pattern)
      assert.doesNotMatch(error.message, /secret|example\.invalid/)
      return true
    })
    assert.equal(calls.length, 1)
  })
}

for (const location of [
  'https://oneapp.hyundai.com/redirect?error=invalid_grant',
  'https://other.example.invalid/redirect?code=secret',
  'https://oneapp.hyundai.com/redirect.evil?code=secret',
  'https://oneapp.hyundai.com/redirect?code=one&code=two',
  'http://oneapp.hyundai.com/redirect?code=secret',
]) {
  test(`login rejects an invalid callback: ${location}`, async () => {
    const { auth, calls } = mockClient(loginResponses({ 2: response('', 302, { location }) }))
    await assert.rejects(auth.login(username, password, deviceId), /sign-in did not complete/)
    assert.equal(calls.length, 3)
  })
}

test('account consent has a useful error and does not consume an auth code', async () => {
  const { auth, calls } = mockClient(
    loginResponses({
      2: response('', 302, { location: 'https://idpconnect-eu.hyundai.com/auth/web/v1/user/authorization' }),
    }),
  )
  await assert.rejects(auth.login(username, password, deviceId), /account terms in myHyundai/)
  assert.equal(calls.length, 3)
})

for (const [index, reply, message] of [
  [1, response({ retValue: {} }), /invalid login certificate/],
  [3, response({ accessToken: 'only-one-field' }), /incomplete session/],
  [3, response({ code: 9036, accessToken: 'do-not-print' }, 400), /HTTP 400, code 9036/],
  [4, response({ expiresTime: 86400 }), /no vehicle access token/],
]) {
  test(`login handles a malformed or rejected response at step ${index + 1}`, async () => {
    const { auth, calls } = mockClient(loginResponses({ [index]: reply }))
    await assert.rejects(auth.login(username, password, deviceId), (error) => {
      assert.match(error.message, message)
      assert.doesNotMatch(error.message, /do-not-print|only-one-field/)
      return true
    })
    assert.equal(calls.length, index + 1)
  })
}

test('refresh signs the full token body, rotates tokens and preserves omitted fields', async () => {
  const first = mockClient(loginResponses())
  const cached = await first.auth.login(username, password, deviceId)
  const { auth, calls } = mockClient([
    response({ accessToken: 'next-cci', refreshToken: 'next-refresh' }, 200, {}, 'not=unrelated; t=cookie-exchange=='),
    response({ ccsAccessToken: 'Bearer next-vehicle', expiresTime: 3600 }),
  ])
  const refreshed = await auth.refresh(cached)
  assert.equal(calls[0].url, 'https://cci-api-eu.hyundai.com/auth/v2/token-refresh')
  assert.equal(calls[0].headers['X-Fingerprint'], expectedSignature(calls[0].headers, calls[0].data))
  assert.equal(calls[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].data), cciTokens)
  assert.equal(refreshed.authId, deviceId)
  assert.equal(refreshed.refreshToken, 'next-refresh')
  assert.equal(refreshed.accessToken, 'Bearer next-vehicle')
  assert.equal(refreshed.additionalTokens.nonCcsRefreshToken, 'non-ccs-refresh')
  assert.equal(refreshed.additionalTokens.exchangeableAccessToken, 'cookie-exchange==')
  assert.equal(calls[1].headers['exchangeable-token'], 'cookie-exchange==')
  assert.equal(cached.refreshToken, 'cci-refresh')
})

test('legacy cached sessions require a new login instead of using the old refresh endpoint', async () => {
  const { auth, calls } = mockClient([])
  assert.equal(await auth.refresh({ accessToken: 'old', refreshToken: 'old', authId: deviceId }), undefined)
  assert.equal(calls.length, 0)
})

test('missing token expiry defaults to one hour', async () => {
  const { auth } = mockClient(loginResponses({ 4: response({ accessToken: 'vehicle-token' }) }))
  const before = Math.floor(Date.now() / 1000)
  const result = await auth.login(username, password, deviceId)
  assert.ok(result.expiry >= before + 3600 && result.expiry <= Math.floor(Date.now() / 1000) + 3600)
})

test('shared debug logs redact OneApp tokens, cookies and the auth code', () => {
  const secrets = {
    accessToken: 'secret-access',
    cciAccessToken: 'secret-cci',
    refreshToken: 'secret-refresh',
    exchangeableAccessToken: 'secret-exchange',
    exchangeableRefreshToken: 'secret-exchange-refresh',
    nonCcsToken: 'secret-non-ccs',
    nonCcsRefreshToken: 'secret-non-ccs-refresh',
    idToken: 'secret-id',
    Cookie: 'secret-cookie',
    'Set-Cookie': 'secret-set-cookie',
    'exchangeable-token': 'secret-header-exchange',
    'non-ccs-token': 'secret-header-non-ccs',
  }
  const contents =
    JSON.stringify(secrets) +
    '\n' +
    JSON.stringify({ url: 'https://cci-api-eu.hyundai.com/auth/v1/token?code=secret-code' })
  globalThis.FileManager = { iCloud: () => ({ fileExists: () => true, readString: () => contents }) }
  const result = new Logger('test.log').readAndRedact()
  assert.doesNotMatch(result, /secret-/)
  assert.match(result, /REDACTED/)
})

test('the bundled crypto runs without Node Buffer, Web Crypto or TextEncoder', async () => {
  const build = await rollup({
    input: inputs.fingerprint,
    plugins: [transpile, nodeResolve({ extensions: ['.mjs', '.js', '.json', '.ts'] }), polyfills()],
  })
  const { output } = await build.generate({ format: 'iife', name: 'Fingerprint' })
  await build.close()
  const context = vm.createContext({ UUID: { string: randomUUID } })
  vm.runInContext(output[0].code, context)
  const headers = context.Fingerprint.hyundaiAuthHeaders(deviceId, '+02:00', '{"token":"test"}')
  assert.equal(headers['X-Fingerprint'], expectedSignature(headers, '{"token":"test"}'))
})

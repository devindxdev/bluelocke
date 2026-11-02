import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './auth-harness.mjs'

const invalidDevice = { retCode: 'F', resCode: '4002', resMsg: 'Invalid request body - Invalid deviceId. ' }
const success = (resMsg = {}) => ({ retCode: 'S', resCode: '0000', resMsg })
const plain = (value) => JSON.parse(JSON.stringify(value))

function client(options = {}) {
  const h = runtime(options)
  const Regional = h.load('src/lib/bluelink-regions/europe.ts').BluelinkEurope
  const bl = new Regional({ ...h.account, manufacturer: options.manufacturer || 'hyundai' })
  bl.cache = {
    token: {
      accessToken: 'Bearer vehicle-token', authId: 'rejected-device', refreshToken: 'cci-refresh',
      expiry: Date.now() / 1000 + 3600, additionalTokens: { cciAccessToken: 'cci-token' },
    },
    car: { id: 'car', vin: 'VIN-car', modelName: 'Tucson', europeccs2: 1 },
    status: { locked: true, range: 400 },
  }
  bl.refreshTokens = async () => { throw Error('Device recovery must not refresh tokens') }
  bl.login = async () => { throw Error('Device recovery must not sign in again') }
  bl.sleep = async () => {}
  return { h, bl }
}

const statusRequest = (bl, overrides = {}) => ({
  url: `${bl.apiDomain}/api/v1/spa/vehicles/car/ccs2/carstatus/latest`,
  validResponseFunction: bl.requestResponseValid,
  ...overrides,
})

function registerReply(req) {
  assert.equal(req.headers.Authorization, undefined)
  assert.equal(req.headers['ccsp-device-id'], undefined)
  assert.ok(JSON.parse(req.body).pushRegId)
  return success({ deviceId: 'replacement-device' })
}

for (const name of ['bluelocke', 'EU test copy']) {
  for (const statusCode of [400, 200]) {
    test(`${name}, HTTP ${statusCode}: rejected device is replaced once and persisted under the existing script name`, async () => {
      const { h, bl } = client({ name })
      const originalToken = plain(bl.cache.token)
      h.transport = async (req) => {
        if (req.url.endsWith('/notifications/register')) return registerReply(req)
        if (req.headers['ccsp-device-id'] === 'rejected-device') {
          req.response.statusCode = statusCode
          return invalidDevice
        }
        assert.equal(req.headers['ccsp-device-id'], 'replacement-device')
        assert.equal(req.headers.Authorization, originalToken.accessToken)
        return success({ status: 'available' })
      }
      const result = await bl.request(statusRequest(bl))
      assert.equal(result.json.retCode, 'S')
      assert.equal(h.requests.length, 3)
      assert.deepEqual(plain(bl.cache.token), { ...originalToken, authId: 'replacement-device' })
      const saved = JSON.parse(h.keys.get(`egmp-scriptable-bl-cache-${name.replaceAll(' ', '')}`))
      assert.equal(saved.token.authId, 'replacement-device')
      assert.deepEqual(saved.car, plain(bl.cache.car))
      assert.deepEqual(saved.status, plain(bl.cache.status))
      const next = client({ name, keys: h.keys }).bl
      assert.equal((await next.loadCache()).token.authId, 'replacement-device')
    })
  }
}

test('initial vehicle loading repairs the active token before a cache exists', async () => {
  const { h, bl } = client()
  bl.tokens = bl.cache.token
  bl.cache = undefined
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) return registerReply(req)
    return req.headers['ccsp-device-id'] === 'rejected-device' ? invalidDevice : success()
  }
  assert.equal((await bl.request(statusRequest(bl))).json.retCode, 'S')
  assert.equal(bl.tokens.authId, 'replacement-device')
  assert.equal(h.keys.size, 0)
})

test('a repeated device rejection stops after a single registration and replay', async () => {
  const { h, bl } = client()
  h.transport = async (req) => req.url.endsWith('/notifications/register') ? registerReply(req) : invalidDevice
  const result = await bl.request(statusRequest(bl))
  assert.equal(result.json.retCode, 'F')
  assert.equal(bl.requestResponseValid(result.resp, result.json).valid, false)
  assert.equal(h.requests.length, 3)
})

for (const reply of [invalidDevice, success({})]) {
  test(`failed registration (${reply.retCode}) keeps the previous session and does not replay`, async () => {
    const { h, bl } = client()
    h.transport = async (req) => req.url.endsWith('/notifications/register') ? reply : invalidDevice
    await assert.rejects(bl.request(statusRequest(bl)), /Could not renew the Hyundai device registration/)
    assert.equal(h.requests.length, 2)
    assert.equal(bl.cache.token.authId, 'rejected-device')
    assert.equal(bl.deviceRegistrationPromise, undefined)
  })
}

test('overlapping device failures share a single registration', async () => {
  const { h, bl } = client()
  let releaseRegistration
  const registered = new Promise((resolve) => { releaseRegistration = resolve })
  let registrationStarted
  const started = new Promise((resolve) => { registrationStarted = resolve })
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) {
      registrationStarted()
      await registered
      return registerReply(req)
    }
    return req.headers['ccsp-device-id'] === 'rejected-device' ? invalidDevice : success()
  }
  const requests = [bl.request(statusRequest(bl)), bl.request(statusRequest(bl))]
  await started
  releaseRegistration()
  const results = await Promise.all(requests)
  assert.ok(results.every((result) => result.json.retCode === 'S'))
  assert.equal(h.requests.filter((req) => req.url.endsWith('/notifications/register')).length, 1)
})

test('a late failure from the old device reuses the replacement registration', async () => {
  const { h, bl } = client()
  let releaseLateResponse
  const late = new Promise((resolve) => { releaseLateResponse = resolve })
  let initial = 0
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) return registerReply(req)
    if (req.headers['ccsp-device-id'] !== 'rejected-device') return success()
    if (++initial === 1) await late
    return invalidDevice
  }
  const delayed = bl.request(statusRequest(bl))
  assert.equal((await bl.request(statusRequest(bl))).json.retCode, 'S')
  releaseLateResponse()
  assert.equal((await delayed).json.retCode, 'S')
  assert.equal(h.requests.filter((req) => req.url.endsWith('/notifications/register')).length, 1)
})

test('a rejected PIN request is rebuilt with the replacement ID in both body and header', async () => {
  const { h, bl } = client()
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) return registerReply(req)
    const deviceId = req.headers['ccsp-device-id']
    assert.equal(JSON.parse(req.body).deviceId, deviceId)
    return deviceId === 'rejected-device' ? invalidDevice : { controlToken: 'fresh-control', expiresTime: 300 }
  }
  assert.equal(await bl.getAuthCode('car'), 'Bearer fresh-control')
  assert.equal(await bl.getAuthCode('car'), 'Bearer fresh-control')
  assert.equal(bl.controlToken.deviceId, 'replacement-device')
  assert.equal(h.requests.length, 3)
})

test('unlock followed immediately by lock recovers a rejected device and obtains a new control token', async () => {
  const { h, bl } = client()
  let pins = 0
  const acceptedCommands = []
  bl.pollForCommandCompletion = async () => ({ isSuccess: true, data: bl.cache.status })
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) return registerReply(req)
    if (req.url.endsWith('/user/pin')) return { controlToken: `control-${++pins}`, expiresTime: 300 }
    const command = JSON.parse(req.body).command
    if (command === 'close' && req.headers['ccsp-device-id'] === 'rejected-device') {
      req.response.statusCode = 400
      return invalidDevice
    }
    assert.equal(req.headers.Authorization, command === 'open' ? 'Bearer control-1' : 'Bearer control-2')
    acceptedCommands.push(command)
    return { ...success(), msgId: `transaction-${command}` }
  }
  assert.equal((await bl.unlock('car')).isSuccess, true)
  assert.equal((await bl.lock('car')).isSuccess, true)
  assert.deepEqual(acceptedCommands, ['open', 'close'])
  assert.equal(pins, 2)
  assert.equal(h.requests.length, 6)
})

test('device rejection while polling an accepted command never resends that command', async () => {
  const { h, bl } = client()
  let polls = 0
  bl.getStatus = async () => ({ status: bl.cache.status })
  h.transport = async (req) => {
    if (req.url.endsWith('/notifications/register')) return registerReply(req)
    if (req.url.endsWith('/user/pin')) return { controlToken: 'control', expiresTime: 300 }
    if (req.url.endsWith('/control/door')) return { ...success(), msgId: 'transaction' }
    if (++polls === 1) return invalidDevice
    return success([{ recordId: 'transaction', result: 'success' }])
  }
  assert.equal((await bl.unlock('car')).isSuccess, true)
  assert.equal(h.requests.filter((req) => req.url.endsWith('/control/door')).length, 1)
  assert.equal(polls, 2)
  assert.equal(bl.controlToken, undefined)
})

for (const change of ['device', 'access token', 'vehicle']) {
  test(`a control token is renewed after the ${change} changes`, async () => {
    const { h, bl } = client()
    h.transport = async () => ({ controlToken: `control-${h.requests.length}`, expiresTime: 300 })
    assert.equal(await bl.getAuthCode('car'), 'Bearer control-1')
    assert.equal(await bl.getAuthCode('car'), 'Bearer control-1')
    if (change === 'device') bl.cache.token.authId = 'other-device'
    if (change === 'access token') bl.tokens = { ...bl.cache.token, accessToken: 'Bearer refreshed' }
    assert.equal(await bl.getAuthCode(change === 'vehicle' ? 'other-car' : 'car'), 'Bearer control-2')
    assert.equal(h.requests.length, 2)
  })
}

test('an ordinary authentication failure still refreshes once without device registration', async () => {
  const { h, bl } = client()
  let refreshes = 0
  bl.refreshTokens = async () => {
    refreshes++
    return { ...bl.cache.token, accessToken: 'Bearer refreshed' }
  }
  h.transport = async (req) => {
    if (req.headers.Authorization === 'Bearer refreshed') return success()
    req.response.statusCode = 401
    return { retCode: 'F', resCode: '7501' }
  }
  assert.equal((await bl.request(statusRequest(bl))).json.retCode, 'S')
  assert.equal(refreshes, 1)
  assert.equal(h.requests.length, 2)
})

for (const reply of [
  { retCode: 'F', resCode: '4004', resMsg: 'Duplicate request' },
  { retCode: 'F', resCode: '4002', resMsg: 'Invalid request body - missing command' },
  { retCode: 'F', resCode: '5031', resMsg: 'Service unavailable' },
  new Error('Connection timed out'),
]) {
  test(`an ambiguous or unrelated command failure is not replayed: ${reply.resMsg || reply.message}`, async () => {
    const { h, bl } = client()
    h.transport = async (req) => {
      if (req.url.endsWith('/user/pin')) return { controlToken: 'control', expiresTime: 300 }
      if (reply instanceof Error) throw reply
      req.response.statusCode = 400
      return reply
    }
    await assert.rejects(bl.lock('car'))
    assert.equal(h.requests.length, 2)
  })
}

test('unauthenticated registration is not recursively recovered', async () => {
  const { h, bl } = client()
  h.transport = async () => invalidDevice
  assert.equal(await bl.getDeviceId(), undefined)
  assert.equal(h.requests.length, 1)
})

test('Kia retains its existing request path', async () => {
  const { h, bl } = client({ manufacturer: 'kia' })
  h.transport = async () => invalidDevice
  assert.equal((await bl.request(statusRequest(bl, { noRetry: true }))).json.retCode, 'F')
  assert.equal(h.requests.length, 1)
})

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { runtime } from './auth-harness.mjs'

const reviewed = JSON.parse(fs.readFileSync(new URL('./fixtures/europe-pr-3.json', import.meta.url), 'utf8'))
for (const [file, hash] of Object.entries(reviewed.moduleHashes))
  test(`${file}: integrated code matches reviewed PR #3`, () => {
    const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    const ast = ts.createSourceFile('reviewed.ts', source, ts.ScriptTarget.Latest, true)
    const actual = crypto
      .createHash('sha256')
      .update(ts.createPrinter({ removeComments: true }).printFile(ast))
      .digest('hex')
    assert.equal(actual, hash)
  })
const token = {
  accessToken: 'Bearer vehicle-token',
  refreshToken: 'cci-refresh',
  authId: 'remembered-device',
  expiry: Date.now() / 1000 + 3600,
  additionalTokens: { cciAccessToken: 'cci-token' },
}
const client = (manufacturer = 'hyundai') => {
  const h = runtime()
  const Regional = h.load('src/lib/bluelink-regions/europe.ts').BluelinkEurope
  return { h, bl: new Regional({ ...h.account, manufacturer, auth: { ...h.account.auth, region: 'europe' } }) }
}

test('Hyundai Europe dispatches to the PR login without the obsolete integration-info reset', async () => {
  const { bl } = client()
  let logins = 0
  bl.HyundaiLogin = async () => {
    logins++
    return token
  }
  bl.request = async () => {
    throw Error('The old reset request must not run for Hyundai')
  }
  assert.equal(await bl.login(), token)
  assert.equal(logins, 1)
})

test('Kia Europe keeps its original reset and KiaLogin sequence', async () => {
  const { bl } = client('kia'),
    calls = []
  bl.request = async (props) => {
    calls.push(props.url)
    return { resp: { statusCode: 200 }, json: '', cookies: '' }
  }
  bl.KiaLogin = async () => {
    calls.push('KiaLogin')
    return token
  }
  assert.equal(await bl.login(), token)
  assert.match(calls[0], /^https:\/\/prd\.eu-ccapi\.kia\.com:8080\/api\/v1\/user\/oauth2\/authorize\?/)
  assert.equal(calls[1], 'KiaLogin')
  assert.equal(calls.length, 2)
})

for (const cached of [false, true])
  test(`Hyundai Europe ${cached ? 'reuses a cached device' : 'registers a device'} before calling the PR helper`, async () => {
    const { bl } = client(),
      calls = []
    if (cached) bl.cache = { token }
    bl.getDeviceId = async () => {
      calls.push('register')
      return 'registered-device'
    }
    bl.hyundaiAuthClient = () => ({
      login: async (...args) => {
        calls.push(args)
        return token
      },
    })
    assert.equal(await bl.HyundaiLogin(), token)
    assert.equal(calls.length, cached ? 1 : 2)
    assert.deepEqual(calls.at(-1), [
      'driver@example.test',
      'private-password',
      cached ? 'remembered-device' : 'registered-device',
    ])
  })

test('Hyundai refresh delegates only to the PR helper and keeps the original fallback on failure', async () => {
  const { bl } = client()
  bl.cache = { token }
  let seen
  bl.hyundaiAuthClient = () => ({
    refresh: async (cached) => {
      seen = cached
      return token
    },
  })
  assert.equal(await bl.refreshTokens(), token)
  assert.equal(seen, token)
  bl.hyundaiAuthClient = () => ({
    refresh: async () => {
      throw Error('Service unavailable')
    },
  })
  assert.equal(await bl.refreshTokens(), undefined)
})

test('the EU regional status wrapper accepts HEV data and exposes fuel and lock state', () => {
  const { bl } = client()
  const report = {
    Drivetrain: { Odometer: 12000, FuelSystem: { FuelLevel: 60, DTE: { Total: 700 } } },
    Green: { BatteryManagement: { BatteryRemain: { Ratio: 48 } } },
    Electronics: { Battery: { Level: 83 } },
    Cabin: { Door: { Row1: { Driver: { Open: 0, Lock: 0 }, Passenger: { Open: 0, Lock: 1 } } } },
  }
  const status = bl.returnCarStatus(report, Date.now())
  assert.equal(status.fuelLevel, 60)
  assert.equal(status.range, 700)
  assert.equal(status.twelveSoc, 83)
  assert.equal(status.locked, false)
  assert.equal(status.supportsChargeCommands, false)
  bl.cache = { car: { modelName: 'Tucson Hybrid', modelYear: '2022' }, status }
  assert.equal(bl.supportsChargingFeatures(), false)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './auth-harness.mjs'

const reported = Date.UTC(2026, 10, 2, 7, 43, 26)
const client = () => {
  const h = runtime()
  const Regional = h.load('src/lib/bluelink-regions/australia.ts').BluelinkAustralia
  const bl = new Regional({ ...h.account, auth: { ...h.account.auth, region: 'australia' } })
  bl.cache = { token: { accessToken: 'test-token' }, car: { id: 'test-car', europeccs2: 1 },
    status: { lastRemoteStatusCheck: reported - 60_000 } }
  return { h, bl }
}

for (const input of ['20261102074326', 20261102074326, '20261102074326.123', reported,
  String(reported), reported / 1000, String(reported / 1000)]) {
  test(`Australia parses the reported time ${input} into milliseconds`, () => {
    const { bl } = client()
    const result = bl.returnCarStatus({}, input)
    assert.equal(result.lastRemoteStatusCheck, reported + (String(input).endsWith('.123') ? 123 : 0))
    assert.ok(Math.abs(result.lastStatusCheck - Date.now()) < 1000)
  })
}

test('Australia prefers the UTC vehicle Date over the server snapshot time and ignores Offset', () => {
  const { bl } = client()
  const result = bl.returnCarStatus({ Date: '20261102074323.000', Offset: 10 }, '20261102074326')
  assert.equal(result.lastRemoteStatusCheck, Date.UTC(2026, 10, 2, 7, 43, 23))
  assert.equal(new Date(result.lastRemoteStatusCheck).toISOString(), '2026-11-02T07:43:23.000Z')
})

test('Australia uses lastUpdateTime if the vehicle Date is absent or invalid', () => {
  const { bl } = client()
  for (const Date of [undefined, null, '', 'invalid']) {
    assert.equal(bl.returnCarStatus({ Date }, '20261102074326').lastRemoteStatusCheck, reported)
  }
})

test('Australia rejects invalid calendar dates instead of normalizing them into another day', () => {
  const { bl } = client()
  for (const invalid of ['20260230074326', '20261302074326', '20261102244326', '20261102076026',
    '20261102074360', '00000000000000', '', 'invalid', 0, null, undefined]) {
    assert.equal(bl.returnCarStatus({}, invalid).lastRemoteStatusCheck, reported - 60_000)
  }
})

test('Australia repairs a previously cached compact date when no fresh timestamp is present', () => {
  const { bl } = client()
  bl.cache.status.lastRemoteStatusCheck = 20261102074326
  assert.equal(bl.returnCarStatus({}, undefined).lastRemoteStatusCheck, reported)
})

test('Australia first-load fallback remains a valid millisecond timestamp', () => {
  const { bl } = client()
  bl.cache = undefined
  const before = Date.now()
  const result = bl.returnCarStatus({}, undefined)
  assert.ok(result.lastRemoteStatusCheck >= before && result.lastRemoteStatusCheck <= Date.now())
})

test('Australia reads the screenshot response format through the actual status request', async () => {
  const { h, bl } = client()
  bl.cache.token.authId = 'device'
  h.transport = async () => ({ retCode: 'S', resCode: '0000', resMsg: {
    ServiceNo: 'RVS-K', lastUpdateTime: '20261102074326',
    state: { Vehicle: { Drivetrain: { FuelSystem: { DTE: { Total: 415 } } } } },
  } })
  const result = await bl.getCarStatus('test-car', false)
  assert.equal(result.lastRemoteStatusCheck, reported)
  assert.equal(result.range, 415)
})

test('Australia force refresh waits for genuinely newer data instead of accepting the compact number as a future time', async () => {
  const { h, bl } = client()
  const before = new Date(Date.now() - 60_000).toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const after = new Date(Date.now() + 60_000).toISOString().replace(/[-:T]/g, '').slice(0, 14)
  bl.sleep = async () => {}
  let polls = 0
  h.transport = async (req) => {
    if (!req.url.endsWith('/latest')) return { retCode: 'S', resCode: '0000' }
    return { retCode: 'S', resCode: '0000', resMsg: {
      lastUpdateTime: ++polls === 1 ? before : after, state: { Vehicle: {} },
    } }
  }
  const result = await bl.getCarStatus('test-car', true)
  assert.equal(polls, 2)
  assert.ok(result.lastRemoteStatusCheck < Date.now() + 61_000)
})

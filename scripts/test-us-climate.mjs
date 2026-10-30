import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const plain = (value) => JSON.parse(JSON.stringify(value))
const input = (extra = {}) => ({
  enable: true,
  temp: 22,
  tempType: 'C',
  durationMinutes: 15,
  frontDefrost: true,
  rearDefrost: true,
  steering: true,
  seatClimateOption: { driver: 8, passenger: 7, rearLeft: 0, rearRight: 0 },
  ...extra,
})
const reply = (manufacturer, { statusCode = 200, headers, json } = {}) => ({
  resp: { statusCode, headers: headers ?? (manufacturer === 'kia' ? { Xid: 'command-id' } : { tmsTid: 'command-id' }) },
  json: json ?? (manufacturer === 'kia' ? { status: { statusCode: 0 }, payload: {} } : ''),
})

// All network surfaces are mocked. Load the actual regional/base implementations
// so these tests exercise routing and payloads rather than a duplicate adapter.
function runtime(manufacturer = 'hyundai', { powertrain = 'ice', generation = 3, tempType = 'C' } = {}) {
  const h = { calls: [], queue: [], logs: [], keys: new Map(), saves: 0, polls: [] }
  const context = vm.createContext({
    Error,
    console,
    Script: { name: () => 'Climate tests' },
    config: { runsInWidget: false, runsWithSiri: false },
    Keychain: {
      contains: (key) => h.keys.has(key),
      get: (key) => h.keys.get(key),
      set: (key, value) => h.keys.set(key, value),
      remove: (key) => h.keys.delete(key),
    },
    Request: class {
      constructor() {
        throw Error('Live network requests are forbidden in climate tests')
      }
    },
  })
  const modules = new Map()
  const actualModules = new Set([
    'src/config.ts',
    'src/lib/auth-session.ts',
    'src/lib/storage.ts',
    'src/lib/user-error.ts',
    'src/lib/us-climate.ts',
    'src/lib/bluelink-regions/base.ts',
    'src/lib/bluelink-regions/usa.ts',
    'src/lib/bluelink-regions/usa-kia.ts',
  ])
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
    const require = (dependency) => {
      if (dependency === 'buffer') return { Buffer }
      if (dependency.endsWith('/vehicle-photo')) return { getVehiclePhotoUrl: () => undefined }
      if (dependency.endsWith('/util')) return { isNotEmptyObject: (value) => !!value && Object.keys(value).length > 0 }
      if (dependency.endsWith('/log-sanitizer')) return { registerLogSecrets() {}, sanitizeLog: String }
      const resolved = dependency.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), dependency + '.ts'))
        : 'src/' + dependency + '.ts'
      return actualModules.has(resolved) ? load(resolved) : {}
    }
    vm.runInContext(`(function(require,module,exports){\n${source}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  const { BluelinkUSA } = load('src/lib/bluelink-regions/usa.ts')
  const { BluelinkUSAKia } = load('src/lib/bluelink-regions/usa-kia.ts')
  const { AuthSessionStore } = load('src/lib/auth-session.ts')
  const Regional = manufacturer === 'kia' ? BluelinkUSAKia : BluelinkUSA
  const client = Object.create(Regional.prototype)
  client.config = {
    manufacturer,
    auth: { region: 'usa', username: 'driver@example.test', password: 'test-password', pin: '1234' },
    tempType,
    vehicleTypeOverride: 'auto',
    debugLogging: true,
  }
  client.apiDomain =
    manufacturer === 'kia' ? 'https://api.owners.kia.com/apigw/v1/' : 'https://api.telematics.hyundaiusa.com/'
  client.cache = {
    car: {
      id: 'registration-id',
      vin: 'TESTVIN0000000001',
      modelName: 'Test car',
      modelYear: '2022',
      powertrain,
      generation,
    },
    token: { accessToken: 'test-token', expiry: Date.now() / 1000 + 3600 },
    status: {
      soc: powertrain === 'ev' || powertrain === 'phev' ? 70 : 0,
      supportsChargeCommands: powertrain === 'ev' || powertrain === 'phev',
      ...(powertrain !== 'ev' && { fuelLevel: 50 }),
      climate: false,
    },
  }
  client.authSession = new AuthSessionStore(client.config)
  client.authSession.write(client.cache.token)
  client.logger = { log: (message) => h.logs.push(message) }
  client.getDateString = () => '20261029090000'
  client.sleep = async () => {}
  client.saveCache = () => {
    client.assertCurrentSession()
    h.saves += 1
  }
  client.request = async (options) => {
    client.assertCurrentSession()
    h.calls.push({ ...options, body: options.data ? JSON.parse(options.data) : undefined })
    const next = h.queue.shift() ?? reply(manufacturer)
    if (next instanceof Error) throw next
    return next
  }
  h.realPoll = Regional.prototype.pollForCommandCompletion.bind(client)
  client.pollForCommandCompletion = async (...args) => {
    h.polls.push(args)
    return { isSuccess: true, data: client.cache.status }
  }
  h.client = client
  h.load = load
  h.revoke = () => new AuthSessionStore(client.config).clear()
  h.start = (options = {}) => client.climateOn(client.cache.car.id, input(options))
  h.stop = () => client.climateOff(client.cache.car.id)
  return h
}

for (const powertrain of ['ice', 'hev', 'phev', 'ev']) {
  test(`Hyundai ${powertrain.toUpperCase()} uses its correct start and stop routes`, async () => {
    const h = runtime('hyundai', { powertrain })
    assert.equal((await h.start()).isSuccess, true)
    assert.equal((await h.stop()).isSuccess, true)
    const electric = powertrain === 'ev'
    assert.equal(h.calls[0].url, h.client.apiDomain + (electric ? 'ac/v2/evc/fatc/start' : 'ac/v2/rcs/rsc/start'))
    assert.equal(h.calls[1].url, h.client.apiDomain + (electric ? 'ac/v2/evc/fatc/stop' : 'ac/v2/rcs/rsc/stop'))
    assert.equal(h.calls[0].body.airTemp.value, electric ? '72' : 72)
    assert.equal(h.calls[0].body.airTemp.unit, 1)
    assert.equal(h.calls[0].body.igniOnDuration, electric ? 15 : 10)
    assert.equal(h.calls[0].body.heating1, 4)
    if (!electric) {
      assert.equal(h.calls[0].body.vin, 'registration-id')
      assert.equal(h.calls[0].body.username, 'driver@example.test')
      assert.equal(h.calls[0].body.Ims, 0)
    }
  })
}

for (const [evStatus, expectedPowertrain, expectedRoute] of [
  ['E', 'ev', 'ac/v2/evc/fatc/start'],
  ['P', 'phev', 'ac/v2/rcs/rsc/start'],
  ['N', 'ice', 'ac/v2/rcs/rsc/start'],
]) {
  test(`Hyundai migrates an older cache using enrollment ${evStatus} metadata before climate`, async () => {
    const h = runtime()
    delete h.client.cache.car.powertrain
    delete h.client.cache.car.generation
    h.queue.push(
      reply('hyundai', {
        json: {
          enrolledVehicleDetails: [
            {
              vehicleDetails: {
                vin: h.client.cache.car.vin,
                regid: h.client.cache.car.id,
                modelCode: 'Tucson',
                modelYear: '2022',
                evStatus,
                vehicleGeneration: '3',
              },
            },
          ],
        },
      }),
    )
    await h.start()
    assert.match(h.calls[0].url, /enrollment\/details\//)
    assert.equal(h.calls[1].url, h.client.apiDomain + expectedRoute)
    assert.equal(h.calls[1].headers.gen, '3')
    assert.equal(h.client.cache.car.powertrain, expectedPowertrain)
    assert.equal(h.saves, 1)
    await h.stop()
    assert.equal(h.calls.filter((call) => call.url.includes('enrollment')).length, 1)
  })
}

test('Hyundai refuses an older cache migration to a different vehicle', async () => {
  const h = runtime()
  delete h.client.cache.car.powertrain
  h.queue.push(
    reply('hyundai', {
      json: {
        enrolledVehicleDetails: [
          {
            vehicleDetails: {
              vin: 'DIFFERENTVIN00001',
              regid: 'different-id',
              modelCode: 'Tucson',
              modelYear: '2022',
              evStatus: 'E',
            },
          },
        ],
      },
    }),
  )
  await assert.rejects(h.start(), /Unable to confirm climate vehicle details/)
  assert.equal(h.calls.length, 1)
  assert.equal(h.saves, 0)
})

test('Hyundai generation 2 EV omits unsupported duration and seats', async () => {
  const h = runtime('hyundai', { powertrain: 'ev', generation: 2 })
  await h.start()
  assert.equal(h.calls[0].headers.gen, '2')
  assert.equal(Object.hasOwn(h.calls[0].body, 'igniOnDuration'), false)
  assert.equal(Object.hasOwn(h.calls[0].body, 'seatHeaterVentInfo'), false)
})

test('Hyundai older-cache migration accepts numeric and string representations of the same ID', async () => {
  const h = runtime()
  delete h.client.cache.car.powertrain
  h.client.cache.car.id = '12345'
  h.queue.push(
    reply('hyundai', {
      json: {
        enrolledVehicleDetails: [
          {
            vehicleDetails: {
              vin: h.client.cache.car.vin,
              regid: 12345,
              modelCode: 'Tucson',
              modelYear: '2022',
              evStatus: 'N',
            },
          },
        ],
      },
    }),
  )
  await h.start()
  assert.equal(h.client.cache.car.id, 12345)
  assert.match(h.calls[1].url, /rcs\/rsc\/start$/)
})

for (const manufacturer of ['hyundai', 'kia']) {
  test(`${manufacturer} honors request units after settings change and for custom presets`, async () => {
    for (const [defaultUnit, requestUnit, temp, expected] of [
      ['C', 'C', 22, 72],
      ['F', 'F', 72, 72],
      ['C', 'F', 72, 72],
      ['F', 'C', 22, 72],
      ['F', undefined, 74, 74],
      ['C', undefined, 20, 68],
    ]) {
      const h = runtime(manufacturer, { tempType: defaultUnit })
      await h.start({ tempType: requestUnit, temp })
      const climate = manufacturer === 'kia' ? h.calls[0].body.remoteClimate : h.calls[0].body
      assert.equal(Number(climate.airTemp.value), expected)
      assert.equal(climate.airTemp.unit, 1)
    }
  })

  test(`${manufacturer} never retries outages, auth errors, or ambiguous successes`, async () => {
    for (const statusCode of [200, 401, 403, 429, 500, 503]) {
      const h = runtime(manufacturer, { powertrain: 'ev' })
      h.queue.push(reply(manufacturer, { statusCode, headers: {} }))
      await assert.rejects(h.start())
      assert.equal(h.calls.length, 1, `status ${statusCode} must not resend a remote command`)
    }
    const h = runtime(manufacturer)
    h.queue.push(new Error('Connection lost after sending request'))
    await assert.rejects(h.start(), /Connection lost/)
    assert.equal(h.calls.length, 1)
  })

  test(`${manufacturer} does not retry a payload error carrying a transaction ID`, async () => {
    const h = runtime(manufacturer)
    h.queue.push(reply(manufacturer, { statusCode: 400 }))
    await assert.rejects(h.start())
    assert.equal(h.calls.length, 1)
  })

  test(`${manufacturer} confirmed command stays successful if its status refresh fails`, async () => {
    const h = runtime(manufacturer)
    const cached = h.client.cache.status
    h.client.getCarStatus = async (id, force) => {
      assert.equal(id, h.client.cache.car.id)
      assert.equal(force, false)
      throw Error('Follow-up status unavailable')
    }
    h.queue.push(
      reply(manufacturer, {
        json:
          manufacturer === 'kia'
            ? { status: { statusCode: 0 }, payload: { remoteStatus: 0, evStatus: 0 } }
            : { status: 'SUCCESS' },
      }),
    )
    const result = await (manufacturer === 'kia'
      ? h.realPoll(h.client.cache.car.id, 'command-id')
      : h.realPoll({}, 'command-id'))
    assert.equal(result.isSuccess, true)
    assert.equal(result.data, cached)
    assert.equal(h.calls.length, 1)
    assert.equal(h.saves, 0)
    assert.ok(h.logs.some((message) => String(message).includes('follow-up status refresh failed')))
  })

  test(`${manufacturer} confirmed command stores a successful status refresh`, async () => {
    const h = runtime(manufacturer)
    const updated = { ...h.client.cache.status, climate: true }
    h.client.getCarStatus = async () => updated
    h.queue.push(
      reply(manufacturer, {
        json:
          manufacturer === 'kia' ? { status: { statusCode: 0 }, payload: { remoteStatus: 0 } } : { status: 'SUCCESS' },
      }),
    )
    const result = await (manufacturer === 'kia'
      ? h.realPoll(h.client.cache.car.id, 'command-id')
      : h.realPoll({}, 'command-id'))
    assert.equal(result.isSuccess, true)
    assert.equal(result.data, updated)
    assert.equal(h.saves, 1)
  })

  test(`${manufacturer} does not swallow a revoked session during command refresh`, async () => {
    for (const refreshThrows of [true, false]) {
      const h = runtime(manufacturer)
      h.client.getCarStatus = async () => {
        h.revoke()
        if (refreshThrows) throw Error('Follow-up status unavailable')
        return { ...h.client.cache.status, climate: true }
      }
      h.queue.push(
        reply(manufacturer, {
          json:
            manufacturer === 'kia'
              ? { status: { statusCode: 0 }, payload: { remoteStatus: 0 } }
              : { status: 'SUCCESS' },
        }),
      )
      await assert.rejects(
        manufacturer === 'kia' ? h.realPoll(h.client.cache.car.id, 'command-id') : h.realPoll({}, 'command-id'),
        /saved session was reset/,
      )
      assert.equal(h.saves, 0)
      assert.equal(h.client.cache.status.climate, false)
    }
  })
}

test('standard presets carry their current temperature unit to an already initialized client', () => {
  const h = runtime()
  const { buildStandardClimateRequest } = h.load('src/config.ts')
  const preset = buildStandardClimateRequest({ ...h.client.config, tempType: 'F', climateTempWarm: 74 }, 'warm')
  assert.equal(preset.tempType, 'F')
  assert.equal(preset.temp, 74)
})

test('Hyundai explicitly rejected optional fields retry once without losing ICE duration', async () => {
  for (const statusCode of [400, 422]) {
    for (const powertrain of ['ice', 'ev']) {
      const h = runtime('hyundai', { powertrain })
      h.queue.push(reply('hyundai', { statusCode, headers: {} }))
      await h.start()
      assert.equal(h.calls.length, 2)
      assert.ok(h.calls[0].body.seatHeaterVentInfo)
      assert.equal(Object.hasOwn(h.calls[1].body, 'seatHeaterVentInfo'), false)
      assert.equal(h.calls[1].body.igniOnDuration, powertrain === 'ice' ? 10 : undefined)
      assert.equal(h.calls[1].body.airTemp.value, powertrain === 'ice' ? 72 : '72')
    }
  }
})

test('Hyundai does not retry a rejected ICE payload with no optional seats requested', async () => {
  const h = runtime()
  h.queue.push(reply('hyundai', { statusCode: 422, headers: {} }))
  await assert.rejects(h.start({ seatClimateOption: undefined }))
  assert.equal(h.calls.length, 1)
})

test('Hyundai rejects error bodies inside HTTP 200 rather than reporting success', async () => {
  for (const json of [
    { errorCode: '4001' },
    { error: { message: 'rejected' } },
    JSON.stringify({ errorCode: '4001' }),
    'invalid JSON',
  ]) {
    const h = runtime()
    h.queue.push(reply('hyundai', { json }))
    await assert.rejects(h.start(), /Failed to send climateOn/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.polls.length, 0)
  }
})

test('Hyundai accepts alternate transaction headers and empty success bodies', async () => {
  for (const header of ['tmsTid', 'TMSTID', 'transactionId', 'TRANSACTIONID', 'Xid', 'xid']) {
    const h = runtime()
    h.queue.push(reply('hyundai', { headers: { [header]: 'alternate-id' }, json: '' }))
    await h.start()
    assert.equal(h.polls[0][1], 'alternate-id')
  }
})

test('Hyundai accepted start/stop without confirmation asks user to check rather than resending', async () => {
  for (const action of ['start', 'stop']) {
    const h = runtime()
    h.queue.push(reply('hyundai', { headers: {} }))
    await assert.rejects(h[action](), /request sent, but confirmation is unavailable/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.polls.length, 0)
  }
})

test('Hyundai plain-text unauthorized climate responses preserve bounded authentication refresh', () => {
  const h = runtime()
  for (const statusCode of [401, 403]) {
    assert.deepEqual(plain(h.client.climateResponseValid({ statusCode }, 'Session expired')), {
      valid: false,
      retry: true,
    })
  }
})

test('Kia start/stop uses remote climate routes and bounds petrol duration', async () => {
  for (const powertrain of ['ice', 'hev', 'phev', 'ev']) {
    const h = runtime('kia', { powertrain })
    await h.start()
    await h.stop()
    assert.equal(h.calls[0].url, h.client.apiDomain + 'rems/start')
    assert.equal(h.calls[1].url, h.client.apiDomain + 'rems/stop')
    const climate = h.calls[0].body.remoteClimate
    assert.equal(climate.ignitionOnDuration.value, ['ice', 'hev'].includes(powertrain) ? 10 : 15)
    assert.equal(climate.airTemp.value, '72')
    assert.deepEqual(plain(climate.heatVentSeat.driverSeat), { heatVentType: 1, heatVentLevel: 4, heatVentStep: 1 })
  }
})

test('Kia retries optional seats only once after an explicit payload rejection', async () => {
  for (const statusCode of [400, 422]) {
    const h = runtime('kia')
    h.queue.push(reply('kia', { statusCode, headers: {} }))
    await h.start()
    assert.equal(h.calls.length, 2)
    assert.ok(h.calls[0].body.remoteClimate.heatVentSeat)
    assert.equal(Object.hasOwn(h.calls[1].body.remoteClimate, 'heatVentSeat'), false)
    assert.deepEqual(plain(h.calls[1].body.remoteClimate.ignitionOnDuration), { unit: 4, value: 10 })
  }
  const h = runtime('kia')
  h.queue.push(reply('kia', { statusCode: 400, headers: {} }), reply('kia', { statusCode: 400, headers: {} }))
  await assert.rejects(h.start())
  assert.equal(h.calls.length, 2)
})

test('Kia HTTP 200 invalid-session and command errors do not trigger optional-seat retries', async () => {
  for (const errorCode of [1003, 1005, 2000]) {
    const h = runtime('kia')
    h.queue.push(reply('kia', { headers: {}, json: { status: { statusCode: 1, errorType: 1, errorCode } } }))
    await assert.rejects(h.start())
    assert.equal(h.calls.length, 1)
    assert.equal(h.polls.length, 0)
  }
})

test('Kia accepted start/stop without a transaction ID asks user to check without resending', async () => {
  for (const action of ['start', 'stop']) {
    const h = runtime('kia')
    h.queue.push(reply('kia', { headers: {} }))
    await assert.rejects(h[action](), /request sent, but confirmation is unavailable/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.polls.length, 0)
  }
})

test('US climate normalizers reject nonfinite inputs and bound engine duration', () => {
  const h = runtime()
  const { climateFahrenheit, remoteEngineDuration } = h.load('src/lib/us-climate.ts')
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => climateFahrenheit(input({ temp: value }), 'C'), /Invalid climate temperature/)
    assert.throws(() => remoteEngineDuration(value), /Invalid climate duration/)
  }
  assert.equal(remoteEngineDuration(0), 1)
  assert.equal(remoteEngineDuration(7.6), 8)
  assert.equal(remoteEngineDuration(15), 10)
})

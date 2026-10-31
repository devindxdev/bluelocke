import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './auth-harness.mjs'

const regions = [
  ['canada', 'BluelinkCanada'],
  ['usa', 'BluelinkUSA'],
  ['usa-kia', 'BluelinkUSAKia'],
  ['europe', 'BluelinkEurope'],
  ['india', 'BluelinkIndia'],
  ['australia', 'BluelinkAustralia'],
]
const vehicle = (id) => ({
  vehicleId: id,
  vehicleKey: id,
  regid: id,
  vin: `VIN-${id}`,
  nickName: id,
  nickname: id,
  modelName: 'Tucson',
  modelCode: 'Tucson',
  vehicleName: 'Tucson',
  modelYear: '2022',
  year: '2022',
  vehicleGeneration: '2',
  evStatus: 'N',
  detailInfo: { outColor: 'white', saleCarmdlCd: 'Preferred' },
})
for (const [region, className] of regions) {
  for (const remembered of [false, true]) {
    test(`${region}: photo metadata preserves ${remembered ? 'the cached vehicle' : 'the original first-vehicle choice'}`, async () => {
      const h = runtime()
      const manufacturer = region === 'usa-kia' ? 'kia' : 'hyundai'
      const Regional = h.load(`src/lib/bluelink-regions/${region}.ts`)[className]
      const client = new Regional({ ...h.account, manufacturer })
      const cars = [vehicle('first'), vehicle('second')]
      if (remembered) client.cache = { car: { id: 'second', vin: 'VIN-second' } }
      const requests = []
      client.request = async (props) => {
        requests.push(props)
        return {
          resp: { statusCode: 200, headers: {} },
          json: {
            responseHeader: { responseCode: 0 },
            result: { vehicles: cars },
            enrolledVehicleDetails: cars.map((vehicleDetails) => ({ vehicleDetails })),
            status: { statusCode: 0 },
            payload: { vehicleSummary: cars },
            resCode: '0000',
            resMsg: { vehicles: cars },
          },
        }
      }
      const car = await client.getCar()
      assert.equal(car.id, remembered ? 'second' : 'first')
      assert.equal(car.vin, remembered ? 'VIN-second' : 'VIN-first')
      assert.ok(Object.hasOwn(car, 'photoUrl'))
      if (region === 'canada') {
        assert.equal(requests.length, 2, 'Canada keeps its original vehicle registration request')
        assert.equal(JSON.parse(requests[1].data).vehicleId, car.id)
      } else assert.equal(requests.length, 1)
    })
  }
}

const responseFor = (cars) => ({
  resp: { statusCode: 200, headers: {} },
  json: {
    responseHeader: { responseCode: 0 },
    result: { vehicles: cars },
    enrolledVehicleDetails: cars.map((vehicleDetails) => ({ vehicleDetails })),
    status: { statusCode: 0 },
    payload: { vehicleSummary: cars },
    resCode: '0000',
    resMsg: { vehicles: cars },
  },
})
const cachedStatus = () => ({
  lastStatusCheck: Date.now(), lastRemoteStatusCheck: Date.now(),
  isCharging: true, isPluggedIn: true, chargingPower: 8,
  remainingChargeTimeMins: 30, range: 300, locked: true,
  climate: true, soc: 80, fuelLevel: 50, twelveSoc: 90, odometer: 12000,
  location: { latitude: '49', longitude: '-123' },
  chargeLimit: { acPercent: 80, dcPercent: 100 },
})
const makeClient = (region, className, selectedVin = 'VIN-second') => {
  const h = runtime()
  const Regional = h.load(`src/lib/bluelink-regions/${region}.ts`)[className]
  const account = { ...h.account, selectedVin, manufacturer: region === 'usa-kia' ? 'kia' : 'hyundai',
    auth: { ...h.account.auth, region: region === 'usa-kia' ? 'usa' : region } }
  const bl = new Regional(account)
  const cars = [vehicle('first'), { ...vehicle('second'), vehicleGeneration: '3', ccuCCS2ProtocolSupport: 1 }]
  const requests = []
  bl.request = async (props) => { requests.push(props); return responseFor(cars) }
  bl.cache = {
    token: { accessToken: 'existing-account-token', authId: region === 'usa-kia' ? 'first' : 'existing-device', expiry: Date.now() / 1000 + 3600 },
    car: { id: 'first', vin: 'VIN-first', modelName: 'Tucson' },
    status: cachedStatus(),
  }
  return { h, bl, Regional, requests, cars, account }
}

for (const [region, className] of regions) {
  test(`${region}: lists every vehicle without changing the active vehicle`, async () => {
    const { bl, requests } = makeClient(region, className)
    const previous = JSON.stringify(bl.cache)
    const cars = await bl.getVehicles()
    assert.deepEqual(Array.from(cars, (car) => car.vin), ['VIN-first', 'VIN-second'])
    assert.equal(JSON.stringify(bl.cache), previous)
    assert.equal(requests.length, 1, 'listing must not select a vehicle on the server')
  })

  test(`${region}: explicit VIN wins over the cached car and binds regional request context`, async () => {
    const { bl, requests } = makeClient(region, className)
    const car = await bl.getCar()
    assert.equal(car.id, 'second')
    if (region === 'canada') assert.equal(JSON.parse(requests.at(-1).data).vehicleId, 'second')
    if (region === 'usa') {
      assert.equal(bl.carId, 'second')
      assert.equal(bl.carGeneration, 3)
    }
    if (region === 'usa-kia') assert.equal(bl.tokens.authId, 'second')
    if (['europe', 'india', 'australia'].includes(region)) assert.equal(bl.europeccs2, 1)
  })

  test(`${region}: an unavailable selected VIN never falls back to another car`, async () => {
    const { bl, requests } = makeClient(region, className, 'VIN-removed')
    await assert.rejects(bl.getStatus(true, true), /selected vehicle is no longer available/)
    assert.equal(requests.length, 1)
    assert.equal(bl.cache.car.id, 'first')
  })

  test(`${region}: switching reuses the login, clears other-car status, and targets commands correctly`, async () => {
    const { h, bl } = makeClient(region, className)
    bl.login = async () => { throw Error('Switching must reuse the account login') }
    bl.getCarStatus = async (id, forced) => {
      assert.equal(id, 'second')
      assert.equal(forced, false)
      assert.equal(bl.cache.car.vin, 'VIN-second')
      assert.equal(bl.cache.status.soc, 0)
      assert.equal(bl.cache.status.fuelLevel, undefined)
      assert.equal(bl.cache.status.location, undefined)
      assert.equal(bl.cache.status.chargeLimit, undefined)
      return { ...bl.cache.status, soc: 55, range: 235, lastStatusCheck: Date.now() }
    }
    await bl.ensureSelectedVehicle()
    assert.equal(bl.cache.car.id, 'second')
    assert.equal(bl.cache.status.soc, 55)
    assert.equal(bl.cache.token.accessToken, 'existing-account-token')
    if (region === 'usa-kia') assert.equal(bl.cache.token.authId, 'second')
    const stored = JSON.parse(h.keys.get('egmp-scriptable-bl-cache-Bluelocke'))
    assert.equal(stored.car.vin, 'VIN-second')
    assert.equal(stored.status.location, undefined)
    bl.lock = async (id) => {
      assert.equal(id, 'second')
      return { isSuccess: true, data: bl.cache.status }
    }
    await bl.processRequest('lock', undefined, () => {})
  })

  test(`${region}: failed switching retains the last complete cache and rejects initialization`, async () => {
    const { h, bl } = makeClient(region, className)
    const previous = JSON.stringify(bl.cache)
    bl.getCarStatus = async () => {
      bl.saveCache() // simulate a token refresh saving temporary state
      throw Error('Status unavailable')
    }
    await assert.rejects(bl.ensureSelectedVehicle(), /Status unavailable/)
    assert.equal(JSON.stringify(bl.cache), previous)
    assert.equal(h.keys.get('egmp-scriptable-bl-cache-Bluelocke'), previous)
  })

  test(`${region}: the regional factory resolves selection before returning a client`, async () => {
    const { h, bl, Regional, account } = makeClient(region, className)
    Regional.init = async () => bl
    bl.getCarStatus = async () => ({ ...cachedStatus(), soc: 55 })
    const factory = h.load('src/lib/bluelink.ts')
    const ready = await factory.initRegionalBluelink(account, true)
    assert.equal(ready.getCachedStatus().car.vin, 'VIN-second')
  })
}

test('Kia selection recovery can refresh after a cached vehicle is removed, without rebinding its saved commands', async () => {
  const { bl } = makeClient('usa-kia', 'BluelinkUSAKia', 'VIN-removed')
  bl.cache.car = { ...bl.cache.car, id: 'removed', vin: 'VIN-removed' }
  bl.cache.token = { ...bl.cache.token, authId: 'removed', expiry: 0 }
  bl.login = async () => {
    const car = await bl.getCar(true)
    return { accessToken: 'new-account-token', authId: car.id, expiry: Date.now() / 1000 + 3600 }
  }
  const choices = await bl.getVehiclesForSelection()
  assert.equal(choices.length, 2)
  assert.equal(bl.cache.car.id, 'removed')
  assert.equal(bl.cache.token.authId, 'removed')
  assert.equal(bl.tokens.authId, 'removed')
  assert.equal(bl.cache.token.accessToken, 'new-account-token')
  await assert.rejects(bl.getCar(), /selected vehicle is no longer available/)
})

test('Canada consumes the supplied single-vehicle status shape for the selected second car', async () => {
  const { h, bl, cars } = makeClient('canada', 'BluelinkCanada')
  delete bl.request
  h.transport = async (request) => {
    if (request.url.endsWith('/vhcllst')) return responseFor(cars).json
    assert.ok(request.url.endsWith('/sltvhcl'))
    assert.equal(request.headers.Vehicleid, 'second')
    assert.equal(JSON.parse(request.body).vehicleId, 'second')
    return {
      responseHeader: { responseDesc: 'Success', responseCode: 0 },
      result: {
        vehicle: { vehicleId: 'second', vin: 'VIN-second', defaultVehicle: false, odometer: 58425.9 },
        status: { doorLock: true, lastStatusDate: '20261031133231', battery: { batSoc: 80 },
          evStatus: { batteryStatus: 55, batteryCharge: false, batteryPlugin: 0,
            remainTime2: { atc: { value: 0, unit: 1 } },
            drvDistance: [{ rangeByFuel: { totalAvailableRange: { value: 235, unit: 1 }, evModeRange: { value: 235, unit: 1 } } }] } },
      },
    }
  }
  await bl.ensureSelectedVehicle()
  assert.equal(bl.cache.car.id, 'second')
  assert.equal(bl.cache.status.soc, 55)
  assert.equal(bl.cache.status.range, 235)
  assert.equal(bl.cache.status.twelveSoc, 80)
  assert.equal(bl.cache.status.odometer, 58425.9)
  assert.equal(bl.cache.status.location, undefined)
})

test('Canada rejects a status response whose vehicle identity differs from the requested car', async () => {
  const { bl } = makeClient('canada', 'BluelinkCanada')
  bl.request = async () => ({ resp: { statusCode: 200 }, json: {
    responseHeader: { responseCode: 0 }, result: { vehicle: { vehicleId: 'wrong-car' }, status: {} },
  } })
  await assert.rejects(bl.getCarStatus('second', false), /different vehicle/)
})

test('a Kia switch that refreshes login and then fails keeps refreshed credentials bound to the old cached car', async () => {
  const { bl } = makeClient('usa-kia', 'BluelinkUSAKia')
  bl.cache.token.expiry = 0
  bl.login = async () => {
    const car = await bl.getCar(true)
    return { accessToken: 'refreshed-account-token', authId: car.id, expiry: Date.now() / 1000 + 3600 }
  }
  bl.getCarStatus = async () => { throw Error('Status unavailable') }
  await assert.rejects(bl.ensureSelectedVehicle(), /Status unavailable/)
  assert.equal(bl.cache.car.id, 'first')
  assert.equal(bl.cache.token.authId, 'first')
  assert.equal(bl.tokens.authId, 'first')
  assert.equal(bl.cache.token.accessToken, 'refreshed-account-token')
})

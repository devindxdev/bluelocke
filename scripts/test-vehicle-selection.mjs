import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const plain = (value) => JSON.parse(JSON.stringify(value))
const carA = { id: 'car-a', vin: '5NMS3CADXLH123456', nickName: 'Daily', modelName: 'Tucson', modelYear: '2022' }
const carB = { id: 'car-b', vin: '', nickName: 'Weekend', modelName: 'Santa Fe', modelYear: '2024' }
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function runtime({ name = 'Bluelocke', keys = new Map(), background = false } = {}) {
  const h = { keys, choices: [], pickers: [], timers: [], logs: [], failKey: undefined }
  const context = vm.createContext({
    Script: { name: () => name },
    config: { runsInWidget: background, runsWithSiri: false },
    Keychain: {
      contains: (key) => keys.has(key),
      get: (key) => keys.get(key),
      remove: (key) => keys.delete(key),
      set: (key, value) => {
        if (h.failKey === key) throw Error('Storage failed')
        keys.set(key, value)
      },
    },
    Timer: {
      schedule: (_ms, _repeat, callback) => {
        const timer = {
          callback,
          invalidate() {
            this.invalid = true
          },
        }
        h.timers.push(timer)
        return timer
      },
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
      if (dependency.endsWith('/logger'))
        return {
          Logger: class {
            log(text) {
              h.logs.push(text)
            }
          },
        }
      if (dependency.endsWith('/scriptable-utils'))
        return {
          quickOptions: async (choices, opts) => {
            h.pickers.push({ choices, opts })
            return h.choices.shift() ?? null
          },
        }
      const resolved = dependency.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), dependency + '.ts'))
        : 'src/' + dependency + '.ts'
      if (
        [
          'src/config.ts',
          'src/lib/vehicle-selection.ts',
          'src/lib/vehicle-photo.ts',
          'src/lib/bluelink-regions/base.ts',
        ].includes(resolved) ||
        /^src\/lib\/bluelink-regions\/(canada|usa|usa-kia|india|europe|australia)\.ts$/.test(resolved)
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
  h.selection = load('src/lib/vehicle-selection.ts')
  h.base = load('src/lib/bluelink-regions/base.ts')
  h.saveAccount = (overrides = {}) => {
    h.settings.setConfig({
      ...h.settings.getConfig(),
      auth: { username: 'driver@example.test', password: 'secret', pin: '1234', region: 'canada' },
      ...overrides,
    })
  }
  h.client = (cars = [carA, carB]) => {
    const bl = new h.base.Bluelink(h.settings.getConfig())
    bl.cars = plain(cars)
    bl.activations = []
    bl.reads = []
    bl.commands = []
    bl.login = async () => ({ accessToken: 'token', expiry: Math.floor(Date.now() / 1000) + 3600 })
    bl.getCars = async () => bl.cars
    bl.activateCar = async (car) => {
      bl.activations.push(car.id)
    }
    bl.getCarStatus = async (id) => {
      bl.reads.push({ id, previous: plain(bl.cache.status) })
      if (bl.failStatus) throw Error('Status unavailable')
      if (bl.statusWait) await bl.statusWait.promise
      return {
        ...bl.cache.status,
        lastStatusCheck: Date.now(),
        range: id === carA.id ? 415 : 275,
        twelveSoc: id === carA.id ? 96 : 72,
      }
    }
    bl.lock = async (id) => {
      bl.commands.push(id)
      return { isSuccess: true, data: bl.cache.status }
    }
    bl.initialize = () => bl.superInit(bl.config, false)
    return bl
  }
  return h
}

test('first login chooses once and pins an API ID when VIN is absent', async () => {
  const h = runtime()
  h.saveAccount()
  h.choices.push(carB.id)
  const bl = h.client()
  await bl.initialize()
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  assert.equal(h.settings.getConfig().selectedVehicle.id, carB.id)
  assert.equal(h.settings.getConfig().selectedVehicle.vin, undefined)
  assert.match(h.pickers[0].choices[1].label, /2024 Santa Fe.*Weekend.*ID/)
  const second = h.client([carB, carA])
  await second.initialize()
  assert.equal(second.getCachedStatus().car.id, carB.id)
  await second.getStatus(true, true)
  assert.equal(second.getCachedStatus().car.id, carB.id)
  assert.equal(h.pickers.length, 1)
})

test('a single vehicle is automatic in the app, but widgets must be set up in the app first', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client([carB])
  await bl.initialize()
  assert.equal(h.pickers.length, 0)
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  const bg = runtime({ background: true })
  bg.saveAccount()
  await assert.rejects(bg.client([carB]).initialize(), (error) => error.reason === 'required')
  assert.equal(bg.pickers.length, 0)
})

test('cancelling the picker does not save a vehicle or status', async () => {
  const h = runtime()
  h.saveAccount()
  await assert.rejects(h.client().initialize(), (error) => error.reason === 'cancelled')
  assert.equal(h.settings.getConfig().selectedVehicle, undefined)
  assert.equal([...h.keys.keys()].filter((key) => key.includes('vehicle-cache')).length, 0)
})

test('a missing selected vehicle never falls back to the first available vehicle', async () => {
  const h = runtime()
  h.saveAccount()
  h.choices.push(carB.id)
  const bl = h.client()
  await bl.initialize()
  bl.cars = [carA]
  await assert.rejects(bl.getStatus(true, true), (error) => error.reason === 'missing')
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  assert.equal(h.settings.getConfig().selectedVehicle.id, carB.id)
  assert.equal(bl.reads.length, 1)
})

test('a full VIN keeps the choice when the API vehicle ID changes', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client([carA])
  await bl.initialize()
  bl.cars = [{ ...carA, id: 'new-id' }, carB]
  await bl.getStatus(true, true)
  assert.equal(bl.getCachedStatus().car.id, 'new-id')
  assert.equal(h.settings.getConfig().selectedVehicle.id, 'new-id')
})

test('masked VINs use the API ID and a conflicting full VIN never matches a reused ID', () => {
  const h = runtime()
  h.saveAccount()
  const selection = h.selection.selectedVehicle({ ...carA, vin: '*************3456' }, h.settings.getConfig())
  assert.equal(selection.vin, undefined)
  assert.ok(h.selection.matchesVehicle(selection, { ...carA, vin: '' }))
  assert.ok(
    !h.selection.matchesVehicle(h.selection.selectedVehicle(carA, h.settings.getConfig()), {
      ...carA,
      vin: '5NMS3CADXLH999999',
    }),
  )
})

test('duplicate picker labels are disambiguated by complete IDs', () => {
  const h = runtime()
  const choices = h.selection.vehicleChoices([
    { ...carB, id: 'first-123456' },
    { ...carB, id: 'second-123456' },
  ])
  assert.notEqual(choices[0].label, choices[1].label)
})

test('a copied script selects independently and exact script names keep their own config and cache', async () => {
  const keys = new Map()
  const first = runtime({ name: 'My Car', keys })
  first.saveAccount()
  first.choices.push(carA.id)
  const a = first.client()
  await a.initialize()
  const copy = runtime({ name: 'MyCar', keys })
  copy.saveAccount()
  assert.equal(copy.settings.getConfig().selectedVehicle, undefined)
  copy.choices.push(carB.id)
  const b = copy.client()
  await b.initialize()
  assert.notEqual(a.getCacheKey(), b.getCacheKey())
  assert.equal(a.getCachedStatus().car.id, carA.id)
  assert.equal(b.getCachedStatus().car.id, carB.id)
  assert.notEqual(
    first.selection.scriptStorageKey('widget-refresh', first.selection.vehicleStorageScope(a.getConfig())),
    copy.selection.scriptStorageKey('widget-refresh', copy.selection.vehicleStorageScope(b.getConfig())),
  )
})

test('legacy config imports preferences and account, but ignores its selection and old shared status', async () => {
  const h = runtime()
  h.saveAccount()
  const old = h.settings.getConfig()
  h.keys.clear()
  h.keys.set('egmp-bluelink-config', JSON.stringify({ ...old, distanceUnit: 'mi', selectedVehicle: { id: carA.id } }))
  h.keys.set('egmp-bluelink-cache', JSON.stringify({ car: carA, status: { range: 999 } }))
  assert.equal(h.settings.getConfig().distanceUnit, 'mi')
  assert.equal(h.settings.getConfig().selectedVehicle, undefined)
  h.choices.push(carB.id)
  const bl = h.client()
  await bl.initialize()
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  assert.equal(bl.getCachedStatus().status.range, 275)
  h.settings.deleteConfig()
  assert.equal(h.settings.configExists(), false)
  assert.equal(h.settings.getConfig().auth.username, '')
})

test('switching replaces the status fallback, resets name/type, and sends subsequent commands to the new car', async () => {
  const h = runtime()
  h.saveAccount({ displayNameOverride: 'Daily driver', vehicleTypeOverride: 'ev' })
  h.choices.push(carA.id)
  const bl = h.client()
  await bl.initialize()
  await bl.changeVehicleForScript(carB.id)
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  assert.equal(bl.reads.at(-1).previous.range, 0)
  assert.equal(bl.reads.at(-1).previous.twelveSoc, 0)
  assert.equal(bl.getCachedStatus().status.range, 275)
  assert.equal(h.settings.getConfig().displayNameOverride, '')
  assert.equal(h.settings.getConfig().vehicleTypeOverride, 'auto')
  await bl.processRequest('lock', undefined, () => {})
  assert.deepEqual(bl.commands, [carB.id])
  await h.timers.at(-1).callback()
})

for (const failure of ['status', 'cache', 'config'])
  test(`failed ${failure} write/read keeps the previous vehicle and status`, async () => {
    const h = runtime()
    h.saveAccount()
    h.choices.push(carA.id)
    const bl = h.client()
    await bl.initialize()
    const previous = plain(bl.getCachedStatus())
    if (failure === 'status') bl.failStatus = true
    else
      h.failKey =
        failure === 'config'
          ? h.selection.scriptStorageKey('config')
          : h.selection.scriptStorageKey(
              'vehicle-cache',
              h.selection.vehicleStorageScope({
                ...bl.config,
                selectedVehicle: h.selection.selectedVehicle(carB, bl.config),
              }),
            )
    await assert.rejects(bl.changeVehicleForScript(carB.id), /Status unavailable|Storage failed/)
    assert.deepEqual(plain(bl.getCachedStatus()), previous)
    assert.equal(h.settings.getConfig().selectedVehicle.id, carA.id)
    assert.equal(bl.activations.at(-1), carA.id)
  })

test('switching is blocked until an existing status request or command callback finishes', async () => {
  const h = runtime()
  h.saveAccount()
  h.choices.push(carA.id)
  const bl = h.client()
  await bl.initialize()
  bl.statusWait = deferred()
  const status = bl.getStatus(false, true)
  await assert.rejects(bl.changeVehicleForScript(carB.id), /current request/)
  bl.statusWait.resolve()
  await status
  await bl.processRequest('lock', undefined, () => {})
  await assert.rejects(bl.changeVehicleForScript(carB.id), /current request/)
  await h.timers.at(-1).callback()
  await bl.changeVehicleForScript(carB.id)
  assert.equal(bl.getCachedStatus().car.id, carB.id)
})

test('commands and reads from a stale client stop after another instance changes the selected vehicle', async () => {
  const h = runtime()
  h.saveAccount()
  h.choices.push(carA.id)
  const old = h.client()
  await old.initialize()
  const latest = h.client()
  await latest.initialize()
  await latest.changeVehicleForScript(carB.id)
  await assert.rejects(
    old.processRequest('lock', undefined, () => {}),
    (error) => error.reason === 'changed',
  )
  await assert.rejects(old.getStatus(false, true), (error) => error.reason === 'changed')
  assert.deepEqual(old.commands, [])
})

test('an account change cannot reuse a previous account selection even with the same vehicle ID', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client([carA])
  await bl.initialize()
  h.settings.setConfig({
    ...h.settings.getConfig(),
    auth: { ...h.settings.getConfig().auth, username: 'other@example.test' },
  })
  await assert.rejects(
    bl.processRequest('lock', undefined, () => {}),
    (error) => error.reason === 'changed',
  )
  const next = h.client()
  h.choices.push(carB.id)
  await next.initialize()
  assert.equal(next.getCachedStatus().car.id, carB.id)
})

for (const [region, className, payload, idField] of [
  ['canada', 'BluelinkCanada', (vehicles) => ({ result: { vehicles } }), 'vehicleId'],
  [
    'usa',
    'BluelinkUSA',
    (vehicles) => ({ enrolledVehicleDetails: vehicles.map((vehicleDetails) => ({ vehicleDetails })) }),
    'regid',
  ],
  ['usa-kia', 'BluelinkUSAKia', (vehicles) => ({ payload: { vehicleSummary: vehicles } }), 'vehicleKey'],
  ['europe', 'BluelinkEurope', (vehicles) => ({ resMsg: { vehicles } }), 'vehicleId'],
  ['india', 'BluelinkIndia', (vehicles) => ({ resMsg: { vehicles } }), 'vehicleId'],
  ['australia', 'BluelinkAustralia', (vehicles) => ({ resMsg: { vehicles } }), 'vehicleId'],
])
  test(`${region}: lists every vehicle with a usable ID even when VIN/detailInfo is absent`, async () => {
    const h = runtime()
    h.saveAccount()
    const Regional = h.load(`src/lib/bluelink-regions/${region}.ts`)[className]
    const bl = Object.create(Regional.prototype)
    bl.config = h.settings.getConfig()
    bl.apiConfig = {}
    bl.apiDomain = 'https://example.test/'
    bl.getStamp = () => 'stamp'
    bl.getDateString = () => 'date'
    bl.requestResponseValid = () => ({ valid: true })
    let activated = false
    bl.setCar = async () => {
      activated = true
    }
    bl.request = async () => ({
      resp: {},
      json: payload([
        {
          [idField]: 'a',
          vin: carA.vin,
          modelName: 'Tucson',
          modelYear: 2022,
          photoURL: 'https://images.example.test/car.png',
        },
        { [idField]: 42, modelName: 'Santa Fe', modelYear: 2024 },
        { modelName: 'Invalid missing ID' },
      ]),
    })
    const cars = await bl.getCars()
    assert.deepEqual(plain(cars.map((car) => car.id)), ['a', '42'])
    assert.equal(cars[0].photoUrl, 'https://images.example.test/car.png')
    assert.equal(cars[1].photoUrl, null)
    assert.equal(cars[1].vin, '')
    assert.equal(activated, false)
    if (region === 'usa-kia') {
      bl.tokens = { accessToken: 'token' }
      bl.cache = { token: { accessToken: 'token' } }
      await bl.activateCar(cars[1])
      assert.equal(bl.tokens.authId, '42')
      assert.equal(bl.cache.token.authId, '42')
    }
  })

test('a configured widget loads only its pinned vehicle cache without prompting', async () => {
  const keys = new Map()
  const app = runtime({ keys })
  app.saveAccount()
  app.choices.push(carB.id)
  await app.client().initialize()
  const bg = runtime({ keys, background: true })
  const bl = bg.client([carA, carB])
  await bl.initialize()
  assert.equal(bl.getCachedStatus().car.id, carB.id)
  assert.equal(bg.pickers.length, 0)
  assert.equal(bl.reads.length, 0)
})

test('Kia USA login pins the chosen vehicle before the first status payload and updates it on a switch', async () => {
  const h = runtime()
  h.saveAccount({ manufacturer: 'kia' })
  h.choices.push(carB.id)
  const Regional = h.load('src/lib/bluelink-regions/usa-kia.ts').BluelinkUSAKia
  const bl = h.client()
  delete bl.login
  delete bl.activateCar
  Object.setPrototypeOf(bl, Regional.prototype)
  bl.getAdditionalHeaders = () => ({ deviceId: 'device' })
  bl.getDateString = () => 'date'
  bl.requestResponseValid = () => ({ valid: true })
  bl.request = async () => ({ resp: { headers: { sid: 'new-token' } }, json: {} })
  const readTokens = []
  const status = bl.getCarStatus
  bl.getCarStatus = async (id) => {
    readTokens.push(bl.tokens.authId)
    return status(id)
  }
  await bl.initialize()
  assert.deepEqual(readTokens, [carB.id])
  assert.equal(h.pickers.length, 1)
  await bl.changeVehicleForScript(carA.id)
  assert.deepEqual(readTokens, [carB.id, carA.id])
  assert.equal(bl.cache.token.authId, carA.id)
})

test('a vehicle switch clears its old status cache', async () => {
  const h = runtime()
  h.saveAccount()
  h.choices.push(carA.id)
  const bl = h.client()
  await bl.initialize()
  const oldKey = bl.getCacheKey()
  await bl.changeVehicleForScript(carB.id)
  assert.equal(h.keys.has(oldKey), false)
})

test('older vehicle caches acquire the API photo from metadata without a remote status request', async () => {
  const h = runtime()
  h.saveAccount()
  const initial = h.client([carA])
  await initial.initialize()
  const cached = JSON.parse(h.keys.get(initial.getCacheKey()))
  assert.equal(Object.hasOwn(cached.car, 'photoUrl'), false)
  const next = h.client([{ ...carA, photoUrl: 'https://images.example.test/my-tucson.jpeg' }])
  await next.initialize()
  assert.equal(next.getCachedStatus().car.photoUrl, 'https://images.example.test/my-tucson.jpeg')
  assert.equal(next.reads.length, 0)
  assert.equal(JSON.parse(h.keys.get(next.getCacheKey())).car.photoUrl, next.getCachedStatus().car.photoUrl)
})

test('an unavailable photo metadata update keeps the existing vehicle status usable offline', async () => {
  const h = runtime()
  h.saveAccount()
  const initial = h.client([carA])
  await initial.initialize()
  const next = h.client()
  next.getCars = async () => {
    throw Error('Offline')
  }
  await next.initialize()
  assert.equal(next.getCachedStatus().car.id, carA.id)
  assert.equal(next.getCachedStatus().status.range, 415)
  assert.equal(next.reads.length, 0)
})

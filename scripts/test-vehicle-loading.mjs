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

function runtime({ name = 'Bluelocke', keys = new Map(), background = false, siri = false } = {}) {
  const h = { keys, choices: [], pickers: [], timers: [], logs: [], failKey: undefined }
  const context = vm.createContext({
    Script: { name: () => name },
    config: { runsInWidget: background, runsWithSiri: siri },
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
          'src/lib/storage.ts',
          'src/lib/secure-url.ts',
          'src/lib/update-security.ts',
          'src/lib/auth-session.ts',
          'src/lib/user-error.ts',
          'src/lib/log-sanitizer.ts',
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
    bl.reads = []
    bl.commands = []
    bl.logins = 0
    bl.login = async () => {
      bl.logins++
      return { accessToken: 'token', expiry: Math.floor(Date.now() / 1000) + 3600 }
    }
    bl.getCar = async () => bl.cars[0]
    bl.getCarStatus = async (id) => {
      bl.reads.push(id)
      return { lastStatusCheck: Date.now(), range: 415, twelveSoc: 96 }
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

for (const mode of ['app', 'widget', 'shortcut']) {
  test(`${mode}: a fresh login loads automatically without a saved selection or picker`, async () => {
    const h = runtime({ background: mode === 'widget', siri: mode === 'shortcut' })
    h.saveAccount()
    const bl = h.client()
    await bl.initialize()
    assert.equal(bl.getCachedStatus().car.id, carA.id)
    assert.equal(bl.getCachedStatus().status.twelveSoc, 96)
    assert.equal(bl.logins, 1)
    assert.equal(h.pickers.length, 0)
    assert.equal(h.settings.getConfig().selectedVehicle, undefined)
  })
}

test('v1.25 settings survive rollback, while retired selections and toggles are ignored', async () => {
  const h = runtime({ background: true })
  h.saveAccount({
    distanceUnit: 'mi',
    displayNameOverride: 'Daily',
    selectedVehicle: { id: 'removed-car', account: 'old' },
    multiCar: true,
  })
  const current = h.settings.getConfig()
  assert.equal(current.auth.username, 'driver@example.test')
  assert.equal(current.distanceUnit, 'mi')
  assert.equal(current.displayNameOverride, 'Daily')
  assert.equal(current.selectedVehicle, undefined)
  assert.equal(current.multiCar, undefined)
  await h.client().initialize()
  assert.equal(h.pickers.length, 0)
})

test('background loads reuse the established script cache without logging in or prompting', async () => {
  const keys = new Map()
  const app = runtime({ keys })
  app.saveAccount()
  await app.client().initialize()
  const h = runtime({ keys, background: true })
  const bl = h.client()
  await bl.initialize()
  assert.equal(bl.logins, 0)
  assert.equal(bl.reads.length, 0)
  assert.equal(bl.getCachedStatus().status.range, 415)
  assert.equal(h.pickers.length, 0)
})

test('commands and status refresh work without selection guards', async () => {
  const h = runtime()
  h.saveAccount()
  const bl = h.client()
  await bl.initialize()
  await bl.getStatus(true, true)
  const completions = []
  await bl.processRequest('lock', undefined, (...args) => completions.push(args))
  await h.timers.at(-1).callback()
  assert.deepEqual(bl.commands, [carA.id])
  assert.equal(completions[0][0], true)
  assert.equal(completions[0][1], true)
  assert.equal(h.pickers.length, 0)
})

test('a corrupt cache triggers login, and clearing it cannot fall back to a different shared account', async () => {
  const h = runtime()
  h.saveAccount()
  h.keys.set('egmp-scriptable-bl-cache-Bluelocke', '{broken')
  h.keys.set('egmp-bluelink-cache', JSON.stringify({ token: { accessToken: 'wrong-account' }, car: carB, status: {} }))
  const bl = h.client()
  await bl.initialize()
  assert.equal(bl.logins, 1)
  assert.equal(bl.getCachedStatus().car.id, carA.id)
  bl.deleteCache()
  const next = h.client()
  await next.initialize()
  assert.equal(next.logins, 1)
  assert.equal(next.getCachedStatus().car.id, carA.id)
})

test('legacy account preferences still migrate and resetting does not reimport old credentials', () => {
  const h = runtime()
  h.saveAccount({ distanceUnit: 'mi' })
  const current = h.settings.getConfig()
  h.keys.clear()
  h.keys.set('egmp-bluelink-config', JSON.stringify(current))
  assert.equal(h.settings.configExists(), true)
  assert.equal(h.settings.getConfig().distanceUnit, 'mi')
  h.settings.deleteConfig()
  assert.equal(h.settings.configExists(), false)
  assert.equal(h.settings.getConfig().auth.username, '')
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
]) {
  test(`${region}: restores automatic first-vehicle loading and retains the API photo fallback`, async () => {
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
    let activated
    bl.setCar = async (id) => {
      activated = id
    }
    bl.request = async () => ({
      resp: {},
      json: payload([
        {
          [idField]: 'first',
          vin: carA.vin,
          modelName: 'Tucson',
          modelYear: 2022,
          detailInfo: {},
          photoURL: 'https://images.example.test/car.png',
        },
        { [idField]: 'second', vin: '', detailInfo: {} },
      ]),
    })
    const car = await bl.getCar()
    assert.equal(car.id, 'first')
    assert.equal(car.photoUrl, 'https://images.example.test/car.png')
    assert.equal(h.pickers.length, 0)
    if (region === 'canada') assert.equal(activated, undefined)
    if (region === 'usa') assert.equal(bl.carId, 'first')
  })
}

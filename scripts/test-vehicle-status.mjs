import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modules = new Map()
const context = vm.createContext({
  Script: { name: () => 'Bluelocke' },
  DateFormatter: class {
    date() {
      return new Date('2026-10-28T12:00:00Z')
    }
  },
})

// Run the real status adapters without credentials, network requests, or Scriptable storage.
function load(name) {
  if (modules.has(name)) return modules.get(name).exports
  const module = { exports: {} }
  modules.set(name, module)
  const source = ts.transpileModule(fs.readFileSync(path.join(ROOT, `src/lib/bluelink-regions/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const require = (dependency) => (dependency === './base' ? load('base') : {})
  vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context)(require, module, module.exports)
  return module.exports
}

const regions = [
  {
    name: 'Canada',
    module: 'canada',
    className: 'BluelinkCanada',
    unit: 'km',
    read: (bl, raw) => bl.returnCarStatus(raw, false, 12345),
  },
  {
    name: 'Hyundai USA',
    module: 'usa',
    className: 'BluelinkUSA',
    unit: 'mi',
    read: (bl, raw) => bl.returnCarStatus(raw, false),
  },
  {
    name: 'Kia USA',
    module: 'usa-kia',
    className: 'BluelinkUSAKia',
    unit: 'mi',
    read: (bl, raw) => bl.returnCarStatus(raw),
  },
  {
    name: 'India',
    module: 'india',
    className: 'BluelinkIndia',
    unit: 'km',
    read: (bl, raw) => bl.returnCarStatus({ odometer: 12345 }, { gpsDetail: {} }, raw, Date.now()),
  },
]

function client(region, cachedStatus) {
  const bl = Object.create(load(region.module)[region.className].prototype)
  bl.distanceUnit = region.unit
  bl.config = { vehicleTypeOverride: 'auto' }
  if (cachedStatus) bl.cache = { car: { modelName: 'Tucson', modelYear: '2022' }, status: cachedStatus }
  return bl
}

const evStatus = (rangeByFuel) => ({
  batteryStatus: 72,
  batteryCharge: false,
  batteryPlugin: 0,
  drvDistance: [{ rangeByFuel }],
})

for (const region of regions) {
  test(`${region.name}: ICE status reads distance to empty without an EV block`, () => {
    const bl = client(region)
    const result = region.read(bl, {
      dte: { value: 263, unit: region.unit === 'mi' ? 3 : 1 },
      battery: { batSoc: 70 },
      doorLock: true,
      fuelLevel: 42,
    })
    assert.equal(result.range, 263)
    assert.equal(result.twelveSoc, 70)
    assert.equal(result.fuelLevel, 42)
    assert.equal(result.locked, true)
    assert.equal(result.supportsChargeCommands, false)
  })

  test(`${region.name}: incomplete EV block still exposes total and gas range`, () => {
    for (const field of ['totalAvailableRange', 'gasModeRange']) {
      const result = region.read(client(region), {
        evStatus: { drvDistance: [{ rangeByFuel: { [field]: { value: '415' } } }] },
      })
      assert.equal(result.range, 415)
    }
  })

  test(`${region.name}: numeric strings and alternate 12V fields are read on ICE status`, () => {
    const result = region.read(client(region), {
      distanceToEmpty: { value: '312', unit: region.unit === 'mi' ? '3' : '1' },
      batteryStatus: { stateOfCharge: '84' },
    })
    assert.equal(result.range, 312)
    assert.equal(result.twelveSoc, 84)
  })

  test(`${region.name}: an EV keeps its electric range instead of the combined PHEV range`, () => {
    const result = region.read(client(region), {
      evStatus: evStatus({
        evModeRange: { value: 55 },
        totalAvailableRange: { value: 600 },
        gasModeRange: { value: 545 },
      }),
      dte: { value: 545 },
      battery: { batSoc: 88 },
    })
    // India already displays total available range rather than electric-only range.
    assert.equal(result.range, region.name === 'India' ? 600 : 55)
    assert.equal(result.twelveSoc, 88)
  })

  test(`${region.name}: an empty EV range can fall back to the reported total range`, () => {
    const result = region.read(client(region), {
      evStatus: evStatus({ evModeRange: { value: 0 }, totalAvailableRange: { value: '480' } }),
    })
    assert.equal(result.range, 480)
  })

  test(`${region.name}: partial updates retain cached range and 12V readings`, () => {
    for (const raw of [{}, { evStatus: evStatus({}) }]) {
      const result = region.read(client(region, { range: 321, twelveSoc: 82 }), raw)
      assert.equal(result.range, 321)
      assert.equal(result.twelveSoc, 82)
    }
  })

  test(`${region.name}: invalid values do not replace cached readings`, () => {
    const result = region.read(client(region, { range: 321, twelveSoc: 82 }), {
      dte: { value: -1 },
      distanceToEmpty: { value: 'unknown' },
      battery: { batSoc: 255 },
    })
    assert.equal(result.range, 321)
    assert.equal(result.twelveSoc, 82)
    const missing = region.read(client(region), {})
    assert.equal(missing.range, 0)
    assert.equal(missing.twelveSoc, 0)
  })
}

test('range units are converted to the unit displayed by the regional client', () => {
  const canada = regions[0]
  const usa = regions[1]
  assert.equal(canada.read(client(canada), { dte: { value: 100, unit: 3 } }).range, 160)
  assert.equal(usa.read(client(usa), { dte: { value: 100, unit: 1 } }).range, 62)
})

test('a 1% auxiliary battery reading is not treated as a 0–1 ratio', () => {
  const region = regions[0]
  const result = region.read(client(region), { battery: { batSoc: '1' } })
  assert.equal(result.twelveSoc, 1)
})

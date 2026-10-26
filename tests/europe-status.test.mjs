import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile('src/lib/bluelink-regions/europe-status.ts', 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const { europeCarStatus } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const updated = 1793037600000

function hybrid() {
  return {
    Drivetrain: { Odometer: 12345.9, FuelSystem: { FuelLevel: 63, DTE: { Total: 710, Unit: 1 } } },
    Green: { BatteryManagement: { BatteryRemain: { Ratio: 48 } } },
    Cabin: {
      Door: {
        Row1: { Driver: { Open: 0, Lock: 0 }, Passenger: { Open: 0, Lock: 0 } },
        Row2: { Left: { Open: 0, Lock: 0 }, Right: { Open: 0, Lock: 0 } },
      },
      HVAC: { Row1: { Driver: { Blower: { SpeedLevel: 0 } } } },
    },
    Electronics: { Battery: { Level: 83 } },
    Location: { GeoCoord: { Latitude: 44.17, Longitude: 28.63 } },
  }
}

function plugIn() {
  const status = hybrid()
  status.Green.ChargingInformation = {
    ConnectorFastening: { State: 1 },
    Charging: { RemainTime: 35 },
    TargetSoC: { Standard: 80, Quick: 90 },
  }
  status.Green.Electric = { SmartGrid: { RealTimePower: 7.2 } }
  return status
}

test('HEV status loads without ChargingInformation and reports fuel rather than charging support', () => {
  const status = europeCarStatus(hybrid(), updated, 'km')
  assert.equal(status.fuelLevel, 63)
  assert.equal(status.range, 710)
  assert.equal(status.odometer, 12345)
  assert.equal(status.twelveSoc, 83)
  assert.equal(status.soc, 48)
  assert.equal(status.isPluggedIn, false)
  assert.equal(status.isCharging, false)
  assert.equal(status.chargingPower, 0)
  assert.equal(status.remainingChargeTimeMins, 0)
  assert.equal(status.supportsChargeCommands, false)
  assert.equal(status.chargeLimit, undefined)
  assert.equal(status.lastRemoteStatusCheck, updated)
  assert.deepEqual(status.location, { latitude: '44.17', longitude: '28.63' })
})

for (const value of [undefined, null, {}]) {
  test(`ICE/HEV status also loads with Green=${JSON.stringify(value)}`, () => {
    const report = hybrid()
    report.Green = value
    const status = europeCarStatus(report, updated, 'km')
    assert.equal(status.fuelLevel, 63)
    assert.equal(status.soc, 0)
    assert.equal(status.supportsChargeCommands, false)
  })
}

test('a partially populated ChargingInformation block is safe', () => {
  const report = hybrid()
  report.Green.ChargingInformation = { ConnectorFastening: {}, Charging: null, TargetSoC: null }
  const status = europeCarStatus(report, updated, 'km')
  assert.equal(status.isCharging, false)
  assert.equal(status.supportsChargeCommands, false)
})

test('EV/PHEV status retains charging, power and target charge levels', () => {
  const status = europeCarStatus(plugIn(), updated, 'km')
  assert.equal(status.isCharging, true)
  assert.equal(status.isPluggedIn, true)
  assert.equal(status.chargingPower, 7.2)
  assert.equal(status.remainingChargeTimeMins, 35)
  assert.equal(status.supportsChargeCommands, true)
  assert.deepEqual(status.chargeLimit, { acPercent: 80, dcPercent: 90 })
})

test('an unplugged EV with boolean connector state remains charging capable', () => {
  const report = plugIn()
  report.Green.ChargingInformation.ConnectorFastening.State = false
  report.Green.ChargingInformation.Charging.RemainTime = 0
  const status = europeCarStatus(report, updated, 'km')
  assert.equal(status.isPluggedIn, false)
  assert.equal(status.isCharging, false)
  assert.equal(status.chargingPower, 0)
  assert.equal(status.supportsChargeCommands, true)
})

test('partial reports preserve previously known sensors and location', () => {
  const cached = europeCarStatus(hybrid(), updated, 'km')
  const status = europeCarStatus({ Drivetrain: { FuelSystem: { DTE: { Total: 0 } } } }, updated + 1000, 'km', cached)
  for (const field of ['odometer', 'range', 'fuelLevel', 'soc', 'twelveSoc', 'locked', 'climate', 'location']) {
    assert.deepEqual(status[field], cached[field], field)
  }
  assert.equal(status.lastRemoteStatusCheck, updated + 1000)
})

test('zero and one percent readings are preserved as percentages, including with cached values', () => {
  const cached = europeCarStatus(hybrid(), updated, 'km')
  const report = hybrid()
  report.Drivetrain.FuelSystem.FuelLevel = 1
  report.Drivetrain.Odometer = 0
  report.Green.BatteryManagement.BatteryRemain.Ratio = 0
  report.Electronics.Battery.Level = 0
  let status = europeCarStatus(report, updated, 'km', cached)
  assert.equal(status.fuelLevel, 1)
  assert.equal(status.odometer, 0)
  assert.equal(status.soc, 0)
  assert.equal(status.twelveSoc, 0)
  report.Drivetrain.FuelSystem.FuelLevel = 0
  status = europeCarStatus(report, updated, 'km', cached)
  assert.equal(status.fuelLevel, 0)
})

test('invalid numeric readings do not replace valid cached sensors', () => {
  const cached = europeCarStatus(hybrid(), updated, 'km')
  const report = hybrid()
  report.Drivetrain.FuelSystem.FuelLevel = 255
  report.Drivetrain.Odometer = 'unknown'
  report.Green.BatteryManagement.BatteryRemain.Ratio = null
  report.Electronics.Battery.Level = 255
  const status = europeCarStatus(report, updated, 'km', cached)
  for (const field of ['fuelLevel', 'odometer', 'soc', 'twelveSoc']) assert.equal(status[field], cached[field])
})

test('closed but unlocked doors are reported unlocked, including the CCS2 rear door names', () => {
  const report = hybrid()
  report.Cabin.Door.Row2.Right.Lock = 1
  assert.equal(europeCarStatus(report, updated, 'km').locked, false)
  report.Cabin.Door.Row2.Right.Lock = 0
  assert.equal(europeCarStatus(report, updated, 'km').locked, true)
  report.Cabin.Door.Row1.Driver.Open = 1
  assert.equal(europeCarStatus(report, updated, 'km').locked, false)
})

test('missing door sensors are not treated as proof that the car is locked', () => {
  const report = hybrid()
  delete report.Cabin.Door
  assert.equal(europeCarStatus(report, updated, 'km').locked, false)
  assert.equal(europeCarStatus(report, updated, 'km', { locked: true }).locked, true)
})

test('missing HVAC, electronics, location and drivetrain branches are safe', () => {
  const status = europeCarStatus({ Cabin: null, Electronics: null, Location: null, Drivetrain: null }, updated, 'km')
  assert.equal(status.climate, false)
  assert.equal(status.twelveSoc, 0)
  assert.equal(status.odometer, 0)
  assert.equal(status.range, 0)
  assert.equal(status.location, undefined)
})

test('mile conversion and numeric-string readings are supported', () => {
  const report = hybrid()
  report.Drivetrain.Odometer = '10000'
  report.Drivetrain.FuelSystem.FuelLevel = '42'
  report.Cabin.HVAC.Row1.Driver.Blower.SpeedLevel = '3'
  const status = europeCarStatus(report, updated, 'mi')
  assert.equal(status.odometer, 6213)
  assert.equal(status.fuelLevel, 42)
  assert.equal(status.climate, true)
})

test('a missing vehicle response reports a useful error', () => {
  for (const invalid of [undefined, null, 'not a vehicle', []]) {
    assert.throws(() => europeCarStatus(invalid, updated, 'km'), /returned no vehicle status/)
  }
})

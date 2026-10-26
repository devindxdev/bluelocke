import type { BluelinkStatus } from './base'

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePercent(value: unknown): number | undefined {
  const parsed = parseNumber(value)
  return parsed !== undefined && parsed >= 0 && parsed <= 100 ? parsed : undefined
}

export function europeCarStatus(
  status: any,
  updateTime: number,
  distanceUnit: string,
  cached?: BluelinkStatus,
): BluelinkStatus {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    throw Error('Hyundai Europe returned no vehicle status.')
  }

  const charging = status.Green?.ChargingInformation
  const connector = charging?.ConnectorFastening?.State
  const connectorState = typeof connector === 'boolean' ? Number(connector) : parseNumber(connector)
  const remainingTime = parseNumber(charging?.Charging?.RemainTime)
  const isPluggedIn = connectorState !== undefined ? connectorState > 0 : (cached?.isPluggedIn ?? false)
  const isCharging = isPluggedIn && (remainingTime ?? cached?.remainingChargeTimeMins ?? 0) > 0
  const acPercent = parsePercent(charging?.TargetSoC?.Standard)
  const dcPercent = parsePercent(charging?.TargetSoC?.Quick)
  const chargeLimit = acPercent !== undefined ? { acPercent, dcPercent: dcPercent ?? 0 } : cached?.chargeLimit
  const hasChargingData =
    connectorState !== undefined || remainingTime !== undefined || acPercent !== undefined || dcPercent !== undefined

  const odometer = parseNumber(status.Drivetrain?.Odometer)
  const range = parseNumber(status.Drivetrain?.FuelSystem?.DTE?.Total)
  const blower = parseNumber(status.Cabin?.HVAC?.Row1?.Driver?.Blower?.SpeedLevel)
  const coordinates = status.Location?.GeoCoord
  const latitude = parseNumber(coordinates?.Latitude)
  const longitude = parseNumber(coordinates?.Longitude)

  const doors = [
    status.Cabin?.Door?.Row1?.Driver,
    status.Cabin?.Door?.Row1?.Passenger,
    status.Cabin?.Door?.Row2?.Left ?? status.Cabin?.Door?.Row2?.Driver,
    status.Cabin?.Door?.Row2?.Right ?? status.Cabin?.Door?.Row2?.Passenger,
  ]
  const locks = doors.map((door) => door?.Lock).filter((value) => [0, 1, false, true, '0', '1'].includes(value))
  const anyDoorOpen = doors.some((door) => door?.Open === true || parseNumber(door?.Open) === 1)
  const locked = locks.length > 0 ? locks.every((value) => Number(value) === 0) : (cached?.locked ?? false)

  return {
    lastStatusCheck: Date.now(),
    lastRemoteStatusCheck: parseNumber(updateTime) ?? cached?.lastRemoteStatusCheck ?? Date.now(),
    isCharging,
    isPluggedIn,
    chargingPower: isCharging
      ? (parseNumber(status.Green?.Electric?.SmartGrid?.RealTimePower) ?? cached?.chargingPower ?? 0)
      : 0,
    remainingChargeTimeMins: remainingTime ?? cached?.remainingChargeTimeMins ?? 0,
    range: range !== undefined && range > 0 ? Math.floor(range) : (cached?.range ?? 0),
    locked: !anyDoorOpen && locked,
    climate: blower !== undefined ? blower > 0 : (cached?.climate ?? false),
    soc: parsePercent(status.Green?.BatteryManagement?.BatteryRemain?.Ratio) ?? cached?.soc ?? 0,
    fuelLevel: parsePercent(status.Drivetrain?.FuelSystem?.FuelLevel) ?? cached?.fuelLevel,
    supportsChargeCommands: hasChargingData || cached?.supportsChargeCommands === true,
    twelveSoc: parsePercent(status.Electronics?.Battery?.Level) ?? cached?.twelveSoc ?? 0,
    odometer:
      odometer !== undefined
        ? Math.floor(distanceUnit === 'mi' ? odometer * 0.621371 : odometer)
        : (cached?.odometer ?? 0),
    location:
      latitude !== undefined && longitude !== undefined
        ? { latitude: String(latitude), longitude: String(longitude) }
        : cached?.location,
    chargeLimit,
  }
}

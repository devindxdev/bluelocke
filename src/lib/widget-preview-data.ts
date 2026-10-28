import type { Status } from './bluelink-regions/base'

export interface VehicleImagePreviewOptions {
  screenWidth: number
  appearance: 'white' | 'dark'
  distanceUnit: 'km' | 'mi'
  electric: boolean
}

export const DEFAULT_IMAGE_PREVIEW_OPTIONS: VehicleImagePreviewOptions = {
  screenWidth: 390,
  appearance: 'white',
  distanceUnit: 'km',
  electric: false,
}

export function createWidgetPreviewStatus(): Status {
  const updatedAt = new Date(2026, 9, 26, 23, 9).getTime()
  return {
    car: {
      id: 'preview',
      vin: '',
      nickName: 'Example Vehicle',
      modelName: 'Example Vehicle',
      modelYear: '2026',
      odometer: 37046,
    },
    status: {
      lastStatusCheck: updatedAt,
      lastRemoteStatusCheck: updatedAt,
      isCharging: false,
      isPluggedIn: false,
      chargingPower: 0,
      remainingChargeTimeMins: 0,
      range: 285,
      locked: true,
      climate: false,
      soc: 76,
      fuelLevel: 42,
      twelveSoc: 96,
      odometer: 37046,
    },
  }
}

export function getWidgetPreviewLabels(options: VehicleImagePreviewOptions) {
  const { car, status } = createWidgetPreviewStatus()
  return {
    title: car.nickName,
    energy: options.electric ? `${status.soc}%` : `Fuel ${status.fuelLevel}%`,
    range: `~${status.range} ${options.distanceUnit}`,
    odometer: `${status.odometer} ${options.distanceUnit}`,
    updated: new Date(status.lastRemoteStatusCheck).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }),
    twelveVolt: `12V ${status.twelveSoc}%`,
  }
}

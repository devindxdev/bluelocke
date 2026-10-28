import type { Config } from '../config'
import type { BluelinkCar } from './bluelink-regions/base'

export interface SelectedVehicle {
  id: string
  vin?: string
  account: string
  label: string
}

export function scriptStorageKey(kind: string, scope: string[] = []): string {
  return `bluelocke:${kind}:${JSON.stringify([Script.name(), ...scope])}`
}

export function vehicleAccount(config: Config): string {
  return JSON.stringify([config.manufacturer, config.auth.region, config.auth.username.trim()])
}

export function usableVin(vin: unknown): string | undefined {
  const value = typeof vin === 'string' ? vin.trim().toUpperCase() : ''
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value) ? value : undefined
}

export function vehicleLabel(car: BluelinkCar): string {
  const model = [car.modelYear, car.modelName].filter(Boolean).join(' ')
  const nickname = car.nickName && car.nickName !== car.modelName ? car.nickName : ''
  const name = [model, nickname].filter(Boolean).join(' · ') || 'Vehicle'
  const vin = usableVin(car.vin)
  return `${name} · ${vin ? `VIN …${vin.slice(-4)}` : `ID …${car.id.slice(-6)}`}`
}

export function vehicleChoices(cars: BluelinkCar[]) {
  const labels = cars.map(vehicleLabel)
  return cars.map((car, index) => ({
    label:
      labels.filter((label) => label === labels[index]).length > 1 ? `${labels[index]} (${car.id})` : labels[index]!,
    value: car.id,
  }))
}

export function selectedVehicle(car: BluelinkCar, config: Config): SelectedVehicle {
  return { id: car.id, vin: usableVin(car.vin), account: vehicleAccount(config), label: vehicleLabel(car) }
}

export function matchesVehicle(selection: SelectedVehicle, car: BluelinkCar): boolean {
  const vin = usableVin(car.vin)
  // A different full VIN must never match just because an API reused an ID.
  if (selection.vin && vin) return selection.vin === vin
  return selection.id === car.id
}

export function vehicleStorageScope(config: Config): string[] {
  const vehicle = config.selectedVehicle
  return [vehicleAccount(config), vehicle?.vin || vehicle?.id || 'unselected']
}

export class VehicleSelectionError extends Error {
  constructor(public reason: 'required' | 'missing' | 'cancelled' | 'changed') {
    super(
      {
        required: 'Open this script in Scriptable to select its vehicle first.',
        missing: 'The selected vehicle is no longer available. Open this script in Scriptable to choose a vehicle.',
        cancelled: 'Vehicle selection cancelled.',
        changed: 'The selected vehicle or account changed. Reopen this script before continuing.',
      }[reason],
    )
  }
}

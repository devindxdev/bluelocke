import type { ClimateRequest } from './bluelink-regions/base'

// US climate APIs use Fahrenheit even when the widget displays Celsius.
export function climateFahrenheit(request: ClimateRequest, defaultUnit: 'C' | 'F'): number {
  if (!Number.isFinite(request.temp)) throw Error('Invalid climate temperature')
  return Math.round((request.tempType ?? defaultUnit) === 'C' ? (request.temp * 9) / 5 + 32 : request.temp)
}

export function remoteEngineDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) throw Error('Invalid climate duration')
  // US remote engine start shuts off after ten minutes.
  return Math.max(1, Math.min(10, Math.round(minutes)))
}

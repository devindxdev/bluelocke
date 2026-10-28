import type { ClimateRequest } from 'lib/bluelink-regions/base'

import { scriptStorageKey, SelectedVehicle } from './lib/vehicle-selection'

const KEYCHAIN_BLUELINK_CONFIG_KEY = 'egmp-bluelink-config'

export const STANDARD_CLIMATE_OPTIONS = ['Warm', 'Cool', 'Off', 'Cancel']

export interface Auth {
  username: string
  password: string
  pin: string
  region: string
}

export const ClimateSeatSettingCool: Record<string, number> = {
  Off: 0,
  Low: 3,
  Medium: 4,
  High: 5,
}

export const ClimateSeatSettingWarm: Record<string, number> = {
  Off: 0,
  Low: 6,
  Medium: 7,
  High: 8,
}

export const ClimateSeatSetting: Record<string, number> = {
  Off: 0,
  'Cool - Low': 3,
  'Cool - Medium': 4,
  'Cool - High': 5,
  'Heat - Low': 6,
  'Heat - Medium': 7,
  'Heat - High': 8,
}

export interface CustomClimateConfig {
  name: string
  tempType: 'C' | 'F'
  temp: number
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  durationMinutes: number
  seatClimate: string
  seatClimateSettings: 'DRIVER' | 'FRONT' | 'ALL'
}

export interface ChargeLimitConfig {
  name: string
  acPercent: number
  dcPercent: number
}

export type VehicleTypeOverride = 'auto' | 'ice' | 'hev' | 'phev' | 'ev'
export type StandardClimateSeatLevel = 'Off' | 'Low' | 'Medium' | 'High'
export type StandardClimateSeatSelection = 'DRIVER' | 'FRONT' | 'ALL'

export interface StandardClimatePresetConfig {
  temp: number
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  durationMinutes: number
  seatClimateLevel: StandardClimateSeatLevel
  seatClimateSettings: StandardClimateSeatSelection
}

export interface StandardClimateConfig {
  warm: StandardClimatePresetConfig
  cool: StandardClimatePresetConfig
}

export interface Config {
  manufacturer: string
  auth: Auth
  displayNameOverride: string
  vehicleTypeOverride: VehicleTypeOverride
  standardClimateConfig: StandardClimateConfig
  tempType: 'C' | 'F'
  distanceUnit: 'km' | 'mi'
  climateTempWarm: number
  climateTempCold: number
  climateSeatLevel: string
  allowWidgetRemoteRefresh: boolean
  widgetAppearance: 'system' | 'dark' | 'white'
  mfaPreference: 'sms' | 'email'
  debugLogging: boolean
  selectedVehicle?: SelectedVehicle
  promptForUpdate: boolean
  widgetConfig: WidgetConfig
  customClimates: CustomClimateConfig[]
  hideDefaultClimates: boolean
  chargeLimits: ChargeLimitConfig[]
}

export interface WidgetConfig {
  standardPollPeriod: number
  remotePollPeriod: number
  chargingRemotePollPeriod: number
  nightStandardPollPeriod: number
  nightRemotePollPeriod: number
  nightChargingRemotePollPeriod: number
}

export interface FlattenedConfig {
  manufacturer: string
  username: string
  password: string
  pin: string
  region: string
  displayNameOverride: string
  vehicleTypeOverride: VehicleTypeOverride
  standardClimateConfig: StandardClimateConfig
  tempType: 'C' | 'F'
  distanceUnit: 'km' | 'mi'
  mfaPreference: 'sms' | 'email'
  climateTempWarm: number
  climateTempCold: number
  climateSeatLevel: string
  allowWidgetRemoteRefresh: boolean
  widgetAppearance: 'system' | 'dark' | 'white'
  debugLogging: boolean
  selectedVehicle?: SelectedVehicle
  promptForUpdate: boolean
  widgetConfig: WidgetConfig
  customClimates: CustomClimateConfig[]
  hideDefaultClimates: boolean
  chargeLimits: ChargeLimitConfig[]
}

const VEHICLE_TYPE_OVERRIDES: VehicleTypeOverride[] = ['auto', 'ice', 'hev', 'phev', 'ev']
const DEFAULT_TEMPS = {
  C: {
    cold: 19,
    warm: 21.5,
  },
  F: {
    cold: 66,
    warm: 71,
  },
}

function getDefaultStandardClimateConfig(tempType: 'C' | 'F'): StandardClimateConfig {
  return {
    warm: {
      temp: DEFAULT_TEMPS[tempType].warm,
      frontDefrost: true,
      rearDefrost: true,
      steering: true,
      durationMinutes: 15,
      seatClimateLevel: 'Off',
      seatClimateSettings: 'FRONT',
    },
    cool: {
      temp: DEFAULT_TEMPS[tempType].cold,
      frontDefrost: false,
      rearDefrost: false,
      steering: false,
      durationMinutes: 15,
      seatClimateLevel: 'Off',
      seatClimateSettings: 'FRONT',
    },
  }
}

const DEFAULT_CONFIG = {
  auth: {
    username: '',
    password: '',
    pin: '',
    region: '',
  },
  displayNameOverride: '',
  vehicleTypeOverride: 'auto',
  standardClimateConfig: getDefaultStandardClimateConfig('C'),
  tempType: 'C',
  distanceUnit: 'km',
  mfaPreference: 'sms',
  climateTempCold: DEFAULT_TEMPS.C.cold,
  climateTempWarm: DEFAULT_TEMPS.C.warm,
  climateSeatLevel: 'Off',
  debugLogging: false,
  promptForUpdate: true,
  allowWidgetRemoteRefresh: false,
  widgetAppearance: 'system',
  manufacturer: 'hyundai',
  hideDefaultClimates: false,
  customClimates: [],
  chargeLimits: [
    {
      name: 'Home',
      acPercent: 80,
      dcPercent: 80,
    },
    {
      name: 'Road Trip',
      acPercent: 100,
      dcPercent: 90,
    },
  ],
  widgetConfig: {
    standardPollPeriod: 1,
    remotePollPeriod: 4,
    chargingRemotePollPeriod: 2,
    nightStandardPollPeriod: 2,
    nightRemotePollPeriod: 6,
    nightChargingRemotePollPeriod: 4,
  },
} as Config

function getCacheKey(): string {
  const key = scriptStorageKey('config')
  if (Keychain.contains(key)) return key
  const legacyScriptKey = `egmp-scriptable-config-${Script.name().replaceAll(' ', '')}`
  return Keychain.contains(legacyScriptKey) ? legacyScriptKey : KEYCHAIN_BLUELINK_CONFIG_KEY
}

export function configExists(): boolean {
  const config = getConfig()
  return !!(
    config.manufacturer &&
    config.auth.region &&
    config.auth.username?.trim() &&
    config.auth.password &&
    String(config.auth.pin ?? '').trim()
  )
}

export function deleteConfig(all = false) {
  // A tombstone prevents a reset script from importing old shared credentials again.
  Keychain.set(scriptStorageKey('config'), 'null')
  Keychain.remove(`egmp-scriptable-config-${Script.name().replaceAll(' ', '')}`)
  if (all) Keychain.remove(KEYCHAIN_BLUELINK_CONFIG_KEY)
}

export function setConfig(config: Config) {
  Keychain.set(scriptStorageKey('config'), JSON.stringify(config))
}

export function getFlattenedConfig(): FlattenedConfig {
  const config = getConfig()
  config.auth.pin = String(config.auth.pin ?? '') // convert previous pin if integer
  return {
    ...DEFAULT_CONFIG,
    ...config.auth,
    ...config,
  } as FlattenedConfig
}

export function getConfig(): Config {
  let config: Config | undefined
  try {
    if (Keychain.contains(getCacheKey())) config = JSON.parse(Keychain.get(getCacheKey()))
  } catch {
    /* keep Settings usable if stored data is damaged */
  }
  if (!config || !configValid(config)) {
    config = DEFAULT_CONFIG
  }
  // Import account/preferences from older versions, never another script's car.
  if (getCacheKey() !== scriptStorageKey('config')) config = { ...config, selectedVehicle: undefined }
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  }
  const widgetAppearanceRaw = (mergedConfig.widgetAppearance || 'system').toLocaleLowerCase()
  const vehicleTypeOverrideRaw = (mergedConfig.vehicleTypeOverride || 'auto').toLocaleLowerCase() as VehicleTypeOverride
  return {
    ...mergedConfig,
    displayNameOverride: (mergedConfig.displayNameOverride || '').trim(),
    vehicleTypeOverride: VEHICLE_TYPE_OVERRIDES.includes(vehicleTypeOverrideRaw) ? vehicleTypeOverrideRaw : 'auto',
    standardClimateConfig: getStandardClimateConfig(mergedConfig),
    widgetAppearance:
      widgetAppearanceRaw === 'dark' || widgetAppearanceRaw === 'white' || widgetAppearanceRaw === 'system'
        ? widgetAppearanceRaw
        : 'system',
  }
}

function configValid(config: Config): boolean {
  return !!(config && config.auth)
}

function normalizeSeatClimateLevel(level: string | undefined): StandardClimateSeatLevel {
  return (['Off', 'Low', 'Medium', 'High'] as StandardClimateSeatLevel[]).includes(
    (level || 'Off') as StandardClimateSeatLevel,
  )
    ? ((level || 'Off') as StandardClimateSeatLevel)
    : 'Off'
}

function normalizeSeatClimateSelection(selection: string | undefined): StandardClimateSeatSelection {
  return (['DRIVER', 'FRONT', 'ALL'] as StandardClimateSeatSelection[]).includes(
    (selection || 'FRONT') as StandardClimateSeatSelection,
  )
    ? ((selection || 'FRONT') as StandardClimateSeatSelection)
    : 'FRONT'
}

export function getStandardClimateConfig(config: Partial<Config> & { tempType?: 'C' | 'F' }): StandardClimateConfig {
  const tempType = config.tempType || 'C'
  const defaults = getDefaultStandardClimateConfig(tempType)
  const standardConfig = config.standardClimateConfig
  const legacySeatLevel = normalizeSeatClimateLevel(config.climateSeatLevel)
  const warmConfig: Partial<StandardClimatePresetConfig> = standardConfig?.warm || {}
  const coolConfig: Partial<StandardClimatePresetConfig> = standardConfig?.cool || {}

  return {
    warm: {
      ...defaults.warm,
      ...warmConfig,
      temp:
        typeof warmConfig.temp === 'number'
          ? warmConfig.temp
          : typeof config.climateTempWarm === 'number'
            ? config.climateTempWarm
            : defaults.warm.temp,
      seatClimateLevel: normalizeSeatClimateLevel(warmConfig.seatClimateLevel || legacySeatLevel),
      seatClimateSettings: normalizeSeatClimateSelection(warmConfig.seatClimateSettings),
    },
    cool: {
      ...defaults.cool,
      ...coolConfig,
      temp:
        typeof coolConfig.temp === 'number'
          ? coolConfig.temp
          : typeof config.climateTempCold === 'number'
            ? config.climateTempCold
            : defaults.cool.temp,
      seatClimateLevel: normalizeSeatClimateLevel(coolConfig.seatClimateLevel || legacySeatLevel),
      seatClimateSettings: normalizeSeatClimateSelection(coolConfig.seatClimateSettings),
    },
  }
}

function buildSeatClimateOption(
  seatClimateLevel: StandardClimateSeatLevel,
  seatClimateSettings: StandardClimateSeatSelection,
  preset: 'warm' | 'cool',
) {
  if (seatClimateLevel === 'Off') return undefined
  const seatMap = preset === 'warm' ? ClimateSeatSettingWarm : ClimateSeatSettingCool
  const seatValue = seatMap[seatClimateLevel] as number
  return {
    driver: seatValue,
    passenger: ['ALL', 'FRONT'].includes(seatClimateSettings) ? seatValue : 0,
    rearLeft: seatClimateSettings === 'ALL' ? seatValue : 0,
    rearRight: seatClimateSettings === 'ALL' ? seatValue : 0,
  }
}

export function buildStandardClimateRequest(config: Config, preset: 'warm' | 'cool'): ClimateRequest {
  const presetConfig = getStandardClimateConfig(config)[preset]
  const seatClimateOption = buildSeatClimateOption(
    presetConfig.seatClimateLevel,
    presetConfig.seatClimateSettings,
    preset,
  )
  return {
    enable: true,
    frontDefrost: presetConfig.frontDefrost,
    rearDefrost: presetConfig.rearDefrost,
    steering: presetConfig.steering,
    temp: presetConfig.temp,
    durationMinutes: presetConfig.durationMinutes,
    ...(seatClimateOption && { seatClimateOption }),
  }
}

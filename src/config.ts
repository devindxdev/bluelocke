import { Bluelink, ClimateRequest } from 'lib/bluelink-regions/base'
import { form, confirm, quickOptions, destructiveConfirm } from './lib/scriptable-utils'

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
  multiCar: boolean
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
  multiCar: boolean
  promptForUpdate: boolean
  widgetConfig: WidgetConfig
  customClimates: CustomClimateConfig[]
  hideDefaultClimates: boolean
  chargeLimits: ChargeLimitConfig[]
}

interface CarSettingsConfig {
  displayNameOverride: string
  vehicleTypeOverride: VehicleTypeOverride
}

interface ClimateSettingsForm {
  warmPreset: boolean
  coolPreset: boolean
}

type MainConfigForm = Omit<
  FlattenedConfig,
  | 'displayNameOverride'
  | 'vehicleTypeOverride'
  | 'standardClimateConfig'
  | 'climateTempWarm'
  | 'climateTempCold'
  | 'climateSeatLevel'
> & {
  carSettings: boolean
  climateSettings: boolean
}

// const SUPPORTED_REGIONS = ['canada']
const SUPPORTED_REGIONS = ['canada', 'usa', 'europe', 'india', 'australia']
const SUPPORTED_MANUFACTURERS = ['Hyundai', 'Kia', 'Genesis']
const WIDGET_APPEARANCES: Config['widgetAppearance'][] = ['system', 'dark', 'white']
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
  multiCar: false,
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

function getCacheKey(write = false): string {
  const newCacheKey = `egmp-scriptable-config-${Script.name().replaceAll(' ', '')}`
  if (write || Keychain.contains(newCacheKey)) return newCacheKey
  return KEYCHAIN_BLUELINK_CONFIG_KEY
}

export function configExists(): boolean {
  return Keychain.contains(getCacheKey())
}

export function deleteConfig(all = false) {
  Keychain.remove(getCacheKey(true))
  if (all) Keychain.remove(getCacheKey())
}

export function setConfig(config: Config) {
  Keychain.set(getCacheKey(true), JSON.stringify(config))
}

export function getFlattenedConfig(): FlattenedConfig {
  const config = getConfig()
  config.auth.pin = config.auth.pin.toString() // convert previous pin if integer
  return {
    ...DEFAULT_CONFIG,
    ...config.auth,
    ...config,
  } as FlattenedConfig
}

export function getConfig(): Config {
  let config: Config | undefined
  if (configExists()) {
    config = JSON.parse(Keychain.get(getCacheKey()))
  }
  if (!config || !configValid) {
    config = DEFAULT_CONFIG
  }
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

function configResetRequired(oldConfig: Config, newConfig: Config): boolean {
  return (
    oldConfig.manufacturer !== newConfig.manufacturer ||
    oldConfig.auth.region !== newConfig.auth.region ||
    oldConfig.auth.username !== newConfig.auth.username ||
    oldConfig.auth.password !== newConfig.auth.password
  )
}

function configValid(config: Config): boolean {
  return config && Object.hasOwn(config, 'auth')
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

export async function loadConfigScreen(bl: Bluelink | undefined = undefined) {
  return await form<MainConfigForm>({
    title: 'Bluelink Configuration settings',
    subtitle: 'Saved within IOS keychain and never exposed beyond your device(s)',
    onSubmit: ({
      username,
      password,
      region,
      pin,
      tempType,
      mfaPreference,
      distanceUnit,
      debugLogging,
      multiCar,
      promptForUpdate,
      allowWidgetRemoteRefresh,
      widgetAppearance,
      manufacturer,
      hideDefaultClimates,
    }) => {
      // read and combine with current saved config as other config screens may have changed settings (custom climates etc)
      const config = getConfig()
      const normalizedTempType = tempType || config.tempType || 'C'
      const existingStandardClimateConfig = getStandardClimateConfig(config)
      const standardClimateConfig =
        config.tempType === normalizedTempType
          ? existingStandardClimateConfig
          : {
              ...existingStandardClimateConfig,
              warm: {
                ...existingStandardClimateConfig.warm,
                temp: DEFAULT_TEMPS[normalizedTempType].warm,
              },
              cool: {
                ...existingStandardClimateConfig.cool,
                temp: DEFAULT_TEMPS[normalizedTempType].cold,
              },
            }
      const newConfig = {
        ...config,
        ...{
          auth: {
            username: username,
            password: password,
            region: region,
            pin: pin,
          },
          tempType: normalizedTempType,
          distanceUnit: distanceUnit,
          mfaPreference: mfaPreference,
          standardClimateConfig: standardClimateConfig,
          climateTempCold: standardClimateConfig.cool.temp,
          climateTempWarm: standardClimateConfig.warm.temp,
          allowWidgetRemoteRefresh: allowWidgetRemoteRefresh,
          widgetAppearance: widgetAppearance ? widgetAppearance.toLocaleLowerCase() : 'system',
          debugLogging: debugLogging,
          multiCar: multiCar,
          promptForUpdate: promptForUpdate,
          manufacturer: manufacturer?.toLowerCase(),
          hideDefaultClimates: hideDefaultClimates,
        },
      } as Config
      setConfig(newConfig)
      if (bl && configResetRequired(config, newConfig)) {
        bl.deleteCache()
      }
    },
    onStateChange: (state, previousState): Partial<MainConfigForm> => {
      if (state.allowWidgetRemoteRefresh && !previousState.allowWidgetRemoteRefresh) {
        confirm('Enabling background remote refresh may impact your 12v battery ', {
          confirmButtonTitle: 'I understand',
          includeCancel: false,
        })
      }
      if (
        state.region === 'europe' &&
        state.manufacturer === 'Kia' &&
        (previousState.region !== 'europe' || previousState.manufacturer !== 'Kia')
      ) {
        confirm('Kia in Europe requires login through a webview. Login window will open automatically.', {
          confirmButtonTitle: 'I understand',
          includeCancel: false,
        })
      }

      return state
    },
    isFormValid: ({ username, password, region, pin, tempType }) => {
      if (!username || !password || !region || !pin || !tempType) {
        return false
      }
      return true
    },
    submitButtonText: 'Save',
    fields: {
      username: {
        type: 'textInput',
        label: 'Bluelink Username',
        isRequired: true,
      },
      password: {
        type: 'textInput',
        label: 'Bluelink Password',
        isRequired: true,
        secure: true,
      },
      pin: {
        type: 'textInput',
        label: 'Bluelink PIN',
        isRequired: true,
        secure: true,
        flavor: 'number',
      },
      region: {
        type: 'dropdown',
        label: 'Choose your Bluelink region',
        options: SUPPORTED_REGIONS,
        allowCustom: false,
        isRequired: true,
      },
      manufacturer: {
        type: 'dropdown',
        label: 'Choose your Car Manufacturer',
        options: SUPPORTED_MANUFACTURERS,
        allowCustom: false,
        isRequired: true,
      },
      carSettings: {
        type: 'clickable',
        label: 'Car Settings',
        customIcon: 'car',
        faded: true,
        onClickFunction: () => {
          loadCarSettingsScreen()
        },
      },
      climateSettings: {
        type: 'clickable',
        label: 'Climate Settings',
        customIcon: 'thermometer',
        faded: true,
        onClickFunction: () => {
          loadClimateSettingsScreen()
        },
      },
      tempType: {
        type: 'dropdown',
        label: 'Choose your preferred temperature scale',
        options: ['C', 'F'],
        allowCustom: false,
        isRequired: true,
      },
      distanceUnit: {
        type: 'dropdown',
        label: 'Choose your preferred distance unit',
        options: ['km', 'mi'],
        allowCustom: false,
        isRequired: true,
      },
      mfaPreference: {
        type: 'dropdown',
        label: 'Choose your preferred MFA method for login',
        options: ['sms', 'email'],
        allowCustom: false,
        isRequired: true,
      },
      widgetAppearance: {
        type: 'dropdown',
        label: 'Widget Appearance',
        options: WIDGET_APPEARANCES,
        allowCustom: false,
        isRequired: true,
      },
      allowWidgetRemoteRefresh: {
        type: 'checkbox',
        label: 'Enable widget remote refresh',
        isRequired: false,
      },
      debugLogging: {
        type: 'checkbox',
        label: 'Enable debug logging',
        isRequired: false,
      },
      promptForUpdate: {
        type: 'checkbox',
        label: 'Enable prompting for app updates',
        isRequired: false,
      },
      widgetConfig: {
        type: 'clickable',
        label: 'Optional Advanced Widget Settings',
        customIcon: 'gear',
        faded: true,
        onClickFunction: loadWidgetConfigScreen,
      },
      chargeLimits: {
        type: 'clickable',
        label: 'Charge Limit Profiles',
        // charge_limit icon IOS 16 and above
        customIcon: parseFloat(Device.systemVersion()) >= 16 ? 'charge_limit' : 'charge_limit2',
        faded: true,
        onClickFunction: () => {
          const config = getConfig()
          const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
          quickOptions(['New'].concat(chargeLimitNames), {
            title: 'Create New Custom Climate or Edit Existing',
            onOptionSelect: (opt) => {
              loadChargeLimitConfig(
                opt !== 'New' ? Object.values(config.chargeLimits).filter((x) => x.name === opt)[0] : undefined,
              )
            },
          })
        },
      },
      customClimates: {
        type: 'clickable',
        label: 'Optional Custom Climates',
        customIcon: 'gear',
        faded: true,
        onClickFunction: () => {
          const config = getConfig()
          const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
          quickOptions(['New'].concat(customClimateNames), {
            title: 'Create New Custom Climate or Edit Existing',
            onOptionSelect: (opt) => {
              loadCustomClimateConfig(
                opt !== 'New' ? Object.values(config.customClimates).filter((x) => x.name === opt)[0] : undefined,
              )
            },
          })
        },
      },
      hideDefaultClimates: {
        type: 'checkbox',
        label: 'Hide default climate options',
        isRequired: false,
      },
      multiCar: {
        type: 'checkbox',
        label: 'Enable Multi Car Support',
        isRequired: false,
      },
    },
  })({
    ...getFlattenedConfig(),
    carSettings: false,
    climateSettings: false,
  })
}

export async function loadCarSettingsScreen() {
  const config = getConfig()
  return await form<CarSettingsConfig>({
    title: 'Car Settings',
    subtitle: 'Override how your vehicle is named and classified throughout Bluelocke.',
    onSubmit: ({ displayNameOverride, vehicleTypeOverride }) => {
      const currentConfig = getConfig()
      setConfig({
        ...currentConfig,
        displayNameOverride: displayNameOverride ? displayNameOverride.trim() : '',
        vehicleTypeOverride: vehicleTypeOverride || 'auto',
      } as Config)
    },
    isFormValid: ({ vehicleTypeOverride }) => {
      return !!vehicleTypeOverride
    },
    submitButtonText: 'Save',
    fields: {
      displayNameOverride: {
        type: 'textInput',
        label: 'Vehicle Name Override (optional)',
        isRequired: false,
      },
      vehicleTypeOverride: {
        type: 'dropdown',
        label: 'Vehicle Type Override',
        options: VEHICLE_TYPE_OVERRIDES,
        allowCustom: false,
        isRequired: true,
      },
    },
  })({
    displayNameOverride: config.displayNameOverride || '',
    vehicleTypeOverride: config.vehicleTypeOverride || 'auto',
  })
}

export async function loadClimateSettingsScreen() {
  return await form<ClimateSettingsForm>({
    title: 'Climate Settings',
    subtitle: 'Edit what the default Warm and Cool actions do in the app and Shortcut commands.',
    onSubmit: () => {},
    isFormValid: () => true,
    submitButtonText: 'Done',
    fields: {
      warmPreset: {
        type: 'clickable',
        label: 'Warm Preset',
        customIcon: 'sun',
        faded: true,
        onClickFunction: () => {
          loadStandardClimatePresetScreen('warm')
        },
      },
      coolPreset: {
        type: 'clickable',
        label: 'Cool Preset',
        customIcon: 'moon_circle',
        faded: true,
        onClickFunction: () => {
          loadStandardClimatePresetScreen('cool')
        },
      },
    },
  })({
    warmPreset: false,
    coolPreset: false,
  })
}

export async function loadStandardClimatePresetScreen(preset: 'warm' | 'cool') {
  const config = getConfig()
  const standardConfig = getStandardClimateConfig(config)[preset]
  const presetLabel = preset === 'warm' ? 'Warm' : 'Cool'
  return await form<StandardClimatePresetConfig>({
    title: `${presetLabel} Preset`,
    subtitle: `Controls what the default ${presetLabel.toLowerCase()} action does in Bluelocke.`,
    onSubmit: ({
      temp,
      frontDefrost,
      rearDefrost,
      steering,
      durationMinutes,
      seatClimateLevel,
      seatClimateSettings,
    }) => {
      const currentConfig = getConfig()
      const mergedStandardConfig = getStandardClimateConfig(currentConfig)
      const nextStandardConfig = {
        ...mergedStandardConfig,
        [preset]: {
          temp: temp,
          frontDefrost: frontDefrost,
          rearDefrost: rearDefrost,
          steering: steering,
          durationMinutes: durationMinutes,
          seatClimateLevel: normalizeSeatClimateLevel(seatClimateLevel),
          seatClimateSettings: normalizeSeatClimateSelection(seatClimateSettings),
        },
      } as StandardClimateConfig
      setConfig({
        ...currentConfig,
        standardClimateConfig: nextStandardConfig,
        climateTempWarm: nextStandardConfig.warm.temp,
        climateTempCold: nextStandardConfig.cool.temp,
      } as Config)
    },
    isFormValid: ({ temp, durationMinutes }) => {
      if (!temp || !durationMinutes) return false
      if (config.tempType === 'C' && (temp < 17 || temp > 27)) return false
      if (config.tempType === 'F' && (temp < 62 || temp > 82)) return false
      if (temp.toString().includes('.') && temp % 1 !== 0.5) return false
      if (durationMinutes < 1 || durationMinutes > 30) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      temp: {
        type: 'numberValue',
        label: `Temperature (${config.tempType})`,
        isRequired: true,
      },
      durationMinutes: {
        type: 'numberValue',
        label: 'Duration Minutes',
        isRequired: true,
      },
      frontDefrost: {
        type: 'checkbox',
        label: 'Enable front defrost',
        isRequired: false,
      },
      rearDefrost: {
        type: 'checkbox',
        label: 'Enable rear defrost',
        isRequired: false,
      },
      steering: {
        type: 'checkbox',
        label: 'Enable heated steering wheel',
        isRequired: false,
      },
      seatClimateLevel: {
        type: 'dropdown',
        label: 'Seat Climate Level',
        isRequired: true,
        options: ['Off', 'Low', 'Medium', 'High'],
      },
      seatClimateSettings: {
        type: 'dropdown',
        label: 'Seat Selection',
        isRequired: true,
        options: ['DRIVER', 'FRONT', 'ALL'],
      },
    },
  })(standardConfig)
}

export async function loadWidgetConfigScreen() {
  return await form<WidgetConfig>({
    title: 'Widget Poll Periods',
    subtitle: 'All periods are measured in hours',
    onSubmit: ({
      standardPollPeriod,
      remotePollPeriod,
      chargingRemotePollPeriod,
      nightStandardPollPeriod,
      nightRemotePollPeriod,
      nightChargingRemotePollPeriod,
    }) => {
      const config = getConfig()
      config.widgetConfig = {
        standardPollPeriod: standardPollPeriod || config.widgetConfig.standardPollPeriod,
        remotePollPeriod: remotePollPeriod || config.widgetConfig.remotePollPeriod,
        chargingRemotePollPeriod: chargingRemotePollPeriod || config.widgetConfig.chargingRemotePollPeriod,
        nightStandardPollPeriod: nightStandardPollPeriod || config.widgetConfig.nightStandardPollPeriod,
        nightRemotePollPeriod: nightRemotePollPeriod || config.widgetConfig.nightRemotePollPeriod,
        nightChargingRemotePollPeriod:
          nightChargingRemotePollPeriod || config.widgetConfig.nightChargingRemotePollPeriod,
      }
      setConfig(config)
    },
    onStateChange: (state, _previousState): Partial<WidgetConfig> => {
      return state
    },
    isFormValid: ({
      standardPollPeriod,
      remotePollPeriod,
      chargingRemotePollPeriod,
      nightStandardPollPeriod,
      nightRemotePollPeriod,
      nightChargingRemotePollPeriod,
    }) => {
      if (
        !standardPollPeriod ||
        !remotePollPeriod ||
        !chargingRemotePollPeriod ||
        !nightStandardPollPeriod ||
        !nightRemotePollPeriod ||
        !nightChargingRemotePollPeriod
      ) {
        return false
      }
      return true
    },
    submitButtonText: 'Save',
    fields: {
      standardPollPeriod: {
        type: 'numberValue',
        label: 'API Poll Period',
        isRequired: true,
      },
      remotePollPeriod: {
        type: 'numberValue',
        label: 'Remote Car Poll Period',
        isRequired: true,
      },
      chargingRemotePollPeriod: {
        type: 'numberValue',
        label: 'Remote Car Charging Poll Period',
        isRequired: true,
      },
      nightStandardPollPeriod: {
        type: 'numberValue',
        label: 'Night API Poll Period',
        isRequired: true,
      },
      nightRemotePollPeriod: {
        type: 'numberValue',
        label: 'Night Remote Car Poll Period',
        isRequired: true,
      },
      nightChargingRemotePollPeriod: {
        type: 'numberValue',
        label: 'Night Remote Car Charging Poll Period',
        isRequired: true,
      },
    },
  })(getFlattenedConfig().widgetConfig)
}

export async function loadCustomClimateConfig(climateConfig: CustomClimateConfig | undefined) {
  const previousName = climateConfig ? climateConfig.name : undefined
  const defaultClimateConfig = {
    name: '',
    tempType: 'C',
    temp: DEFAULT_TEMPS.C.warm,
    frontDefrost: true,
    rearDefrost: true,
    steering: true,
    durationMinutes: 15,
    seatClimate: 'OFF',
    seatClimateSettings: 'ALL',
  } as CustomClimateConfig
  if (!climateConfig) climateConfig = defaultClimateConfig
  else climateConfig = { ...defaultClimateConfig, ...climateConfig } // merge with default config

  return await form<CustomClimateConfig & { delete: boolean }>({
    title: 'Custom Climate Configuration',
    subtitle: previousName ? `Editing configuration: ${previousName}` : 'Create new configuration',
    onSubmit: ({
      name,
      tempType,
      temp,
      frontDefrost,
      rearDefrost,
      steering,
      durationMinutes,
      seatClimate,
      seatClimateSettings,
    }) => {
      const config = getConfig()
      const newConfig = {
        name: name,
        tempType: tempType,
        temp: temp,
        frontDefrost: frontDefrost,
        rearDefrost: rearDefrost,
        steering: steering,
        durationMinutes: durationMinutes,
        seatClimate: seatClimate || 'OFF',
        seatClimateSettings: seatClimateSettings || 'ALL',
      } as CustomClimateConfig
      if (previousName) {
        const index = config.customClimates.findIndex((x) => x.name === previousName)
        config.customClimates[index] = newConfig
      } else {
        config.customClimates.push(newConfig)
      }
      setConfig(config)
    },
    onStateChange: (state, previousState): Partial<CustomClimateConfig> => {
      if (state.tempType !== previousState.tempType) {
        if (state.tempType === 'C') {
          state.temp = DEFAULT_TEMPS.C.warm
        } else {
          state.temp = DEFAULT_TEMPS.F.warm
        }
      }
      return state
    },
    isFormValid: ({ name, tempType, temp, durationMinutes }) => {
      if (!name || !tempType || !temp || !durationMinutes) return false
      if (tempType === 'C' && (temp < 17 || temp > 27)) return false
      if (tempType === 'F' && (temp < 62 || temp > 82)) return false
      if (temp.toString().includes('.') && temp % 1 !== 0.5) return false
      if (temp.toString().includes('.') && temp % 1 !== 0.5) return false

      // check for name collision on our default options
      if (STANDARD_CLIMATE_OPTIONS.includes(name)) return false

      // check for name collision on other custom options
      const config = getConfig()
      const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
      if (previousName) customClimateNames.splice(customClimateNames.indexOf(previousName), 1)
      if (customClimateNames.includes(name)) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      name: {
        type: 'textInput',
        label: 'Name',
        isRequired: true,
      },
      tempType: {
        type: 'dropdown',
        label: 'Choose your preferred temperature scale',
        options: ['C', 'F'],
        allowCustom: false,
        isRequired: true,
      },
      temp: {
        type: 'numberValue',
        label: 'Desired climate temp (whole number or .5)',
        isRequired: true,
      },
      frontDefrost: {
        type: 'checkbox',
        label: 'Enable front defrost?',
        isRequired: false,
      },
      rearDefrost: {
        type: 'checkbox',
        label: 'Enable rear/side defrost?',
        isRequired: false,
      },
      steering: {
        type: 'checkbox',
        label: 'Enable heated steering?',
        isRequired: false,
      },
      durationMinutes: {
        type: 'numberValue',
        label: 'Number of Minutes to run climate',
        isRequired: true,
      },
      seatClimate: {
        type: 'dropdown',
        label: 'Seat Climate Level',
        isRequired: true,
        options: Object.keys(ClimateSeatSetting),
      },
      seatClimateSettings: {
        type: 'dropdown',
        label: 'Seat Climate "Seat Selection"',
        isRequired: true,
        options: ['DRIVER', 'FRONT', 'ALL'],
      },
      delete: {
        type: 'clickable',
        label: 'Delete Climate Configuration',
        customIcon: 'delete',
        faded: true,
        dismissOnTap: true,
        onClickFunction: () => {
          if (!previousName) return
          destructiveConfirm(`Delete Climate Configuration ${previousName}?`, {
            onConfirm: () => {
              const config = getConfig()
              const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
              const index = customClimateNames.indexOf(previousName)
              config.customClimates.splice(index, 1)
              setConfig(config)
            },
          })
        },
      },
    },
  })(climateConfig)
}

export async function loadChargeLimitConfig(chargeLimit: ChargeLimitConfig | undefined) {
  const previousName = chargeLimit ? chargeLimit.name : undefined
  if (!chargeLimit) {
    chargeLimit = {
      name: '',
      acPercent: 80,
      dcPercent: 80,
    } as ChargeLimitConfig
  }

  return await form<ChargeLimitConfig & { delete: boolean }>({
    title: 'Charge Limit Configuration',
    subtitle: previousName ? `Editing configuration: ${previousName}` : 'Create new configuration',
    onSubmit: ({ name, acPercent, dcPercent }) => {
      const config = getConfig()
      const newConfig = {
        name: name,
        acPercent: acPercent,
        dcPercent: dcPercent,
      } as ChargeLimitConfig
      if (previousName) {
        const index = config.chargeLimits.findIndex((x) => x.name === previousName)
        config.chargeLimits[index] = newConfig
      } else {
        config.chargeLimits.push(newConfig)
      }
      setConfig(config)
    },
    isFormValid: ({ name, acPercent, dcPercent }) => {
      if (!name || !acPercent || !dcPercent) return false
      if (acPercent < 0 || acPercent > 100) return false
      if (dcPercent < 0 || dcPercent > 100) return false
      if (!(acPercent % 10 === 0)) return false
      if (!(dcPercent % 10 === 0)) return false

      // check for name collision on other custom options
      const config = getConfig()
      const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
      if (previousName) chargeLimitNames.splice(chargeLimitNames.indexOf(previousName), 1)
      if (chargeLimitNames.includes(name)) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      name: {
        type: 'textInput',
        label: 'Name',
        isRequired: true,
      },
      acPercent: {
        type: 'numberValue',
        label: 'Desired AC (Slow) charge limit (0-100 in 10% increments)',
        isRequired: true,
      },
      dcPercent: {
        type: 'numberValue',
        label: 'Desired DC (Fast) charge limit (0-100 in 10% increments)',
        isRequired: true,
      },
      delete: {
        type: 'clickable',
        label: 'Delete Charge Limit Configuration',
        customIcon: 'delete',
        faded: true,
        dismissOnTap: true,
        onClickFunction: () => {
          if (!previousName) return
          destructiveConfirm(`Delete Charge Limit ${previousName}?`, {
            onConfirm: () => {
              const config = getConfig()
              const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
              const index = chargeLimitNames.indexOf(previousName)
              config.chargeLimits.splice(index, 1)
              setConfig(config)
            },
          })
        },
      },
    },
  })(chargeLimit)
}

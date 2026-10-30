import {
  Config,
  FlattenedConfig,
  VehicleTypeOverride,
  StandardClimatePresetConfig,
  configExists,
  getConfig,
  getFlattenedConfig,
  setConfig,
  deleteConfig,
  getStandardClimateConfig,
} from './config'
import { Bluelink } from './lib/bluelink-regions/base'
import { confirm, destructiveConfirm } from './lib/scriptable-utils'
import { settingsForm } from './lib/native-settings'
import { presentSettingsPage } from './lib/settings-navigation'
import { appHeader, appNavigation, appCaption, appListRow, appSeparator, appSpace } from './lib/app-ui'
import { loadVehicleImageSettings } from './lib/vehicle-image-editor'
import { loadAboutScreen, doDowngrade } from './about'
import { deleteWidgetCache } from './widget'

const REGIONS = ['canada', 'usa', 'europe', 'india', 'australia']
const MANUFACTURERS = ['hyundai', 'kia', 'genesis']
const VEHICLE_TYPES: VehicleTypeOverride[] = ['auto', 'ice', 'hev', 'phev', 'ev']
const titleCase = (text: string) => (text === 'usa' ? 'USA' : text.charAt(0).toUpperCase() + text.slice(1))

function closeApp() {
  // @ts-ignore - Scriptable exposes App.close without documenting it.
  App.close()
}

interface MenuEntry {
  title: string
  detail: string
  open: () => Promise<any>
  destructive?: boolean
}

async function settingsMenu(title: string, entries: () => MenuEntry[]) {
  let opening = false
  return presentSettingsPage((navigation) => [
    ...(!navigation.isRoot ? [appNavigation(navigation)] : []),
    appHeader(title),
    ...(title === 'Settings' ? [appCaption('Changes save automatically.')] : []),
    appSpace(),
    ...entries().flatMap((entry) => [
      appListRow(entry.title, {
        subtitle: entry.detail,
        destructive: entry.destructive,
        onSelect: async () => {
          if (opening) return
          opening = true
          try {
            await entry.open()
          } finally {
            opening = false
            if (navigation.isCurrent()) navigation.refresh()
          }
        },
      }),
      appSeparator(),
    ]),
    appSpace(),
  ])
}

export async function loadConfigScreen(bl?: Bluelink) {
  if (!configExists()) return loadAccountSettingsScreen(bl, true)
  return settingsMenu('Settings', () => [
    {
      title: 'Account',
      detail: 'Sign-in and connected service',
      open: () => loadAccountSettingsScreen(bl),
    },
    { title: 'Vehicle', detail: 'Display name and vehicle photo', open: () => loadCarSettingsScreen(bl) },
    { title: 'Climate', detail: 'Warm and Cool', open: () => loadClimateSettingsScreen() },
    {
      title: 'Appearance & Units',
      detail: 'Theme, distance, and temperature',
      open: () => loadAppearanceSettingsScreen(),
    },
    {
      title: 'Help & Support',
      detail: 'Updates and troubleshooting',
      open: () => loadSupportScreen(bl),
    },
  ])
}

type AccountSettings = Pick<
  FlattenedConfig,
  'username' | 'password' | 'pin' | 'region' | 'manufacturer' | 'mfaPreference'
>

export async function loadAccountSettingsScreen(_bl?: Bluelink, firstRun = false) {
  return settingsForm<AccountSettings>({
    title: firstRun ? 'Welcome to Bluelocke' : 'Account',
    subtitle: 'Sign in with your connected vehicle account. Changes save automatically.',
    allowIncomplete: true,
    initialSetup: firstRun,
    onChange: (values) => {
      const current = getConfig()
      const next: Config = {
        ...current,
        manufacturer: values.manufacturer ?? current.manufacturer,
        auth: {
          username: values.username ?? current.auth.username,
          password: values.password ?? current.auth.password,
          pin: values.pin ?? current.auth.pin,
          region: values.region ?? current.auth.region,
        },
        mfaPreference: values.mfaPreference ?? current.mfaPreference,
      }
      // setConfig invalidates authentication/status once when credentials change.
      setConfig(next)
    },
    isFormValid: ({ username, password, pin, region, manufacturer }) =>
      !!(username?.trim() && password && pin?.trim() && region && manufacturer),
    fields: {
      manufacturer: {
        type: 'dropdown',
        label: 'Manufacturer',
        options: MANUFACTURERS,
        mapDisplayValue: titleCase,
        isRequired: true,
      },
      region: { type: 'dropdown', label: 'Region', options: REGIONS, mapDisplayValue: titleCase, isRequired: true },
      username: { type: 'textInput', label: 'Email or username', flavor: 'email', isRequired: true },
      password: { type: 'textInput', label: 'Password', secure: true, isRequired: true },
      pin: { type: 'textInput', label: 'Vehicle PIN', secure: true, flavor: 'number', isRequired: true },
      mfaPreference: {
        type: 'dropdown',
        label: 'Verification code',
        options: ['sms', 'email'],
        mapDisplayValue: (value) => (value === 'sms' ? 'Text message' : 'Email'),
      },
    },
  })(getFlattenedConfig())
}

export async function loadCarSettingsScreen(bl?: Bluelink) {
  return settingsMenu('Vehicle', () => [
    {
      title: 'Display name',
      detail: getConfig().displayNameOverride || 'Use vehicle name',
      open: async () => {
        const alert = new Alert()
        alert.title = 'Display name'
        alert.message = 'Leave empty to use the vehicle’s name.'
        alert.addTextField('', getConfig().displayNameOverride)
        alert.addAction('Done')
        alert.addCancelAction('Cancel')
        if ((await alert.presentAlert()) < 0) return
        try {
          setConfig({ ...getConfig(), displayNameOverride: alert.textFieldValue(0).trim() })
        } catch {
          await confirm('Could not save the display name', { message: 'Please try again.', includeCancel: false })
        }
      },
    },
    {
      title: 'Vehicle photo',
      detail: 'Choose or adjust a photo',
      open: async () => {
        if (bl) await loadVehicleImageSettings(bl)
        else
          await confirm('Sign in to your vehicle first', {
            message: 'Finish your account details and reopen Bluelocke to choose a photo.',
            includeCancel: false,
          })
      },
    },
  ])
}

type AppearanceSettings = Pick<Config, 'tempType' | 'distanceUnit' | 'widgetAppearance'>

export async function loadAppearanceSettingsScreen() {
  return settingsForm<AppearanceSettings>({
    title: 'Appearance & Units',
    subtitle: 'The app follows your iPhone appearance.',
    onChange: (values) => {
      const current = getConfig()
      const tempType = values.tempType ?? current.tempType
      const climate = getStandardClimateConfig(current)
      const convertTemp = (temp: number) =>
        tempType === current.tempType
          ? temp
          : tempType === 'F'
            ? Math.max(62, Math.min(82, Math.round((temp * 9) / 5 + 32)))
            : Math.max(17, Math.min(27, Math.round((((temp - 32) * 5) / 9) * 2) / 2))
      const standardClimateConfig = {
        warm: { ...climate.warm, temp: convertTemp(climate.warm.temp) },
        cool: { ...climate.cool, temp: convertTemp(climate.cool.temp) },
      }
      setConfig({
        ...current,
        tempType,
        distanceUnit: values.distanceUnit ?? current.distanceUnit,
        widgetAppearance: values.widgetAppearance ?? current.widgetAppearance,
        standardClimateConfig,
        climateTempWarm: standardClimateConfig.warm.temp,
        climateTempCold: standardClimateConfig.cool.temp,
      })
    },
    fields: {
      widgetAppearance: {
        type: 'dropdown',
        label: 'Widget appearance',
        options: ['system', 'dark', 'white'],
        mapDisplayValue: (value) => ({ system: 'Automatic', dark: 'Dark', white: 'Light' })[value] ?? value,
      },
      distanceUnit: {
        type: 'dropdown',
        label: 'Distance',
        options: ['km', 'mi'],
        mapDisplayValue: (value) => (value === 'km' ? 'Kilometres' : 'Miles'),
      },
      tempType: {
        type: 'dropdown',
        label: 'Temperature',
        options: ['C', 'F'],
        mapDisplayValue: (value) => (value === 'C' ? 'Celsius' : 'Fahrenheit'),
      },
    },
  })(getConfig())
}

export async function loadClimateSettingsScreen() {
  return settingsMenu('Climate', () => {
    const config = getConfig()
    const presets = getStandardClimateConfig(config)
    return (['warm', 'cool'] as const).map((preset) => ({
      title: preset === 'warm' ? 'Warm' : 'Cool',
      detail: `${presets[preset].temp}°${config.tempType} · ${presets[preset].durationMinutes} minutes`,
      open: () => loadStandardClimatePresetScreen(preset),
    }))
  })
}

export async function loadStandardClimatePresetScreen(preset: 'warm' | 'cool') {
  const config = getConfig()
  const min = config.tempType === 'C' ? 17 : 62
  const max = config.tempType === 'C' ? 27 : 82
  return settingsForm<StandardClimatePresetConfig>({
    title: preset === 'warm' ? 'Warm' : 'Cool',
    onChange: (values) => {
      const current = getConfig()
      const previous = getStandardClimateConfig(current)
      const standardClimateConfig = { ...previous, [preset]: { ...previous[preset], ...values } }
      setConfig({
        ...current,
        standardClimateConfig,
        climateTempWarm: standardClimateConfig.warm.temp,
        climateTempCold: standardClimateConfig.cool.temp,
      })
    },
    isFormValid: ({ temp, durationMinutes }) =>
      typeof temp === 'number' &&
      temp >= min &&
      temp <= max &&
      (temp * 2) % 1 === 0 &&
      typeof durationMinutes === 'number' &&
      Number.isInteger(durationMinutes) &&
      durationMinutes >= 1 &&
      durationMinutes <= 30,
    fields: {
      temp: {
        type: 'numberValue',
        label: `Temperature (°${config.tempType})`,
        getErrorMessage: ({ temp }) =>
          typeof temp === 'number' && (temp < min || temp > max || (temp * 2) % 1 !== 0)
            ? `Choose ${min}–${max}° in half-degree steps.`
            : undefined,
      },
      durationMinutes: {
        type: 'numberValue',
        label: 'Duration (minutes)',
        getErrorMessage: ({ durationMinutes: value }) =>
          typeof value === 'number' && (!Number.isInteger(value) || value < 1 || value > 30)
            ? 'Choose 1–30 whole minutes.'
            : undefined,
      },
      frontDefrost: { type: 'checkbox', label: 'Front defrost' },
      rearDefrost: { type: 'checkbox', label: 'Rear defrost' },
      steering: { type: 'checkbox', label: 'Heated steering wheel' },
      seatClimateLevel: { type: 'dropdown', label: 'Seat climate', options: ['Off', 'Low', 'Medium', 'High'] },
      seatClimateSettings: {
        type: 'dropdown',
        label: 'Seats',
        options: ['DRIVER', 'FRONT', 'ALL'],
        mapDisplayValue: (value) => ({ DRIVER: 'Driver', FRONT: 'Front', ALL: 'All' })[value] ?? value,
        shouldHide: ({ seatClimateLevel }) => seatClimateLevel === 'Off',
      },
    },
  })(getStandardClimateConfig(config)[preset])
}

export async function loadSupportScreen(bl?: Bluelink) {
  return settingsMenu('Help & Support', () => [
    {
      title: 'Help & updates',
      detail: 'Guides, version, and release notes',
      open: () => loadAboutScreen(bl, true),
    },
    {
      title: 'Troubleshooting',
      detail: 'Diagnostics and vehicle detection',
      open: () => loadTroubleshootingScreen(),
    },
    {
      title: 'Restore previous version',
      detail: 'Use the last saved app version',
      open: async () => {
        await destructiveConfirm('Restore the previous app version?', {
          confirmButtonTitle: 'Restore',
          onConfirm: () => {
            doDowngrade()
            closeApp()
          },
        })
      },
    },
    {
      title: 'Reset saved settings',
      detail: 'Remove account and status from this script',
      destructive: true,
      open: async () => {
        await destructiveConfirm('Reset saved settings?', {
          confirmButtonTitle: 'Reset settings',
          onConfirm: () => {
            ;(bl ?? new Bluelink(getConfig())).deleteCache(true)
            deleteConfig()
            deleteWidgetCache()
            closeApp()
          },
        })
      },
    },
  ])
}

export async function loadTroubleshootingScreen() {
  return settingsForm<Pick<Config, 'debugLogging' | 'vehicleTypeOverride' | 'allowWidgetRemoteRefresh'>>({
    title: 'Troubleshooting',
    subtitle: 'Vehicle type is detected automatically by default.',
    onChange: async (values) => {
      if (values.allowWidgetRemoteRefresh && !getConfig().allowWidgetRemoteRefresh) {
        await confirm('Background vehicle refresh', {
          message: 'This can increase use of the vehicle’s 12V battery.',
          includeCancel: false,
        })
      }
      setConfig({ ...getConfig(), ...values })
    },
    fields: {
      debugLogging: { type: 'checkbox', label: 'Diagnostic logging' },
      vehicleTypeOverride: {
        type: 'dropdown',
        label: 'Vehicle detection',
        options: VEHICLE_TYPES,
        mapDisplayValue: (value) =>
          ({ auto: 'Automatic', ice: 'Petrol / diesel', hev: 'Hybrid', phev: 'Plug-in hybrid', ev: 'Electric' })[
            value
          ] ?? value,
      },
      allowWidgetRemoteRefresh: { type: 'checkbox', label: 'Refresh from vehicle', section: 'Widget connection' },
    },
  })(getConfig())
}

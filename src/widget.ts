import {
  getIconName,
  getTintedIconAsync,
  getBatteryPercentColor,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
  getChargingPowerString,
  sleep,
  tintSFSymbol,
} from './lib/util'
import { Bluelink, Status } from './lib/bluelink-regions/base'
import { Config } from 'config'
import { Logger } from './lib/logger'

// Widget Config
const DARK_BG_COLOR = '000000'
const LIGHT_BG_COLOR = 'FFFFFF'

const KEYCHAIN_WIDGET_REFRESH_KEY = 'bluelocke-widget'
const LEGACY_KEYCHAIN_WIDGET_REFRESH_KEY = 'bluelink-widget-legacy'

// Definition of Day/Night Hours
const NIGHT_HOUR_START = 23
const NIGHT_HOUR_STOP = 7

let WIDGET_LOGGER: Logger | undefined = undefined
const WIDGET_LOG_FILE = `${Script.name().replaceAll(' ', '')}-widget.log`

interface WidgetRefreshCache {
  lastRemoteRefresh: number
  lastCommand: 'API' | 'REMOTE'
}

const DEFAULT_WIDGET_CACHE = {
  lastRemoteRefresh: 0,
  lastCommand: 'API',
} as WidgetRefreshCache

interface WidgetRefresh {
  nextRefresh: Date
  status: Status
}

function isDarkMode(config: Config): boolean {
  const appearance = (config.widgetAppearance || 'system').toLowerCase()
  switch (appearance) {
    case 'dark':
      return true
    case 'white':
      return false
    default:
      return Device.isUsingDarkAppearance()
  }
}

function getBgColor(config: Config): Color {
  return isDarkMode(config) ? new Color(DARK_BG_COLOR) : new Color(LIGHT_BG_COLOR)
}

function getPrimaryTextColor(config: Config): Color {
  return isDarkMode(config) ? Color.white() : Color.black()
}

function getLockScreenPrimaryHex(): string {
  // Lock screen widgets always use a high-contrast palette, independent of home-screen widget appearance.
  return '#ffffff'
}

function getLockScreenSecondaryHex(): string {
  return 'hsla(0, 0%, 100%, 0.35)'
}

function getLockScreenTextColor(): Color {
  return Color.white()
}

function getLockScreenBackgroundColor(): Color {
  return new Color('1C3E66', 0.45)
}

async function getWidgetIcon(iconKey: string, color: Color): Promise<Image> {
  const iconName = getIconName(iconKey)
  if (!iconName) return await getTintedIconAsync(iconKey)
  return (await tintSFSymbol(iconName, SFSymbol.named(iconName).image, color)).image
}

function getEnergyPercent(status: Status, bl: Bluelink): number | undefined {
  if (bl.supportsChargingFeatures()) return status.status.soc
  return typeof status.status.fuelLevel === 'number' ? status.status.fuelLevel : undefined
}

function getEnergyText(status: Status, bl: Bluelink): string {
  const energyPercent = getEnergyPercent(status, bl)
  if (bl.supportsChargingFeatures()) return `${status.status.soc.toString()}%`
  return typeof energyPercent === 'number' ? `Fuel ${energyPercent.toString()}%` : 'Fuel'
}

export function getWidgetLogger(): Logger {
  if (!WIDGET_LOGGER) WIDGET_LOGGER = new Logger(WIDGET_LOG_FILE, 100)
  return WIDGET_LOGGER
}

function getCacheKey(write = false): string {
  const scriptName = Script.name().replaceAll(' ', '')
  const newCacheKey = `bluelocke-widget-${scriptName}`
  const legacyScriptKey = `bluelink-widget-legacy-${scriptName}`
  if (write || Keychain.contains(newCacheKey)) return newCacheKey
  if (Keychain.contains(legacyScriptKey)) return legacyScriptKey
  if (Keychain.contains(LEGACY_KEYCHAIN_WIDGET_REFRESH_KEY)) return LEGACY_KEYCHAIN_WIDGET_REFRESH_KEY
  return KEYCHAIN_WIDGET_REFRESH_KEY
}

export function deleteWidgetCache() {
  Keychain.remove(getCacheKey(true))
}

async function waitForCommandSent(
  bl: Bluelink,
  sleepTime = 200,
  startTime = Date.now(),
  counter = 1,
): Promise<boolean> {
  const lastCommand = bl.getLastCommandSent()
  if (lastCommand && lastCommand > startTime) return true
  if (counter > 10) return false
  await sleep(sleepTime)
  return await waitForCommandSent(bl, sleepTime, startTime, counter + 1)
}

async function refreshDataForWidgetWithTimeout(bl: Bluelink, config: Config, timeout = 4000): Promise<WidgetRefresh> {
  const logger = getWidgetLogger()
  const fallback = {
    status: bl.getCachedStatus(),
    nextRefresh: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes by default if call timeouts
  } as WidgetRefresh

  let timeoutHit = false
  let timeoutResolve: ((value: WidgetRefresh) => void) | undefined = undefined
  const timeoutPromise = new Promise<WidgetRefresh>((resolve) => {
    timeoutResolve = resolve
  })
  const timeoutTimer = Timer.schedule(timeout, false, () => {
    timeoutHit = true
    if (config.debugLogging) logger.log(`Timeout refreshing data for widget - falling back to cached data`)
    if (timeoutResolve) timeoutResolve(fallback)
  })

  try {
    const result = await Promise.race([refreshDataForWidget(bl, config), timeoutPromise])
    if (!timeoutHit) timeoutTimer.invalidate()
    return result
  } catch (error) {
    timeoutTimer.invalidate()
    if (config.debugLogging) logger.log(`Widget refresh failed - using cached data. Error: ${JSON.stringify(error)}`)
    return fallback
  }
}

async function refreshDataForWidget(bl: Bluelink, config: Config): Promise<WidgetRefresh> {
  const logger = getWidgetLogger()

  const MIN_API_REFRESH_TIME = 300000 // 5 minutes

  // Day Intervals - day lasts for 16 days - in milliseconds
  const DEFAULT_STATUS_CHECK_INTERVAL_DAY = 3600 * config.widgetConfig.standardPollPeriod * 1000
  const DEFAULT_REMOTE_REFRESH_INTERVAL_DAY = 3600 * config.widgetConfig.remotePollPeriod * 1000
  const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY = 3600 * config.widgetConfig.chargingRemotePollPeriod * 1000

  // Night Intervals - night lasts for 8 hours - in milliseconds
  const DEFAULT_STATUS_CHECK_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightStandardPollPeriod * 1000
  const DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightRemotePollPeriod * 1000
  const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightChargingRemotePollPeriod * 1000

  let cache: WidgetRefreshCache | undefined = undefined
  const currentTimestamp = Date.now()
  const currentHour = new Date().getHours()

  // Set status periods based on day/night
  let DEFAULT_STATUS_CHECK_INTERVAL = DEFAULT_STATUS_CHECK_INTERVAL_NIGHT
  let DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL = DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT
  let DEFAULT_REMOTE_REFRESH_INTERVAL = DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT
  if (currentHour < NIGHT_HOUR_START && currentHour > NIGHT_HOUR_STOP) {
    DEFAULT_STATUS_CHECK_INTERVAL = DEFAULT_STATUS_CHECK_INTERVAL_DAY
    DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL = DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY
    DEFAULT_REMOTE_REFRESH_INTERVAL = DEFAULT_REMOTE_REFRESH_INTERVAL_DAY
  }

  if (Keychain.contains(getCacheKey())) {
    cache = {
      ...DEFAULT_WIDGET_CACHE,
      ...JSON.parse(Keychain.get(getCacheKey())),
    }
  }
  if (!cache) {
    cache = DEFAULT_WIDGET_CACHE
  }
  let status = bl.getCachedStatus()

  // Get last remote check from cached API and convert
  // then compare to cache.lastRemoteRefresh and use whatever value is greater
  // we have both as we may have requested a remote refresh and that request is still pending

  let lastRemoteCheck = status.status.lastRemoteStatusCheck
  lastRemoteCheck = lastRemoteCheck > cache.lastRemoteRefresh ? lastRemoteCheck : cache.lastRemoteRefresh

  // LOGIC for refresh within widget
  // 1.Force refresh if user opted in via config AND last remote check is older than:
  //   - DEFAULT_REMOTE_REFRESH_INTERVAL if NOT charging
  //   - DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL if charging
  // 2. Normal refresh if not #1
  // The time intervals vary based on day/night - with day being more frequent

  const chargeCompletionTime = status.status.isCharging
    ? status.status.lastRemoteStatusCheck + status.status.remainingChargeTimeMins * 60 * 1000
    : 0

  const chargingComplete = status.status.isCharging && chargeCompletionTime < currentTimestamp
  if (status.status.isCharging && config.debugLogging)
    logger.log(
      `Now:${currentTimestamp}, Charge Completion Time: ${chargeCompletionTime}, chargingComplete: ${chargingComplete}`,
    )

  const chargingAndOverRemoteRefreshInterval =
    status.status.isCharging && lastRemoteCheck + DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL < currentTimestamp

  const notChargingAndOverRemoteRefreshInterval =
    !status.status.isCharging && lastRemoteCheck + DEFAULT_REMOTE_REFRESH_INTERVAL < currentTimestamp

  // calculate next remote check - reset if calculated value is in the past
  // if charging ends before next remote check use charge end + 10 minutes
  const remoteRefreshInterval = status.status.isCharging
    ? DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL
    : DEFAULT_REMOTE_REFRESH_INTERVAL
  let nextRemoteRefreshTime = lastRemoteCheck + remoteRefreshInterval
  if (nextRemoteRefreshTime < currentTimestamp) nextRemoteRefreshTime = currentTimestamp + remoteRefreshInterval
  if (status.status.isCharging) {
    if (chargeCompletionTime + 10 * 60 * 1000 < nextRemoteRefreshTime) {
      nextRemoteRefreshTime = chargeCompletionTime + 10 * 60 * 1000
      if (nextRemoteRefreshTime < currentTimestamp) nextRemoteRefreshTime = currentTimestamp + 5 * 60 * 1000
    }
  }

  // nextAPIRefreshTime is always based on DEFAULT_STATUS_CHECK_INTERVAL as its the default option
  const nextAPIRefreshTime = currentTimestamp + DEFAULT_STATUS_CHECK_INTERVAL

  // choose the lowest of the two values.
  const lowestRefreshTime = nextAPIRefreshTime < nextRemoteRefreshTime ? nextAPIRefreshTime : nextRemoteRefreshTime
  let nextRefresh = new Date(lowestRefreshTime)

  try {
    if (
      config.allowWidgetRemoteRefresh &&
      cache.lastCommand !== 'REMOTE' &&
      (chargingComplete || chargingAndOverRemoteRefreshInterval || notChargingAndOverRemoteRefreshInterval)
    ) {
      // Note a remote refresh takes to long to wait for - so trigger it and set a small nextRefresh value to pick
      // up the remote data on the next widget refresh
      if (config.debugLogging) logger.log('Doing Remote Refresh')
      bl.getStatus(true, true) // no await deliberatly as it takes to long to complete

      //wait for getCar command to be completed + another 200ms to ensure the remote status command is sent
      const result = await waitForCommandSent(bl, 200)
      if (result) {
        await sleep(200)
        cache.lastRemoteRefresh = currentTimestamp
        cache.lastCommand = 'REMOTE'
        if (config.debugLogging) logger.log('Completed Remote Refresh')
      } else {
        if (config.debugLogging) logger.log('Remote status command failed to send')
      }
      nextRefresh = new Date(Date.now() + 5 * 60 * 1000)
    } else if (chargingComplete || currentTimestamp > status.status.lastStatusCheck + MIN_API_REFRESH_TIME) {
      if (config.debugLogging) logger.log('Doing API Refresh')
      status = await bl.getStatus(false, true)
      cache.lastCommand = 'API'
      if (config.debugLogging) logger.log('Completed API Refresh')
    }
  } catch (_error) {
    // ignore any API errors and just displayed last cached values in widget
    // we have no guarentee of network connection
  }

  Keychain.set(getCacheKey(true), JSON.stringify(cache))
  if (config.debugLogging)
    logger.log(
      `Current time: ${new Date().toLocaleString()}. cache: ${JSON.stringify(cache)}, Last Remote Check: ${new Date(lastRemoteCheck).toLocaleString()} Setting next widget refresh to ${nextRefresh.toLocaleString()}`,
    )

  return {
    nextRefresh: nextRefresh,
    status: status,
  }
}

export function createErrorWidget(message: string, config: Config) {
  const widget = new ListWidget()
  widget.setPadding(20, 10, 15, 15)

  const mainStack = widget.addStack()
  mainStack.layoutVertically()
  mainStack.addSpacer()

  // Add background color
  widget.backgroundColor = getBgColor(config)

  // Show app icon and title
  const titleStack = mainStack.addStack()
  const titleElement = titleStack.addText('Error')
  titleElement.textColor = Color.red()
  titleElement.font = Font.boldSystemFont(25)
  titleStack.addSpacer()

  mainStack.addSpacer()

  const messageElement = mainStack.addText(message)
  messageElement.textColor = getPrimaryTextColor(config)
  messageElement.font = Font.systemFont(15)
  messageElement.minimumScaleFactor = 0.5
  messageElement.lineLimit = 5
  mainStack.addSpacer()

  return widget
}

export async function createMediumWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status
  const primaryText = getPrimaryTextColor(config)
  const darkMode = isDarkMode(config)

  // Prepare image
  const appIcon = await bl.getCarImage()
  const title = bl.getVehicleDisplayName(status.car)

  // define widget and set date for when the next refresh should not occur before.
  const widget = new ListWidget()
  widget.setPadding(20, 5, 20, 15)
  widget.refreshAfterDate = refresh.nextRefresh

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  // Add background color
  widget.backgroundColor = getBgColor(config)

  // Show app icon and title
  const titleStack = mainStack.addStack()
  titleStack.layoutHorizontally()
  titleStack.addSpacer(8)
  const titleElement = titleStack.addText(title)
  titleElement.textColor = primaryText
  titleElement.textOpacity = darkMode ? 0.7 : 1
  titleElement.font = Font.mediumSystemFont(25)
  titleElement.minimumScaleFactor = 0.8
  titleElement.lineLimit = 1
  titleElement.leftAlignText()
  mainStack.addSpacer(2)

  const supportsCharging = bl.supportsChargingFeatures()
  const energyPercent = getEnergyPercent(status, bl)

  // Center Stack
  const contentStack = mainStack.addStack()
  contentStack.centerAlignContent()
  contentStack.addSpacer(4)
  const carImageElement = contentStack.addImage(appIcon)
  carImageElement.imageSize = new Size(220, 220 / (appIcon.size.width / appIcon.size.height))
  contentStack.addSpacer(4)

  // Battery Info
  const batteryInfoStack = contentStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.size = new Size(125, 100)
  batteryInfoStack.addSpacer(10)

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = supportsCharging ? status.status.soc : (energyPercent ?? 0)
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const chargingKw = getChargingPowerString(status.status.chargingPower)
  const odometer =
    status.car.odometer === undefined
      ? status.status.odometer
      : status.status.odometer >= status.car.odometer
        ? status.status.odometer
        : status.car.odometer
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)
  const twelveSoc = status.status.twelveSoc
  const rangeText = `~${status.status.range} ${bl.getDistanceUnit()}`

  // Top row: EV/PHEV -> range
  if (supportsCharging) {
    const topInfoStack = batteryInfoStack.addStack()
    topInfoStack.layoutHorizontally()
    topInfoStack.centerAlignContent()
    topInfoStack.addSpacer()
    const topRangeText = topInfoStack.addText(rangeText)
    topRangeText.font = Font.semiboldSystemFont(17)
    topRangeText.textColor = primaryText
    topRangeText.minimumScaleFactor = 0.7
    topRangeText.lineLimit = 1
    topRangeText.rightAlignText()
    topInfoStack.addSpacer()
  }
  batteryInfoStack.addSpacer(2)

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.layoutHorizontally()
  batteryPercentStack.addSpacer()
  batteryPercentStack.centerAlignContent()
  if (supportsCharging) {
    const batteryIconColor = batteryPercent > 70 ? Color.green() : Color.red()
    const batterySymbolElement = batteryPercentStack.addImage(await getWidgetIcon('twelve-volt', batteryIconColor))
    batterySymbolElement.imageSize = new Size(32, 24)
    const chargingIcon = getChargingIcon(isCharging, isPluggedIn, true)
    if (chargingIcon) {
      const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
      chargingElement.imageSize = new Size(28, 28)
    }

    batteryPercentStack.addSpacer(5)

    const batteryPercentText = batteryPercentStack.addText(getEnergyText(status, bl))
    batteryPercentText.textColor =
      supportsCharging && typeof energyPercent === 'number' ? getBatteryPercentColor(energyPercent) : primaryText
    batteryPercentText.font = Font.semiboldSystemFont(15)
    batteryPercentText.minimumScaleFactor = 0.65
    batteryPercentText.lineLimit = 1
  } else {
    const fuelText = batteryPercentStack.addText(getEnergyText(status, bl))
    fuelText.textColor = primaryText
    fuelText.font = Font.semiboldSystemFont(17)
    fuelText.minimumScaleFactor = 0.65
    fuelText.lineLimit = 1
    fuelText.rightAlignText()
  }

  if (!supportsCharging) {
    batteryInfoStack.addSpacer(2)
    const rangeBottomStack = batteryInfoStack.addStack()
    rangeBottomStack.layoutHorizontally()
    rangeBottomStack.addSpacer()
    const rangeBottomText = rangeBottomStack.addText(rangeText)
    rangeBottomText.textColor = primaryText
    rangeBottomText.font = Font.semiboldSystemFont(17)
    rangeBottomText.minimumScaleFactor = 0.7
    rangeBottomText.lineLimit = 1
    rangeBottomText.rightAlignText()
  }

  if (supportsCharging && isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime)
    const batteryChargingTimeStack = mainStack.addStack()
    batteryChargingTimeStack.layoutHorizontally()
    batteryChargingTimeStack.addSpacer()
    // batteryChargingTimeStack.addSpacer()

    const chargingSpeedElement = batteryChargingTimeStack.addText(`${chargingKw}`)
    chargingSpeedElement.font = Font.mediumSystemFont(14)
    chargingSpeedElement.textOpacity = 0.9
    chargingSpeedElement.textColor = primaryText
    chargingSpeedElement.rightAlignText()
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(
      await getTintedIconAsync('charging-complete-widget'),
    )
    chargingTimeIconElement.imageSize = new Size(17, 17)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumSystemFont(14)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = primaryText
    chargingTimeElement.rightAlignText()
  }
  mainStack.addSpacer(8)

  // Symmetric status footer: mileage (left) | last update (center) | 12V battery % (right)
  const summaryRow = mainStack.addStack()
  summaryRow.layoutHorizontally()
  summaryRow.centerAlignContent()

  const addSummaryCell = async (
    parent: WidgetStack,
    icon: string,
    text: string,
    align: 'left' | 'center' | 'right',
  ) => {
    const cell = parent.addStack()
    cell.layoutHorizontally()
    cell.centerAlignContent()
    if (align === 'right') cell.addSpacer()

    const iconColor =
      icon === 'odometer'
        ? new Color('#0A84FF')
        : icon === 'twelve-volt'
          ? twelveSoc > 70
            ? Color.green()
            : Color.red()
          : primaryText
    const img = cell.addImage(await getWidgetIcon(icon, iconColor))
    img.imageSize = new Size(18, 18)
    img.imageOpacity = 0.85
    cell.addSpacer(5)

    const label = cell.addText(text)
    label.font = Font.mediumSystemFont(12)
    label.textColor = primaryText
    label.textOpacity = 0.85
    label.minimumScaleFactor = 0.8
    label.lineLimit = 1
    if (align === 'left') cell.addSpacer()
  }

  const odometerText = `${Math.floor(Number(odometer)).toString()} ${bl.getDistanceUnit()}`
  const lastUpdatedText = lastSeen.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
  const twelveText = twelveSoc > 0 ? `${Math.floor(twelveSoc)}%` : '--'

  summaryRow.addSpacer()
  const leftCell = summaryRow.addStack()
  leftCell.size = new Size(88, 24)
  summaryRow.addSpacer()
  const centerCell = summaryRow.addStack()
  centerCell.size = new Size(88, 24)
  summaryRow.addSpacer()
  const rightCell = summaryRow.addStack()
  rightCell.size = new Size(88, 24)
  summaryRow.addSpacer()

  await addSummaryCell(leftCell, 'odometer', odometerText, 'left')
  await addSummaryCell(centerCell, 'last-update', lastUpdatedText, 'center')
  await addSummaryCell(rightCell, 'twelve-volt', `12V ${twelveText}`, 'right')

  return widget
}

export async function createSmallWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status
  const supportsCharging = bl.supportsChargingFeatures()
  const energyPercent = getEnergyPercent(status, bl)
  const primaryText = getPrimaryTextColor(config)

  // Prepare image
  const appIcon = await bl.getCarImage()
  // define widget and set date for when the next refresh should not occur before.
  const widget = new ListWidget()
  widget.setPadding(20, 10, 15, 15)
  widget.refreshAfterDate = refresh.nextRefresh

  const mainStack = widget.addStack()
  mainStack.layoutVertically()
  // mainStack.addSpacer()

  // Add background color
  widget.backgroundColor = getBgColor(config)

  // Show app icon and title
  const titleStack = mainStack.addStack()
  const appIconElement = titleStack.addImage(appIcon)
  appIconElement.imageSize = new Size(90, 90 / (appIcon.size.width / appIcon.size.height))
  // appIconElement.cornerRadius = 4

  // space
  if (!supportsCharging || !status.status.isCharging) mainStack.addSpacer()

  // Battery Info
  const batteryInfoStack = mainStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.addSpacer()

  // Range
  const rangeStack = batteryInfoStack.addStack()
  rangeStack.addSpacer()
  const rangeText = `Range ${status.status.range} ${bl.getDistanceUnit()}`
  const rangeElement = rangeStack.addText(rangeText)
  rangeElement.font = Font.mediumSystemFont(22)
  rangeElement.textColor = primaryText
  rangeElement.rightAlignText()
  // batteryInfoStack.addSpacer()

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = supportsCharging ? status.status.soc : (energyPercent ?? 0)
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const chargingKw = getChargingPowerString(status.status.chargingPower)
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  // Battery / fuel value block
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.addSpacer()
  batteryPercentStack.centerAlignContent()
  if (supportsCharging) {
    const batteryIconColor = batteryPercent > 70 ? Color.green() : Color.red()
    const batterySymbolElement = batteryPercentStack.addImage(await getWidgetIcon('twelve-volt', batteryIconColor))
    batterySymbolElement.imageSize = new Size(30, 22)
    const chargingIcon = supportsCharging ? getChargingIcon(isCharging, isPluggedIn, true) : undefined
    if (chargingIcon) {
      const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
      chargingElement.imageSize = new Size(28, 28)
    }

    const batteryPercentText = batteryPercentStack.addText(getEnergyText(status, bl))
    batteryPercentText.textColor =
      supportsCharging && typeof energyPercent === 'number' ? getBatteryPercentColor(energyPercent) : primaryText
    batteryPercentText.font = Font.mediumSystemFont(22)
  } else {
    const fuelText = batteryPercentStack.addText(getEnergyText(status, bl))
    fuelText.textColor = primaryText
    fuelText.font = Font.mediumSystemFont(22)
    fuelText.rightAlignText()
  }

  // batteryPercentStack.addSpacer(5)

  if (supportsCharging && isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime, 'short', true)
    const batteryChargingTimeStack = mainStack.addStack()
    batteryChargingTimeStack.layoutHorizontally()
    // batteryChargingTimeStack.addSpacer()
    batteryChargingTimeStack.addSpacer()

    const chargingSpeedElement = batteryChargingTimeStack.addText(`${chargingKw}`)
    chargingSpeedElement.font = Font.mediumSystemFont(13)
    chargingSpeedElement.textOpacity = 0.9
    chargingSpeedElement.textColor = primaryText
    chargingSpeedElement.leftAlignText()
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(
      await getTintedIconAsync('charging-complete-widget'),
    )
    chargingTimeIconElement.imageSize = new Size(17, 17)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumSystemFont(12)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = primaryText
    chargingTimeElement.rightAlignText()
  }
  mainStack.addSpacer()

  // Footer
  const footerStack = mainStack.addStack()
  footerStack.addSpacer() // hack - dynamic spacing doesnt seem to work that well here

  // Add last seen indicator - use consistent date format as spacing is hard coded, hence we need to control the length
  const lastSeenElement = footerStack.addText(lastSeen.toLocaleString(undefined, dateStringOptions) || 'unknown')
  lastSeenElement.lineLimit = 1
  lastSeenElement.font = Font.lightSystemFont(11)
  lastSeenElement.textOpacity = 0.6
  lastSeenElement.textColor = primaryText

  // mainStack.addSpacer()

  return widget
}

export async function createHomeScreenCircleWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status
  const supportsCharging = bl.supportsChargingFeatures()
  const energyPercent = getEnergyPercent(status, bl)
  const primaryHex = getLockScreenPrimaryHex()
  const secondaryHex = getLockScreenSecondaryHex()

  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh
  widget.backgroundColor = getLockScreenBackgroundColor()

  const progressStack = await progressCircle(
    widget,
    typeof energyPercent === 'number' ? energyPercent : 50,
    primaryHex,
    secondaryHex,
  )
  const mainIcon = supportsCharging
    ? status.status.isCharging
      ? SFSymbol.named('bolt.car')
      : SFSymbol.named('car.fill')
    : SFSymbol.named('car.fill')
  const wmainIcon = progressStack.addImage(mainIcon.image)
  wmainIcon.imageSize = new Size(36, 36)
  wmainIcon.tintColor = new Color(primaryHex)

  return widget
}

export async function createHomeScreenRectangleWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status
  const supportsCharging = bl.supportsChargingFeatures()
  const energyPercent = getEnergyPercent(status, bl)
  const primaryHex = getLockScreenPrimaryHex()
  const primaryText = getLockScreenTextColor()
  const secondaryHex = getLockScreenSecondaryHex()

  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh
  widget.backgroundColor = getLockScreenBackgroundColor()

  const widgetStack = widget.addStack()
  // widgetStack.addSpacer(5)
  widgetStack.layoutVertically()
  const mainStack = widgetStack.addStack()

  const iconStack = await progressCircle(
    mainStack,
    typeof energyPercent === 'number' ? energyPercent : 50,
    primaryHex,
    secondaryHex,
  )
  const mainIcon = supportsCharging
    ? status.status.isCharging
      ? SFSymbol.named('bolt.car')
      : SFSymbol.named('car.fill')
    : SFSymbol.named('car.fill')
  const wmainIcon = iconStack.addImage(mainIcon.image)
  wmainIcon.imageSize = new Size(36, 36)
  wmainIcon.tintColor = new Color(primaryHex)

  // Battery Info
  const batteryInfoStack = mainStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.addSpacer(5)

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)
  const rangeText = `~${status.status.range} ${bl.getDistanceUnit()}`
  const twelveSoc = status.status.twelveSoc
  const twelveText = twelveSoc > 0 ? `${Math.floor(twelveSoc).toString()}%` : '--'

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.centerAlignContent()
  batteryPercentStack.addSpacer()
  const chargingIcon = supportsCharging ? getChargingIcon(isCharging, isPluggedIn, true) : undefined
  if (chargingIcon) {
    const chargingElement = batteryPercentStack.addImage(await getWidgetIcon(chargingIcon, new Color(primaryHex)))
    chargingElement.imageSize = new Size(17, 17)
    chargingElement.rightAlignImage()
    batteryPercentStack.addSpacer(3)
  }
  const batteryPercentText = batteryPercentStack.addText(getEnergyText(status, bl))
  batteryPercentText.textColor =
    supportsCharging && typeof energyPercent === 'number' ? getBatteryPercentColor(energyPercent) : primaryText
  batteryPercentText.font = Font.boldSystemFont(17)

  const rangeStack = batteryInfoStack.addStack()
  rangeStack.centerAlignContent()
  rangeStack.addSpacer()
  const rangeElement = rangeStack.addText(rangeText)
  rangeElement.font = Font.boldSystemFont(17)
  rangeElement.textColor = primaryText
  rangeElement.rightAlignText()

  const auxBatteryStack = batteryInfoStack.addStack()
  auxBatteryStack.centerAlignContent()
  auxBatteryStack.addSpacer()
  const auxBatteryElement = auxBatteryStack.addText(`12V ${twelveText}`)
  auxBatteryElement.font = Font.mediumSystemFont(12)
  auxBatteryElement.textOpacity = 0.9
  auxBatteryElement.textColor = primaryText
  auxBatteryElement.rightAlignText()

  if (supportsCharging && isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime, 'short', true)
    const batteryChargingTimeStack = batteryInfoStack.addStack()

    // bug in dynamic spacing means we only set spacing if string is less than 10 characters
    if (chargeComplete.length < 10) {
      batteryChargingTimeStack.addSpacer()
    }

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(SFSymbol.named('clock.fill').image)
    chargingTimeIconElement.tintColor = new Color(primaryHex)
    chargingTimeIconElement.imageSize = new Size(16, 16)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumMonospacedSystemFont(12)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = primaryText
    chargingTimeElement.rightAlignText()
  }

  return widget
}

export async function createHomeScreenInlineWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status

  const supportsCharging = bl.supportsChargingFeatures()
  const energyPercent = getEnergyPercent(status, bl)
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = supportsCharging ? status.status.soc : (energyPercent ?? 50)
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)
  const primaryHex = 'hsla(0, 0%, 100%, 1.0)'
  const secondaryHex = getLockScreenSecondaryHex()
  const primaryText = getLockScreenTextColor()
  const twelveSoc = status.status.twelveSoc
  const twelveText = twelveSoc > 0 ? `${Math.floor(twelveSoc).toString()}%` : '--'

  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh
  widget.backgroundColor = getLockScreenBackgroundColor()

  const widgetStack = widget.addStack()
  widgetStack.layoutHorizontally()
  const mainStack = widgetStack.addStack()
  const chargingIcon = supportsCharging ? getChargingIcon(isCharging, isPluggedIn, true) : undefined

  const icon = await progressCircleIconImageWithSymbol(
    batteryPercent,
    primaryHex,
    secondaryHex,
    30,
    3,
    chargingIcon
      ? await getTintedIconAsync(chargingIcon)
      : supportsCharging
        ? SFSymbol.named('car.fill').image
        : SFSymbol.named('car.fill').image,
    chargingIcon ? 17 : supportsCharging ? 14 : 16,
  )

  const iconStack = mainStack.addStack()
  iconStack.addImage(icon)

  //Only one line of text allowed in this style of widget
  let rangeText = `~${status.status.range} ${bl.getDistanceUnit()}`
  if (!supportsCharging) {
    rangeText = `${getEnergyText(status, bl)} · ${rangeText}`
  } else if (isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime, 'short', true)
    rangeText = `${getEnergyText(status, bl)} · ${rangeText} \u{21BA} ${chargeComplete}`
  } else {
    rangeText = `${getEnergyText(status, bl)} · ${rangeText}`
  }
  rangeText += ` · 12V ${twelveText}`
  const textStack = mainStack.addStack()
  const inlineText = textStack.addText(rangeText)
  inlineText.textColor = primaryText

  return widget
}

async function progressCircle(
  on: ListWidget | WidgetStack,
  value = 50,
  colour = 'hsl(0, 0%, 100%)',
  background = 'hsl(0, 0%, 10%)',
  size = 60,
  barWidth = 5,
  padding = barWidth * 2,
) {
  if (value > 1) {
    value /= 100
  }
  if (value < 0) {
    value = 0
  }
  if (value > 1) {
    value = 1
  }

  const w = new WebView()
  await w.loadHTML('<canvas id="c"></canvas>')

  const base64 = await w.evaluateJavaScript(
    `
  let colour = "${colour}",
    background = "${background}",
    size = ${size}*3,
    lineWidth = ${barWidth}*3,
    percent = ${value * 100}
      
  let canvas = document.getElementById('c'),
    c = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  let posX = canvas.width / 2,
    posY = canvas.height / 2,
    onePercent = 360 / 100,
    result = onePercent * percent
  c.lineCap = 'round'
  c.beginPath()
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + 360) )
  c.strokeStyle = background
  c.lineWidth = lineWidth 
  c.stroke()
  c.beginPath()
  c.strokeStyle = colour
  c.lineWidth = lineWidth
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + result) )
  c.stroke()
  completion(canvas.toDataURL().replace("data:image/png;base64,",""))`,
    true,
  )
  const image = Image.fromData(Data.fromBase64String(base64))
  image.size = new Size(size, size)
  const stack = on.addStack()
  stack.size = new Size(size, size)
  stack.backgroundImage = image
  stack.centerAlignContent()
  // const padding = barWidth * 2
  stack.setPadding(padding, padding, padding, padding)

  return stack
}

async function progressCircleIconImageWithSymbol(
  value = 50,
  colour = 'hsl(0, 0%, 100%)',
  background = 'hsl(0, 0%, 10%)',
  size = 60,
  barWidth = 5,
  symbolImage?: Image,
  symbolSize?: number, // Now optional
) {
  if (value > 1) value /= 100
  if (value < 0) value = 0
  if (value > 1) value = 1

  let symbolBase64 = undefined
  let resolvedSymbolSize = symbolSize
  if (symbolImage) {
    symbolBase64 = Data.fromPNG(symbolImage).toBase64String()
    if (!resolvedSymbolSize) resolvedSymbolSize = Math.floor(size * 0.6)
  }

  const w = new WebView()
  const html = symbolBase64
    ? `<canvas id="c"></canvas><img id="icon" src="data:image/png;base64,${symbolBase64}" />`
    : `<canvas id="c"></canvas>`
  await w.loadHTML(html)

  const base64 = await w.evaluateJavaScript(
    `
  let colour = "${colour}",
    background = "${background}",
    size = ${size},
    lineWidth = ${barWidth},
    percent = ${value * 100},
    symbolSize = ${resolvedSymbolSize ?? 0}
      
  let canvas = document.getElementById('c'),
    c = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  let posX = canvas.width / 2,
    posY = canvas.height / 2,
    onePercent = 360 / 100,
    result = onePercent * percent
  c.lineCap = 'round'
  c.beginPath()
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + 360) )
  c.strokeStyle = background
  c.lineWidth = lineWidth 
  c.stroke()
  c.beginPath()
  c.strokeStyle = colour
  c.lineWidth = lineWidth
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + result) )
  c.stroke()
  // Draw SFSymbol PNG in center if present
  let img = document.getElementById('icon')
  if (img && symbolSize) {
    c.drawImage(img, posX - symbolSize/2, posY - symbolSize/2, symbolSize, symbolSize)
  }
  completion(canvas.toDataURL().replace("data:image/png;base64,",""))`,
    true,
  )
  return Image.fromData(Data.fromBase64String(base64))
}

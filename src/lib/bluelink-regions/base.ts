import { Config, VehicleTypeOverride } from '../../config'
import { defaultImage } from '../../resources/defaultImage'
import { resolveVehicleImage } from '../../resources/vehicle-images'
import { getCustomVehicleImage } from '../custom-vehicle-image'
import { loadApiVehiclePhoto } from '../vehicle-photo'
import { Logger } from '../logger'
import { registerLogSecrets, sanitizeLog } from '../log-sanitizer'
import { Buffer } from 'buffer'
import { AuthSessionStore, authIdentity, BACKGROUND_LOGIN_LEASE_MS, LOGIN_LEASE_MS } from '../auth-session'
import { UserFacingError } from '../user-error'
import { removeKeychainValue, scriptStorageKey } from '../storage'
import { httpsUrl, sameOrigin } from '../secure-url'
export const DEFAULT_STATUS_CHECK_INTERVAL = 3600 * 1000
export const MAX_COMPLETION_POLLS = 20
const BLUELINK_LOG_FILE = `${Script.name().replaceAll(' ', '')}-api.log`
const BLUELINK_RESPONSE_LOG_FILE = `${Script.name().replaceAll(' ', '')}-api-response.log`
const CAPTURE_NEXT_API_RESPONSE_KEY = `${Script.name().replaceAll(' ', '')}-capture-next-api-response`
const DEFAULT_API_HOST = 'mybluelink.ca'
const DEFAULT_API_DOMAIN = `https://${DEFAULT_API_HOST}/tods/api/`
export const WIDGET_REQUEST_TIMEOUT_SECS = 5
const AUTH_REQUEST_TIMEOUT_SECS = 30

export interface BluelinkTokens {
  accessToken: string
  refreshToken?: string
  expiry: number
  authCookie?: string
  authId?: string
  additionalTokens?: Record<string, string>
}

export interface BluelinkCar {
  id: string
  vin: string
  nickName: string
  modelName: string
  modelYear: string
  modelTrim?: string
  modelColour?: string
  powertrain?: Exclude<VehicleTypeOverride, 'auto'>
  generation?: number
  photoUrl?: string | null
  odometer?: number
  europeccs2?: number
}

export interface BluelinkStatus {
  lastStatusCheck: number
  lastRemoteStatusCheck: number
  isCharging: boolean
  isPluggedIn: boolean
  chargingPower: number
  remainingChargeTimeMins: number
  range: number
  locked: boolean
  climate: boolean
  soc: number
  fuelLevel?: number
  supportsChargeCommands?: boolean
  twelveSoc: number
  odometer: number
  chargeLimit?: ChargeLimit
  location?: Location
}

export interface Status {
  car: BluelinkCar
  status: BluelinkStatus
}

export interface Cache {
  token: BluelinkTokens
  car: BluelinkCar
  status: BluelinkStatus
}

export interface RequestProps {
  url: string
  data?: string
  method?: string
  noAuth?: boolean
  headers?: Record<string, string>
  validResponseFunction: (resp: Record<string, any>, data: Record<string, any>) => { valid: boolean; retry: boolean }
  noRetry?: boolean
  notJSON?: boolean
  noRedirect?: boolean
  authTokenOverride?: string
  disableAdditionalHeaders?: boolean
}

export interface DebugLastRequest {
  url: string
  method: string
  data?: string
  headers: Record<string, string>
}

export interface TempConversion {
  F: number[]
  C: number[]
  H: string[]
}

export interface SeatClimate {
  driver: number
  passenger: number
  rearLeft: number
  rearRight: number
}

export interface ClimateRequest {
  enable: boolean
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  temp: number
  tempType?: 'C' | 'F'
  durationMinutes: number
  seatClimateOption?: SeatClimate
}

export interface ChargeLimit {
  acPercent: number
  dcPercent: number
}

export interface Location {
  latitude: string
  longitude: string
}

const normalizeVehicleText = (value: string | undefined): string => {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const normalizeVehicleToken = (value: string | undefined): string => {
  return normalizeVehicleText(value).replace(/\s+/g, '')
}

const titleCaseVehicleWord = (word: string): string => {
  const lower = word.toLocaleLowerCase()
  if (!lower) return ''
  if (/^\d+$/.test(lower)) return lower

  const specialWords: Record<string, string> = {
    ev: 'EV',
    hev: 'HEV',
    phev: 'PHEV',
    xrt: 'XRT',
    sel: 'SEL',
    se: 'SE',
    ex: 'EX',
    lx: 'LX',
    gt: 'GT',
    awd: 'AWD',
    fwd: 'FWD',
    rwd: 'RWD',
  }

  return specialWords[lower] ?? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

const titleCaseVehicleText = (value: string): string => {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => titleCaseVehicleWord(part))
    .join(' ')
}

const KNOWN_TRIM_LABELS: Array<{ matcher: RegExp; label: string }> = [
  { matcher: /\bn[\s-]?line\b/i, label: 'N Line' },
  { matcher: /\bxrt\b/i, label: 'XRT' },
  { matcher: /\bpreferred\b/i, label: 'Preferred' },
  { matcher: /\bult(?:imate)?\b/i, label: 'Ultimate' },
  { matcher: /\blimited\b/i, label: 'Limited' },
  { matcher: /\bcalligraphy\b/i, label: 'Calligraphy' },
  { matcher: /\bgt[\s-]?line\b/i, label: 'GT-Line' },
  { matcher: /\bsel\b/i, label: 'SEL' },
  { matcher: /\bse\b/i, label: 'SE' },
  { matcher: /\bex\b/i, label: 'EX' },
  { matcher: /\blx\b/i, label: 'LX' },
]

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const cleanVehicleModelName = (modelName: string | undefined, modelYear: string | undefined): string => {
  let model = (modelName ?? '').trim()
  if (!model) return ''

  if (modelYear) {
    model = model.replace(new RegExp(`^\\s*${escapeRegExp(modelYear)}\\b\\s*`, 'i'), '')
  } else {
    model = model.replace(/^\s*\d{4}\b\s*/i, '')
  }

  const looksBackendStyled = /[()/]/.test(model) || model === model.toLocaleUpperCase()
  if (looksBackendStyled) {
    model = model.replace(/\([^)]*\)/g, ' ')
    model = model.replace(/\b(?:hev|phev|ev)\s*\/\s*(?:hev|phev|ev)\b/gi, ' ')
    model = model.replace(/\b(?:hev|phev|ev|hybrid|electric)\b/gi, ' ')
    model = model.replace(/[_/]+/g, ' ')
    model = model.replace(/\s+/g, ' ').trim()
    model = titleCaseVehicleText(model)
  }

  return model.replace(/\s+/g, ' ').trim()
}

const inferVehicleTrimLabel = (modelName: string | undefined, modelTrim: string | undefined): string | undefined => {
  const haystack = `${modelName ?? ''} ${modelTrim ?? ''}`
  for (const option of KNOWN_TRIM_LABELS) {
    if (option.matcher.test(haystack)) return option.label
  }

  const trim = (modelTrim ?? '').trim()
  if (!trim || /[()]/.test(trim)) return undefined
  if (/^[A-Z0-9-]{4,}$/.test(trim)) return undefined
  if (!/[a-zA-Z]{3,}/.test(trim)) return undefined
  return titleCaseVehicleText(trim)
}

export function formatVehicleDisplayName(car: BluelinkCar, displayNameOverride?: string): string {
  if (displayNameOverride && displayNameOverride.trim().length > 0) {
    return displayNameOverride.trim()
  }

  const year = car.modelYear || ''
  const model = cleanVehicleModelName(car.modelName, year)
  const inferredTrim = inferVehicleTrimLabel(car.modelName, car.modelTrim)
  const normalizedModel = normalizeVehicleToken(model)
  const normalizedTrim = normalizeVehicleToken(inferredTrim)
  const trim = normalizedTrim && normalizedModel.includes(normalizedTrim) ? '' : (inferredTrim ?? '')

  const joined = [year, model, trim].filter((value) => value && value.trim().length > 0).join(' ')
  return joined || model || car.nickName || 'My Hyundai'
}

const vehicleTypeSupportsCharging = (vehicleType: VehicleTypeOverride): boolean | undefined => {
  switch (vehicleType) {
    case 'ev':
    case 'phev':
      return true
    case 'ice':
    case 'hev':
      return false
    default:
      return undefined
  }
}

const carImageHttpURL = 'https://bluelink.andyfase.com/app-assets/car-images/'
const carImageMap: Record<string, string> = {
  ioniq9: 'ioniq9',
  ioniq5n: 'ioniq5n',
  ioniq5: 'ioniq5',
  ioniq6: 'ioniq6',
  ioniq: 'ioniq',
  ev6: 'ev6',
  ev9: 'ev9',
  kona: 'kona',
  niro: 'niro',
  default: 'ioniq5',
}

export function getBluelinkLogger() {
  return new Logger(BLUELINK_LOG_FILE, 100)
}

export function getBluelinkResponseLogger() {
  return new Logger(BLUELINK_RESPONSE_LOG_FILE, 250)
}

export function queueNextApiResponseCapture() {
  const logger = getBluelinkResponseLogger()
  logger.clear()
  Keychain.set(CAPTURE_NEXT_API_RESPONSE_KEY, '1')
}

export function hasQueuedApiResponseCapture(): boolean {
  return Keychain.contains(CAPTURE_NEXT_API_RESPONSE_KEY)
}

function consumeQueuedApiResponseCapture(): boolean {
  if (!hasQueuedApiResponseCapture()) return false
  Keychain.remove(CAPTURE_NEXT_API_RESPONSE_KEY)
  return true
}

export class Bluelink {
  // @ts-ignore - config is initalized in init
  protected config: Config
  // @ts-ignore - cache is initalized in init
  protected cache: Cache
  protected vin: string | undefined
  protected statusCheckInterval: number
  protected apiHost: string
  protected apiDomain: string

  protected additionalHeaders: Record<string, string>
  protected authHeader: string
  protected tempLookup: TempConversion | undefined
  protected tokens: BluelinkTokens | undefined
  protected authIdHeader: string | undefined
  protected debugLastRequest: DebugLastRequest | undefined
  protected logger: any
  protected loginFailure: boolean
  protected loginRequiredWebview: boolean
  protected refreshLoginPromise: Promise<void> | undefined
  protected distanceUnit: string
  protected lastCommandSent: number | undefined
  protected authSession: AuthSessionStore
  protected loginLeaseOwner: string | undefined

  constructor(config: Config, vin?: string) {
    registerLogSecrets([config.auth.username, config.auth.password, config.auth.pin, config.displayNameOverride])
    this.config = config
    this.vin = vin
    this.apiDomain = DEFAULT_API_DOMAIN
    this.apiHost = DEFAULT_API_HOST
    this.statusCheckInterval = DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {}
    this.authHeader = 'Authentication'
    this.authSession = new AuthSessionStore(config)
    this.tokens = this.authSession.read()
    this.loginFailure = false
    this.loginRequiredWebview = false
    this.refreshLoginPromise = undefined
    this.loginLeaseOwner = undefined
    this.debugLastRequest = undefined
    this.tempLookup = undefined
    this.authIdHeader = undefined
    this.distanceUnit = 'km'
    this.logger = getBluelinkLogger()
  }

  protected async superInit(config: Config, refreshAuth: boolean, statusCheckInterval?: number) {
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL

    // check for cache - if not this is first login
    const existingCache = this.cacheExists()
    // loadCache will login user if the cache doesnt exist i.e first app use
    const cache = await this.loadCache()
    if (!cache) {
      this.loginFailure = true
      return
    }
    this.cache = cache
    if (existingCache && refreshAuth) await this.refreshLogin()
  }

  // this can be overridden in sub-classes to perfporm additional header manupulation
  protected getAdditionalHeaders(): Record<string, string> {
    return this.additionalHeaders
  }

  protected async refreshLogin(force?: boolean) {
    this.assertCurrentSession()
    if (this.refreshLoginPromise) {
      await this.refreshLoginPromise
      return
    }
    // if we are here we have logged in successfully at least once and can refresh if supported
    if (!(force || !this.tokenValid() || this.authSession.authRequired())) return

    this.refreshLoginPromise = (async () => {
      const background = config.runsInWidget || config.runsWithSiri
      const previous = this.tokens || this.cache?.token
      if (this.authSession.authRequired() && (config.runsInWidget || config.runsWithSiri)) {
        throw new UserFacingError(
          'Open Bluelocke in Scriptable to finish signing in. Background verification is paused.',
        )
      }
      const owner = this.authSession.acquireLogin(background ? BACKGROUND_LOGIN_LEASE_MS : LOGIN_LEASE_MS)
      if (!owner)
        throw new UserFacingError(
          'Sign-in is already in progress in another run. Wait a moment, then reopen Bluelocke in Scriptable.',
        )
      this.loginLeaseOwner = owner
      try {
        const shared = this.authSession.read()
        if (
          shared &&
          previous &&
          shared.accessToken !== previous.accessToken &&
          shared.expiry > Date.now() / 1000 + 30
        ) {
          this.tokens = shared
          if (this.cache) this.cache.token = shared
          this.loginFailure = false
          await this.onAuthRefreshed()
          return
        }
        let tokens: BluelinkTokens | undefined
        if (previous && typeof (this as any).refreshTokens === 'function' && !this.authSession.authRequired()) {
          // @ts-ignore - this is why we check the sub-class has this as its not always implemented
          tokens = await this.refreshTokens()
          if (!tokens) {
            tokens = await this.login() // fallback to normal login if refresh fails
          }
        } else {
          tokens = await this.login()
        }

        if (!tokens) {
          this.loginFailure = true
          this.authSession.requireForegroundAuth()
        } else {
          this.loginFailure = false
          // Keep authentication even if metadata/status loading fails afterwards.
          this.saveAuthSession(tokens)
          if (this.cache) {
            this.cache.token = tokens
            this.saveCache()
          }
          if (previous) await this.onAuthRefreshed()
        }
      } finally {
        this.loginLeaseOwner = undefined
        try {
          this.authSession.releaseLogin(owner)
        } catch {
          /* A reset/changed account already revoked this lease. */
        }
      }
    })()

    try {
      await this.refreshLoginPromise
    } finally {
      this.refreshLoginPromise = undefined
    }
  }

  protected saveAuthSession(tokens: BluelinkTokens) {
    this.assertCurrentSession()
    this.authSession.write(tokens)
    this.tokens = tokens
  }

  protected assertCurrentSession() {
    this.authSession.assertCurrent()
    if (this.loginLeaseOwner) this.authSession.renewLogin(this.loginLeaseOwner)
  }

  protected async onAuthRefreshed(): Promise<void> {}
  protected async onCacheLoaded(): Promise<void> {}

  protected getStamp(appId: string, cfbB64: string): string {
    const rawData = `${appId}:${Math.floor(Date.now() / 1000)}`
    const rawDataBytes = Buffer.from(rawData, 'utf-8')
    const cfbBytes = Buffer.from(cfbB64, 'base64')
    const minLen = Math.min(rawDataBytes.length, cfbBytes.length)
    const result = Buffer.alloc(minLen)

    for (let i = 0; i < minLen; i++) {
      result[i] = rawDataBytes[i]! ^ cfbBytes[i]!
    }
    return result.toString('base64')
  }

  public getLogger(): Logger {
    return this.logger
  }

  protected genRanHex(size: number): string {
    return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  protected getTimeZone(): string {
    const utcOffsetMinutes = new Date().getTimezoneOffset() * -1
    const absoluteMinutes = Math.abs(utcOffsetMinutes)
    const hours = Math.floor(absoluteMinutes / 60)
      .toString()
      .padStart(2, '0')
    const minutes = (absoluteMinutes % 60).toString().padStart(2, '0')
    return `${utcOffsetMinutes >= 0 ? '+' : '-'}${hours}:${minutes}`
  }

  protected getTimeZoneFull(): string {
    return this.getTimeZone()
  }

  protected getApiDomain(lookup: string, domains: Record<string, string>, _default: string): string {
    for (const [key, domain] of Object.entries(domains)) {
      if (key === lookup) return domain
    }
    return _default
  }

  protected getHeatingValue(rearDefrost: boolean, steering: boolean): number {
    // 0 = None
    // 2 = Back Defroster only
    // 3 = Steering Wheel only
    // 4 = Steering and Defroster
    if (!rearDefrost && !steering) return 0
    if (rearDefrost && steering) return 4
    if (rearDefrost) return 2
    if (steering) return 3
    return 0 // default
  }

  protected setLastCommandSent() {
    this.lastCommandSent = Date.now()
  }

  protected parseNumber(value: any): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return undefined
  }

  protected normalizePercent(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
    // Some APIs return ratio 0-1, normalize to 0-100.
    if (value > 0 && value <= 1) value = value * 100
    if (value < 0 || value > 100) return undefined
    return Math.round(value)
  }

  protected getFuelLevelFromStatus(status: any): number | undefined {
    const candidates = [
      status?.fuelLevel,
      status?.FuelLevel,
      status?.fuelLevelPercent,
      status?.FuelLevelPercent,
      status?.fuelLevelPrcnt,
      status?.fuel?.level,
      status?.Fuel?.Level,
      status?.fuel?.value,
      status?.Fuel?.Value,
      status?.fuel?.percent,
      status?.Fuel?.Percent,
      status?.fuelInfo?.level,
      status?.FuelInfo?.Level,
      status?.engineStatus?.fuelLevel,
      status?.EngineStatus?.FuelLevel,
      status?.engineStatus?.fuel?.level,
      status?.EngineStatus?.Fuel?.Level,
      status?.vehicleStatus?.fuelLevel,
      status?.VehicleStatus?.FuelLevel,
      status?.status?.fuelLevel,
      status?.Status?.FuelLevel,
      status?.FuelSystem?.FuelLevel,
      status?.FuelSystem?.Level,
      status?.fuellevel,
    ]

    for (const candidate of candidates) {
      const normalized = this.normalizePercent(this.parseNumber(candidate))
      if (typeof normalized === 'number') return normalized
    }
    return undefined
  }

  protected getRangeFromStatus(status: any, preferElectricRange = false): number {
    const rangeByFuel = status?.evStatus?.drvDistance?.[0]?.rangeByFuel
    // ICE vehicles often omit evStatus entirely. Other models return a partial
    // evStatus with fuel range but no traction-battery reading.
    const candidates = [
      ...(preferElectricRange ? [rangeByFuel?.evModeRange] : []),
      rangeByFuel?.totalAvailableRange,
      rangeByFuel?.gasModeRange,
      status?.dte,
      status?.distanceToEmpty,
      ...(!preferElectricRange ? [rangeByFuel?.evModeRange] : []),
    ]

    for (const candidate of candidates) {
      const value = this.parseNumber(candidate?.value)
      if (typeof value !== 'number' || value <= 0) continue
      // Legacy Bluelink distance units: 1 = km, 3 = miles. When omitted,
      // retain the regional API's native unit.
      const unit = this.parseNumber(candidate?.unit)
      const converted =
        unit === 1 && this.distanceUnit === 'mi'
          ? value / 1.609344
          : unit === 3 && this.distanceUnit === 'km'
            ? value * 1.609344
            : value
      return Math.floor(converted)
    }
    // Zero range is sometimes a placeholder in otherwise successful responses.
    return this.cache?.status.range ?? 0
  }

  protected getTwelveVoltSocFromStatus(status: any): number {
    const candidates = [status?.battery?.batSoc, status?.batteryStatus?.stateOfCharge]
    for (const candidate of candidates) {
      const value = this.parseNumber(candidate)
      // These fields contain percentages, not 0–1 ratios. Ignore unavailable
      // sentinel values such as 255 rather than overwriting a cached reading.
      if (typeof value === 'number' && value >= 0 && value <= 100) return value
    }
    return this.cache?.status.twelveSoc ?? 0
  }

  protected defaultNoEVStatus(
    lastRemoteCheck: Date,
    status: any,
    forceUpdate: boolean,
    odometer?: number,
    chargeLimit?: ChargeLimit,
    location?: Location,
  ): BluelinkStatus {
    const safeLastRemoteCheck = Number.isFinite(lastRemoteCheck?.getTime?.()) ? lastRemoteCheck.getTime() : Date.now()
    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: forceUpdate ? Date.now() : safeLastRemoteCheck,
      isCharging: this.cache ? this.cache.status.isCharging : false,
      isPluggedIn: this.cache ? this.cache.status.isPluggedIn : false,
      chargingPower: this.cache ? this.cache.status.chargingPower : 0,
      remainingChargeTimeMins: this.cache ? this.cache.status.remainingChargeTimeMins : 0,
      range: this.getRangeFromStatus(status),
      soc: this.cache ? this.cache.status.soc : 0,
      fuelLevel: this.getFuelLevelFromStatus(status) ?? (this.cache ? this.cache.status.fuelLevel : undefined),
      supportsChargeCommands: false,
      locked: status?.doorLock ?? (this.cache ? this.cache.status.locked : false),
      climate: Boolean(
        typeof status?.airCtrlOn !== 'undefined'
          ? status.airCtrlOn
          : status?.climate
            ? status.climate.airCtrl
            : this.cache
              ? this.cache.status.climate
              : false,
      ),
      twelveSoc: this.getTwelveVoltSocFromStatus(status),
      odometer: odometer !== undefined ? odometer : this.cache ? this.cache.status.odometer : 0,
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  public getDistanceUnit(): string {
    return this.distanceUnit
  }

  public getLastCommandSent(): number | undefined {
    return this.lastCommandSent
  }

  public supportsChargingFeatures(): boolean {
    if (!this.cache || !this.cache.status) return false
    const configuredChargingSupport = vehicleTypeSupportsCharging(this.config.vehicleTypeOverride || 'auto')
    if (typeof configuredChargingSupport === 'boolean') return configuredChargingSupport

    const status = this.cache.status
    const modelTokens = normalizeVehicleText(`${this.cache.car.modelName || ''} ${this.cache.car.modelTrim || ''}`)
    const tokenSet = new Set(modelTokens.split(/\s+/).filter((token) => token.length > 0))
    const mentionsHev = tokenSet.has('hev')
    const mentionsPhev = tokenSet.has('phev')
    const mentionsHybrid = tokenSet.has('hybrid')
    const likelyNonPlugHybrid = (mentionsHev || mentionsHybrid) && !mentionsPhev
    const ambiguousHevPhevLabel = mentionsHev && mentionsPhev
    const hasFuelLevel = typeof status.fuelLevel === 'number'
    const hasUsableSoc = typeof status.soc === 'number' && status.soc > 0
    const hasFuelOnlyHybridStatus =
      hasFuelLevel && !hasUsableSoc && !status.isPluggedIn && !status.isCharging && !status.chargeLimit

    if ((likelyNonPlugHybrid || ambiguousHevPhevLabel) && hasFuelOnlyHybridStatus) {
      return false
    }

    if (typeof status.supportsChargeCommands === 'boolean') {
      if (status.supportsChargeCommands && likelyNonPlugHybrid && !status.isPluggedIn && !status.isCharging) {
        return false
      }
      return status.supportsChargeCommands
    }
    if (likelyNonPlugHybrid && !status.isPluggedIn && !status.isCharging) return false
    return Boolean(
      status.isCharging ||
        status.isPluggedIn ||
        status.chargeLimit ||
        (typeof status.soc === 'number' && status.soc > 0 && typeof status.fuelLevel !== 'number'),
    )
  }

  public loginFailed(): boolean {
    return this.loginFailure
  }

  public needRestart(): boolean {
    return this.loginRequiredWebview
  }

  public getCachedStatus(): Status {
    this.assertCurrentSession()
    return {
      car: this.cache.car,
      status: this.cache.status,
    }
  }

  protected async statusAfterCommand(id: string): Promise<BluelinkStatus> {
    // The command has already been confirmed. A status refresh failure must not
    // turn that success into a failed command or cause another remote request.
    try {
      const status = await this.getCarStatus(id, false)
      this.assertCurrentSession()
      this.cache.status = status
      this.saveCache()
    } catch (error) {
      this.assertCurrentSession()
      this.logger.log('Command completed, but the follow-up status refresh failed.')
      this.logger.log(error)
    }
    return this.cache.status
  }

  public getVehicleDisplayName(car: BluelinkCar): string {
    return formatVehicleDisplayName(car, this.config.displayNameOverride)
  }

  public async refreshAuth(force = false): Promise<void> {
    return await this.refreshLogin(force)
  }

  public async getStatus(forceUpdate: boolean, noCache: boolean, location: boolean = false): Promise<Status> {
    this.assertCurrentSession()
    if (forceUpdate) {
      // getCar first then save then get remote status
      // widget remote refresh does not await for entire process to complete, and odometer in US is only on getCar calls, which need to complete and save to cache before sending remote status command
      // the remote status command will update the API servers in backgound - hence next normal status check will get the updated status data
      const car = await this.getCar()
      if (car) this.cache.car = car
      this.saveCache()
      this.setLastCommandSent()
      this.cache.status = await this.getCarStatus(this.cache.car.id, true, location)
      this.saveCache()
    } else if (noCache || this.cache.status.lastStatusCheck + this.statusCheckInterval < Date.now()) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, false, location)
      this.saveCache()
    }
    return {
      car: this.cache.car,
      status: this.cache.status,
    }
  }

  public async processRequest(
    type: string,
    input: any,
    callback: (isComplete: boolean, didSucceed: boolean, input: any | undefined) => void,
  ) {
    this.assertCurrentSession()
    let promise: Promise<any> | undefined = undefined
    let data: any | undefined = undefined
    let didSucceed = false
    switch (type) {
      case 'status':
        promise = this.getStatus(true, true)
        break
      case 'location':
        promise = this.getStatus(true, true, true)
        break
      case 'lock':
        promise = this.lock(this.cache.car.id)
        break
      case 'unlock':
        promise = this.unlock(this.cache.car.id)
        break
      case 'startCharge':
        if (!this.supportsChargingFeatures()) {
          throw Error('Charging features are not supported for this vehicle')
        }
        promise = this.startCharge(this.cache.car.id)
        break
      case 'stopCharge':
        if (!this.supportsChargingFeatures()) {
          throw Error('Charging features are not supported for this vehicle')
        }
        promise = this.stopCharge(this.cache.car.id)
        break
      case 'chargeLimit': {
        if (!this.supportsChargingFeatures()) {
          throw Error('Charge limit features are not supported for this vehicle')
        }
        if (!input) {
          throw Error('Must provide valid input for charge limit request!')
        }
        const inputChargeLimit = input as ChargeLimit
        promise = this.setChargeLimit(this.cache.car.id, inputChargeLimit)
        break
      }
      case 'climate': {
        if (!input) {
          throw Error('Must provide valid input for climate request!')
        }
        const inputClimate = input as ClimateRequest
        promise = inputClimate.enable ? this.climateOn(this.cache.car.id, input) : this.climateOff(this.cache.car.id)
        break
      }
      default:
        throw Error(`Unsupported request ${type}`)
    }
    let hasRequestCompleted = false
    const timer = Timer.schedule(500, true, async () => {
      if (!hasRequestCompleted) {
        callback(false, false, undefined)
      } else {
        timer.invalidate()
        if (this.config.debugLogging) this.logger.log(`Returning poll completion ${didSucceed}, data: ${data}`)
        callback(true, didSucceed, data)
      }
    })

    try {
      data = await promise
      hasRequestCompleted = true
      if (type === 'status' || type === 'location') {
        didSucceed = true
        data = data as Status
      } else {
        data = data as { isSuccess: boolean; data: BluelinkStatus }
        didSucceed = data.isSuccess
        data = data.data
      }
    } catch (error) {
      const e = error as Error
      hasRequestCompleted = true
      didSucceed = false
      data = e
    }
  }

  protected getCacheKey(): string {
    return scriptStorageKey('vehicle-cache')
  }

  public getConfig() {
    return this.config
  }

  public deleteCache(all = false) {
    this.assertCurrentSession()
    this.authSession.clear()
    removeKeychainValue(this.getCacheKey())
    if (all) removeKeychainValue('egmp-bluelink-cache')
  }

  protected saveCache() {
    this.assertCurrentSession()
    registerLogSecrets([
      this.cache.token.accessToken,
      this.cache.token.refreshToken,
      this.cache.token.authId,
      ...Object.values(this.cache.token.additionalTokens || {}),
      this.cache.car.id,
      this.cache.car.vin,
      ...(this.cache.car.nickName !== this.cache.car.modelName ? [this.cache.car.nickName] : []),
    ])
    Keychain.set(
      this.getCacheKey(),
      JSON.stringify({
        ...this.cache,
        identity: authIdentity(this.config),
        generation: this.authSession.generationId(),
        script: Script.name(),
      }),
    )
  }

  protected cacheExists(): boolean {
    return Keychain.contains(this.getCacheKey())
  }

  protected async loadCache(): Promise<Cache | undefined> {
    let cache: Cache | undefined = undefined
    if (Keychain.contains(this.getCacheKey())) {
      try {
        const stored = JSON.parse(Keychain.get(this.getCacheKey()))
        if (
          stored?.identity === authIdentity(this.config) &&
          stored?.script === Script.name() &&
          stored?.generation === this.authSession.generationId() &&
          stored?.token?.accessToken &&
          stored?.car?.id &&
          stored?.status
        )
          cache = stored
      } catch {
        /* Sign in again if a stored cache is damaged. */
      }
    }
    const hadCache = !!cache
    if (!cache) {
      // Authentication is independent of a complete vehicle/status snapshot.
      await this.refreshLogin()
      const tokens = this.tokens
      if (!tokens || this.loginFailure) {
        this.loginFailure = true
        return
      }
      const car = await this.getCar()
      if (!car) {
        this.loginFailure = true
        return
      }
      registerLogSecrets([car.id, car.vin, ...(car.nickName !== car.modelName ? [car.nickName] : [])])
      cache = {
        token: this.tokens!,
        car: car,
        status: await this.getCarStatus(car.id, false),
      }
    } else if (this.tokens) cache.token = this.tokens
    this.cache = cache
    this.tokens = cache.token
    if (hadCache) await this.onCacheLoaded()
    this.saveCache()
    return this.cache
  }

  protected tokenValid(): boolean {
    // invalid if within 30 seconds of expiry
    const tokens = this.tokens || this.cache?.token
    return Boolean(tokens && tokens.expiry - 30 > Math.floor(Date.now() / 1000))
  }

  protected nextRequestCookies(req: Request): string {
    let cookies = ''
    if (req.response.cookies) {
      for (const cookie of req.response.cookies) {
        cookies = cookies + `${cookie.name}=${cookie.value}; `
      }
      cookies = cookies.slice(0, -2)
    }
    return cookies
  }

  protected async request(props: RequestProps): Promise<{ resp: { [key: string]: any }; json: any; cookies: string }> {
    this.assertCurrentSession()
    let requestTokens: BluelinkTokens | undefined = undefined
    if (!props.noAuth) {
      requestTokens = this.tokens ? this.tokens : this.cache.token
    }
    if (!props.noAuth && !requestTokens) {
      throw Error('No tokens available for request')
    }
    if (requestTokens) {
      registerLogSecrets([
        requestTokens.accessToken,
        requestTokens.refreshToken,
        requestTokens.authCookie,
        requestTokens.authId,
        ...Object.values(requestTokens.additionalTokens || {}),
      ])
    }

    httpsUrl(props.url)
    const req = new Request(props.url)
    const usedAccessToken = requestTokens?.accessToken
    req.method = props.method ? props.method : props.data ? 'POST' : 'GET'
    req.headers = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(props.data &&
        !(props.headers && props.headers['Content-Type']) && {
          'Content-Type': 'application/json',
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.accessToken && {
          [this.authHeader]: props.authTokenOverride ? props.authTokenOverride : requestTokens.accessToken,
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.authCookie && {
          Cookie: requestTokens.authCookie,
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.authId &&
        this.authIdHeader && {
          [this.authIdHeader]: requestTokens.authId,
        }),
      ...(this.getAdditionalHeaders() && !props.disableAdditionalHeaders && { ...this.getAdditionalHeaders() }),
      ...(props.headers && {
        ...props.headers,
      }),
    }
    if (props.data) {
      req.body = props.data
    }
    // Never forward a credential-bearing request to another origin or HTTP.
    // Auth redirects may visit only the region's configured HTTPS hosts, using
    // a fresh GET with no password body or custom authentication headers.
    // @ts-ignore - Scriptable permits returning null to stop a redirect.
    req.onRedirect = (next: Request) => {
      if (props.noRedirect) return null
      try {
        const target = httpsUrl(next.url)
        if (sameOrigin(props.url, next.url)) return next
        if (!props.noAuth || !props.notJSON) return null
        const regional = (this as any).apiConfig
        const allowed = [httpsUrl(this.apiDomain).hostname, regional?.authHost, regional?.newApiDomain]
        if (!allowed.includes(target.hostname)) return null
        const redirect = new Request(next.url)
        redirect.method = 'GET'
        redirect.headers = { Accept: 'text/html,application/json' }
        redirect.timeoutInterval = req.timeoutInterval
        redirect.allowInsecureRequest = false
        return redirect
      } catch {
        return null
      }
    }
    if (config.runsInWidget) req.timeoutInterval = WIDGET_REQUEST_TIMEOUT_SECS
    else if (props.noAuth) req.timeoutInterval = AUTH_REQUEST_TIMEOUT_SECS
    req.allowInsecureRequest = false
    this.debugLastRequest = {
      url: props.url,
      method: req.method,
      headers: req.headers,
      ...(props.data && {
        data: req.body,
      }),
    }
    try {
      if (this.config.debugLogging) this.logger.log(`Sending request ${JSON.stringify(this.debugLastRequest)}`)
      const json = !props.notJSON ? await req.loadJSON() : await req.loadString()
      this.assertCurrentSession()
      if (this.config.debugLogging) {
        this.logger.log(
          `response ${JSON.stringify(req.response)} data: ${!props.notJSON ? JSON.stringify(json) : 'not JSON'}`,
        )
      }
      if (consumeQueuedApiResponseCapture()) {
        const payload = typeof json === 'string' ? json : JSON.stringify(json, null, 2)
        getBluelinkResponseLogger().log(
          [
            `URL: ${props.url}`,
            `Method: ${req.method}`,
            `Status: ${req.response?.statusCode || 'unknown'}`,
            'Payload:',
            payload,
          ].join('\n'),
        )
      }

      const checkResponse = props.validResponseFunction(req.response, json)
      const statusCode = Number(req.response?.statusCode)
      if (statusCode === 429 || statusCode >= 500) {
        throw new UserFacingError(
          'The vehicle service is temporarily unavailable. Your session has been kept; try again later.',
        )
      }
      if (!props.noRetry && checkResponse.retry && !props.noAuth) {
        // re-auth and call ourselves
        const latest = this.authSession.read()
        if (latest && latest.accessToken !== usedAccessToken && latest.expiry > Date.now() / 1000 + 30) {
          this.tokens = latest
          if (this.cache) this.cache.token = latest
          this.loginFailure = false
          await this.onAuthRefreshed()
        } else await this.refreshLogin(true)
        if (this.loginFailure) {
          return { resp: req.response, json: json, cookies: this.nextRequestCookies(req) }
        }
        return await this.request({
          ...props,
          noRetry: true,
        })
      }
      return { resp: req.response, json: json, cookies: this.nextRequestCookies(req) }
    } catch (error) {
      if (error instanceof UserFacingError) throw error
      const errorString = `Failed to send request to ${props.url}, request ${JSON.stringify(this.debugLastRequest)} - error ${error}`
      if (this.config.debugLogging) this.logger.log(error)
      if (props.noAuth && /timed?\s*out|timeout/i.test(String(error))) {
        throw new UserFacingError('Sign-in timed out. Check your connection, then try again in Scriptable.')
      }
      throw Error(sanitizeLog(errorString))
    }
  }

  public async getCarImage(
    carColour: string = 'white',
    forceRefresh = false,
    retryDefaultOnFail = true,
    retryOriginalColour: string | undefined = undefined,
  ): Promise<Image> {
    const customImage = getCustomVehicleImage(this.cache.car.vin || this.cache.car.id)
    if (customImage) return customImage
    const fs = FileManager.local()
    const requestedColorForOverride = retryOriginalColour
    const inferredTrim = inferVehicleTrimLabel(this.cache.car.modelName, this.cache.car.modelTrim)
    const vehicleImageOverride = resolveVehicleImage({
      manufacturer: this.config.manufacturer,
      modelName: this.cache.car.modelName,
      modelYear: this.cache.car.modelYear,
      modelTrim: this.cache.car.modelTrim,
      trimHint: inferredTrim,
      modelColour: this.cache.car.modelColour,
      requestedColor: requestedColorForOverride,
    })
    if (vehicleImageOverride) {
      const localOverridePath = `${fs.libraryDirectory()}/${vehicleImageOverride.cacheKey}`
      try {
        if (!forceRefresh && fs.fileExists(localOverridePath)) {
          const image = fs.readImage(localOverridePath)
          if (image && image.size.width > 0 && image.size.height > 0) return image
        }
      } catch {
        /* try the source again if the cached image is damaged */
      }
      try {
        let image: Image | undefined
        if (vehicleImageOverride.imageBase64) {
          image = Image.fromData(Data.fromBase64String(vehicleImageOverride.imageBase64))
        } else if (vehicleImageOverride.imageUrl) {
          const req = new Request(vehicleImageOverride.imageUrl)
          req.method = 'GET'
          if (config.runsInWidget) req.timeoutInterval = WIDGET_REQUEST_TIMEOUT_SECS
          image = await req.loadImage()
        }
        if (image && image.size.width > 0 && image.size.height > 0) {
          try {
            fs.writeImage(localOverridePath, image)
          } catch {
            /* display the downloaded image even if its cache cannot be saved */
          }
          return image
        }
      } catch (error) {
        if (this.config.debugLogging) this.logger.log(`Failed loading override image ${JSON.stringify(error)}`)
      }
    }

    const apiPhoto = await loadApiVehiclePhoto(
      this.cache.car.photoUrl,
      [
        this.config.manufacturer,
        this.config.auth?.region || '',
        this.config.auth?.username || '',
        this.cache.car.vin || this.cache.car.id,
      ],
      forceRefresh,
      config.runsInWidget ? WIDGET_REQUEST_TIMEOUT_SECS : undefined,
    )
    if (apiPhoto) return apiPhoto
    return this.getDefaultCarImage(carColour, forceRefresh, retryDefaultOnFail, retryOriginalColour)
  }

  private async getDefaultCarImage(
    carColour: string,
    forceRefresh: boolean,
    retryDefaultOnFail: boolean,
    retryOriginalColour?: string,
  ): Promise<Image> {
    const fs = FileManager.local()
    let carFilePrefix = ''
    for (const [name, fileName] of Object.entries(carImageMap)) {
      if (this.cache.car.modelName.toLocaleLowerCase().replaceAll(' ', '').includes(name)) {
        carFilePrefix = fileName
        break
      }
    }
    if (!carFilePrefix) carFilePrefix = carImageMap['default']!

    const localFilePath = retryOriginalColour
      ? `${fs.libraryDirectory()}/${carFilePrefix}_${retryOriginalColour}.png`
      : `${fs.libraryDirectory()}/${carFilePrefix}_${carColour}.png`
    try {
      if (!forceRefresh && fs.fileExists(localFilePath)) {
        const image = fs.readImage(localFilePath)
        if (image && image.size.width > 0 && image.size.height > 0) return image
      }
    } catch {
      /* replace a damaged default image or use the embedded fallback */
    }

    // download and store image
    const req = new Request(`${carImageHttpURL}/${carFilePrefix}/${carColour}.png`)
    req.method = 'GET'
    if (config.runsInWidget) req.timeoutInterval = WIDGET_REQUEST_TIMEOUT_SECS

    try {
      const image = await req.loadImage()
      fs.writeImage(localFilePath, image)
      return image
    } catch (_error) {
      // retry with white which always exists - save as requested colour so we dont keep retrying all the time.
      if (retryDefaultOnFail) return await this.getDefaultCarImage('white', false, false, carColour)
      return Image.fromData(Data.fromBase64String(defaultImage))
    }
  }

  protected async sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      Timer.schedule(milliseconds, false, () => resolve())
    })
  }

  // helper function to extract a parameter from header / cookie etc - as the Bluelink API changes case frequently
  protected caseInsensitiveParamExtraction(key: string, data: Record<string, any>): string | undefined {
    if (Object.hasOwn(data, key)) return data[key] // check for exact match first

    const lowerKey = key.toLowerCase()
    for (const [k, v] of Object.entries(data)) {
      if (lowerKey === k.toLowerCase()) return v
    }
    return undefined
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async getCarStatus(
    _id: string,
    _forceUpdate: boolean,
    _location: boolean = false,
  ): Promise<BluelinkStatus> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async getCar(): Promise<BluelinkCar | undefined> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async lock(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async unlock(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async startCharge(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async stopCharge(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async climateOn(
    _id: string,
    _config: ClimateRequest,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async climateOff(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async setChargeLimit(
    _id: string,
    _config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }
}

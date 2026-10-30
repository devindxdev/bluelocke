import { getVehiclePhotoUrl } from '../vehicle-photo'
import { climateFahrenheit, remoteEngineDuration } from '../us-climate'
import { UserFacingError } from '../user-error'
import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
  MAX_COMPLETION_POLLS,
  ChargeLimit,
  Location,
} from './base'
import { Config } from '../../config'
import { isNotEmptyObject } from '../util'
import { textInput } from '../scriptable-utils/'
import { returnMockedCarStatus, returnMockedCar } from './mock'

const DEFAULT_API_DOMAIN = 'api.owners.kia.com'
const LOGIN_EXPIRY = 24 * 60 * 60
const MFA_RESEND_COOLDOWN_MS = 2 * 60 * 1000
const MFA_CHALLENGE_MAX_AGE_MS = 10 * 60 * 1000
const MOCK_API = false

interface MFAResponse {
  rmtoken: string
  sid?: string
}

interface PendingMfa {
  sentAt: number
  type: 'EMAIL' | 'SMS'
  otpKey: string
  xid: string
  verifiedSid?: string
  rmToken?: string
}

function canPromptForMfa(): boolean {
  return !config.runsInWidget && !config.runsWithSiri
}

export class BluelinkUSAKia extends Bluelink {
  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = 'mi'
    this.apiDomain = `https://${DEFAULT_API_DOMAIN}/apigw/v1/`

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      from: 'SPA',
      language: '0',
      offset: this.getTimeZone().slice(0, 3),
      appType: 'L',
      appVersion: '7.22.0',
      clientuuid: this.authSession.getDeviceId('clientuuid', () => UUID.string().toLocaleLowerCase()),
      clientId: 'SPACL716-APL',
      phonebrand: 'iPhone',
      osType: 'iOS',
      osVersion: '15.8.5',
      secretKey: 'sydnat-9kykci-Kuhtep-h5nK',
      to: 'APIGW',
      tokentype: 'A',
      'User-Agent': 'KIAPrimo_iOS/37 CFNetwork/1335.0.3.4 Darwin/21.6.0',
      deviceId: this.authSession.getDeviceId('deviceId', () => this.generateDeviceId()),
      Host: DEFAULT_API_DOMAIN,
    }

    this.authHeader = 'sid'
    this.authIdHeader = 'vinkey'
  }

  static async init(config: Config, refreshAuth: boolean, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkUSAKia(config, statusCheckInterval)
    await obj.superInit(config, refreshAuth)
    return obj
  }

  protected generateDeviceId(): string {
    return `${this.genRanHex(22)}:${this.genRanHex(9)}_${this.genRanHex(10)}-${this.genRanHex(5)}_${this.genRanHex(22)}_${this.genRanHex(8)}-${this.genRanHex(18)}-_${this.genRanHex(22)}_${this.genRanHex(17)}`
  }

  protected getAdditionalHeaders(): Record<string, string> {
    const remembered = this.tokens?.additionalTokens ?? this.cache?.token.additionalTokens
    if (remembered?.deviceId) this.additionalHeaders.deviceId = remembered.deviceId
    if (remembered?.clientuuid) this.additionalHeaders.clientuuid = remembered.clientuuid
    return this.additionalHeaders
  }

  protected async onAuthRefreshed(): Promise<void> {
    const car = await this.getCar(true)
    if (car && this.cache) {
      this.cache.car = car
      this.saveCache()
    }
  }

  protected async onCacheLoaded(): Promise<void> {
    const tokens = this.tokens ?? this.cache.token
    // A renewed SID can survive an interrupted vehicle-list request. Recover
    // its vehicle key before using an older completed status snapshot.
    if (this.tokenValid() && (!tokens.authId || tokens.authId !== this.cache.car.id)) {
      await this.onAuthRefreshed()
    }
  }

  private getDateString(): string {
    return new Date()
      .toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZone: 'Europe/London',
        timeZoneName: 'short',
      })
      .replace(' at', '')
  }

  private requestResponseValid(
    resp: Record<string, any>,
    data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    const status = Number(resp?.statusCode ?? 200)
    if (status === 401 || status === 403) return { valid: false, retry: true }
    // Rate limits, outages and command failures do not invalidate a login.
    if (status !== 200) return { valid: false, retry: false }
    if (data?.status?.statusCode === 0 || data?.status?.statusCode === '0') return { valid: true, retry: false }
    // Kia's explicit invalid-session responses, also used by the upstream
    // Hyundai-Kia-Connect KiaUvoApiUSA implementation.
    const expired =
      Number(data?.status?.statusCode) === 1 &&
      Number(data?.status?.errorType) === 1 &&
      [1003, 1005].includes(Number(data?.status?.errorCode))
    return { valid: false, retry: expired }
  }

  private getPendingMfa(): PendingMfa | undefined {
    const pending = this.authSession.readMfa<PendingMfa>()
    if (!pending) return undefined
    if (
      (pending.type !== 'EMAIL' && pending.type !== 'SMS') ||
      !pending.otpKey ||
      !pending.xid ||
      !Number.isFinite(pending.sentAt) ||
      Date.now() - pending.sentAt >= MFA_CHALLENGE_MAX_AGE_MS
    ) {
      this.authSession.clearMfa()
      return undefined
    }
    return pending
  }

  private requireMfaInApp(): never {
    this.authSession.requireForegroundAuth()
    throw new UserFacingError('Open Bluelocke in Scriptable to finish Kia sign-in and enter your verification code.')
  }

  protected async mfa(type: 'EMAIL' | 'SMS', code: string, xid: string): Promise<BluelinkTokens | undefined> {
    this.authSession.requireForegroundAuth()
    if (!canPromptForMfa()) return this.requireMfaInApp()

    let pending = this.getPendingMfa()
    if (!pending || pending.otpKey !== code || pending.xid !== xid) {
      const lastSent = this.authSession.getMfaSentAt()
      if (lastSent && Date.now() - lastSent < MFA_RESEND_COOLDOWN_MS) {
        throw new UserFacingError(
          'A verification code was requested recently. Wait two minutes before requesting another.',
        )
      }
      if (!code || !xid) {
        throw new UserFacingError('Kia did not provide a verification challenge. Please try signing in later.')
      }
      pending = { sentAt: Date.now(), type, otpKey: code, xid }
      // Record the send before the request: a timeout can still deliver a code.
      this.authSession.markMfaSent()
      this.authSession.writeMfa(pending)
      const sent = await this.request({
        url: this.apiDomain + 'cmm/sendOTP',
        data: '{}',
        headers: { date: this.getDateString(), otpkey: code, notifytype: type, xid },
        noAuth: true,
        validResponseFunction: this.requestResponseValid,
      })
      if (!this.requestResponseValid(sent.resp, sent.json).valid) {
        this.authSession.clearMfa()
        if (this.config.debugLogging) this.logger.log(`Kia MFA send failed: ${JSON.stringify(sent.json)}`)
        throw new UserFacingError('Kia could not send a verification code. Wait two minutes before trying again.')
      }
    }

    if (pending.verifiedSid) return this.login({ sid: pending.verifiedSid, rmtoken: pending.rmToken || '' })
    const mfaCode = await textInput(`Enter the verification code already sent via ${pending.type.toLowerCase()}.`, {
      submitText: 'Enter Code',
      flavor: 'number',
    })
    if (!mfaCode) {
      throw new UserFacingError('Code entry cancelled. Reopen Bluelocke to enter the same verification code.')
    }
    const verified = await this.request({
      url: this.apiDomain + 'cmm/verifyOTP',
      data: JSON.stringify({ otp: mfaCode }),
      headers: { date: this.getDateString(), otpkey: pending.otpKey, xid: pending.xid },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (!this.requestResponseValid(verified.resp, verified.json).valid) {
      if (this.config.debugLogging) this.logger.log(`Kia MFA verification failed: ${JSON.stringify(verified.json)}`)
      throw new UserFacingError('The verification code was not accepted. Reopen Bluelocke to try the code again.')
    }
    const sid = this.caseInsensitiveParamExtraction('sid', verified.resp.headers || {})
    const remembered =
      this.tokens?.additionalTokens ?? this.cache?.token.additionalTokens ?? this.authSession.read()?.additionalTokens
    const rmToken =
      this.caseInsensitiveParamExtraction('rmtoken', verified.resp.headers || {}) || remembered?.rmToken || ''
    if (!sid) throw new UserFacingError('Kia could not complete verification. Please try signing in later.')
    // Preserve a completed OTP step if the final login request times out.
    this.authSession.writeMfa({ ...pending, verifiedSid: sid, rmToken })
    return this.login({ sid, rmtoken: rmToken })
  }

  protected async login(mfaToken: MFAResponse | undefined = undefined): Promise<BluelinkTokens | undefined> {
    const pending = !mfaToken ? this.getPendingMfa() : undefined
    if (pending) {
      if (!canPromptForMfa()) return this.requireMfaInApp()
      return this.mfa(pending.type, pending.otpKey, pending.xid)
    }
    const remembered =
      this.tokens?.additionalTokens ??
      this.cache?.token.additionalTokens ??
      this.authSession.read()?.additionalTokens ??
      {}
    const rememberedToken = mfaToken?.rmtoken || remembered.rmToken
    const resp = await this.request({
      url: this.apiDomain + 'prof/authUser',
      data: JSON.stringify({
        deviceKey: this.getAdditionalHeaders().deviceId,
        deviceType: 2,
        tncFlag: 1,
        userCredential: { userId: this.config.auth.username, password: this.config.auth.password },
      }),
      headers: {
        date: this.getDateString(),
        ...(rememberedToken && { rmtoken: rememberedToken }),
        ...(mfaToken?.sid && { sid: mfaToken.sid }),
      },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const sid = this.caseInsensitiveParamExtraction('sid', resp.resp.headers || {})
      const xid = this.caseInsensitiveParamExtraction('xid', resp.resp.headers || {})
      if (!sid && xid && !mfaToken?.sid) {
        this.authSession.requireForegroundAuth()
        if (!canPromptForMfa()) return this.requireMfaInApp()
        return this.mfa(
          resp.json?.payload?.phoneVerifyStatus && this.config.mfaPreference === 'sms' ? 'SMS' : 'EMAIL',
          resp.json?.payload?.otpKey,
          xid,
        )
      }
      if (!sid) throw new UserFacingError('Kia did not complete sign-in. Please try again later.')
      const headers = this.getAdditionalHeaders()
      const tokens: BluelinkTokens = {
        accessToken: sid,
        refreshToken: '',
        expiry: Math.floor(Date.now() / 1000) + LOGIN_EXPIRY,
        additionalTokens: {
          ...remembered,
          rmToken: this.caseInsensitiveParamExtraction('rmtoken', resp.resp.headers || {}) || rememberedToken || '',
          deviceId: headers.deviceId || '',
          clientuuid: headers.clientuuid || '',
        },
      }
      this.tokens = tokens
      this.saveAuthSession(tokens)
      this.authSession.clearMfa()
      this.authSession.clearAuthRequired()
      return tokens
    }
    // Preserve the trusted device and remembered token on API failures.
    if (this.config.debugLogging) this.logger.log(`Kia login failed: ${JSON.stringify(resp.json)}`)
    return undefined
  }

  protected async getCar(noRetry = false): Promise<BluelinkCar | undefined> {
    if (MOCK_API) return returnMockedCar()
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + 'ownr/gvl',
      headers: {
        date: this.getDateString(),
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      noRetry: noRetry,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to retrieve vehicles: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.payload.vehicleSummary.length > 0) {
      let vehicle = resp.json.payload.vehicleSummary[0]
      if (vin) {
        for (const v of resp.json.payload.vehicleSummary) {
          if (v.vin === vin) {
            vehicle = v
            break
          }
        }
      }

      const car: BluelinkCar = {
        id: vehicle.vehicleKey,
        vin: vehicle.vin,
        photoUrl: getVehiclePhotoUrl(vehicle, 'https://owners.kia.com/') ?? null,
        nickName: vehicle.nickName,
        modelName: vehicle.modelName,
        modelYear: vehicle.modelYear,
        odometer: vehicle.mileage,
        modelColour: vehicle.colorName,
        modelTrim: vehicle.trim,
      }
      const tokens = this.tokens ?? this.cache?.token
      if (tokens) {
        this.tokens = { ...tokens, authId: car.id }
        this.saveAuthSession(this.tokens)
        if (this.cache) this.cache.token = this.tokens
      }
      return car
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(status: any, location?: Location): BluelinkStatus {
    const lastRemoteCheckString = status?.syncDate?.utc ? status.syncDate.utc + 'Z' : undefined
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const parsedLastRemoteCheck = lastRemoteCheckString ? df.date(lastRemoteCheckString) : undefined
    const lastRemoteCheck = parsedLastRemoteCheck ?? new Date()

    if (!status?.evStatus || typeof status.evStatus.batteryStatus !== 'number')
      return this.defaultNoEVStatus(lastRemoteCheck, status ?? {}, false, undefined, undefined, location)

    // check for charge limits
    const chargeLimit: ChargeLimit = {
      dcPercent: 0,
      acPercent: 0,
    }
    if (status.evStatus.targetSOC) {
      for (const limit of status.evStatus.targetSOC) {
        if (limit.plugType === 0) {
          chargeLimit.dcPercent = limit.targetSOClevel
        } else if (limit.plugType === 1) {
          chargeLimit.acPercent = limit.targetSOClevel
        }
      }
    }

    const remainingChargeTimeMins =
      status?.evStatus?.remainChargeTime?.[0]?.timeInterval?.value ??
      (this.cache ? this.cache.status.remainingChargeTimeMins : 0)
    const fuelLevel = this.getFuelLevelFromStatus(status) ?? (this.cache ? this.cache.status.fuelLevel : undefined)
    const supportsChargeCommands = Boolean(
      typeof status?.evStatus?.remainChargeTime?.[0]?.timeInterval?.value === 'number' ||
        status?.evStatus?.batteryPlugin > 0 ||
        status?.evStatus?.batteryCharge === true,
    )

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: lastRemoteCheck.getTime(),
      isCharging: Boolean(status?.evStatus?.batteryCharge),
      isPluggedIn: status?.evStatus?.batteryPlugin > 0 ? true : false,
      chargingPower: status?.evStatus?.batteryCharge ? status?.evStatus?.realTimePower : 0,
      remainingChargeTimeMins: remainingChargeTimeMins,
      range: this.getRangeFromStatus(status, true),
      locked: status?.doorLock ?? (this.cache ? this.cache.status.locked : false),
      climate: status?.climate?.airCtrl ?? (this.cache ? this.cache.status.climate : false),
      soc: status?.evStatus?.batteryStatus ?? (this.cache ? this.cache.status.soc : 0),
      fuelLevel: fuelLevel,
      supportsChargeCommands: supportsChargeCommands,
      twelveSoc: this.getTwelveVoltSocFromStatus(status),
      odometer: 0, // not given in status
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(
    _id: string,
    forceUpdate: boolean,
    location: boolean = false,
    retry = true,
  ): Promise<BluelinkStatus> {
    if (MOCK_API) return returnMockedCarStatus()
    if (!forceUpdate) {
      // as the request payload contains the authId - which is a auth param we disable retry and manage retry ourselves
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gvi',
        noRetry: true,
        data: JSON.stringify({
          vehicleConfigReq: {
            airTempRange: '0',
            maintenance: '0',
            seatHeatCoolOption: '0',
            vehicle: '1',
            vehicleFeature: '0',
          },
          vehicleInfoReq: {
            drivingActivty: '0',
            dtc: '1',
            enrollment: '0',
            functionalCards: '0',
            location: location ? '1' : '0',
            vehicleStatus: '1',
            weather: '0',
          },
          // handle cache existing or not - this is normally hidden in base class but need to hanle here as auth param used in payload
          vinKey: [this.tokens ? this.tokens.authId : this.cache.token.authId],
        }),
        headers: {
          date: this.getDateString(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(resp.resp, resp.json).valid) {
        let locationStatus = undefined
        if (location && resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location) {
          locationStatus = {
            latitude: resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location.coord.lat,
            longitude: resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location.coord.lon,
          } as Location
        }
        return this.returnCarStatus(
          resp.json.payload.vehicleInfoList[0].lastVehicleInfo.vehicleStatusRpt.vehicleStatus,
          locationStatus,
        )
      } else if (retry && this.requestResponseValid(resp.resp, resp.json).retry) {
        await this.refreshLogin(true)
        return await this.getCarStatus(_id, forceUpdate, location, false)
      }
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const resp = await this.request({
      url: this.apiDomain + 'rems/rvs',
      data: JSON.stringify({
        requestType: 0,
      }),
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      // only cached data contains latest location so return cached API after remote command
      return location
        ? await this.getCarStatus(_id, false, true)
        : this.returnCarStatus(resp.json.payload.vehicleStatusRpt.vehicleStatus)
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async pollForCommandCompletion(
    id: string,
    transactionId: string,
  ): Promise<{ isSuccess: boolean; data: any }> {
    let attempts = 0
    while (attempts <= MAX_COMPLETION_POLLS) {
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gts',
        data: JSON.stringify({
          xid: transactionId,
        }),
        headers: {
          date: this.getDateString(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // JSON payload looks like the below
      // Assumption is the command completed successfully if everything is zero, 1 means still going and 2 means failure?
      // At this point thats just a wild guess
      //
      // "payload": {
      //   "remoteStatus": 1,
      //   "calSyncStatus": 0,
      //   "alertStatus": 0,
      //   "locationStatus": 0,
      //   "evStatus": 0
      // }
      let complete = true
      for (const [k, v] of Object.entries(resp.json.payload)) {
        if (Number(v) === 1) {
          complete = false
        } else if (Number(v) > 1) {
          return {
            isSuccess: false,
            data: `${k} returned above 1 status: ${v}`,
          }
        }
      }
      if (complete) {
        return {
          isSuccess: true,
          data: await this.statusAfterCommand(id),
        }
      }
      attempts += 1
      await this.sleep(2000)
    }
    return {
      isSuccess: false,
      data: 'timeout on command completion',
    }
  }

  protected async lock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, true)
  }

  protected async unlock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, false)
  }

  protected async lockUnlock(id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = shouldLock ? 'rems/door/lock' : 'rems/door/unlock'

    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'GET',
      headers: {
        date: this.getDateString(),
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send lockUnlock command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async startCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, true)
  }

  protected async stopCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, false)
  }

  protected async chargeStopCharge(
    id: string,
    shouldCharge: boolean,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = shouldCharge ? 'evc/charge' : 'evc/cancel'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'GET',
      ...(shouldCharge && {
        data: JSON.stringify({
          chargeRatio: 100,
        }),
      }),
      headers: {
        date: this.getDateString(),
        ...(!shouldCharge && {
          'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
        }),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeStartStop command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  private seatSettings(level: number): { heatVentType: number; heatVentLevel: number; heatVentStep: number } {
    switch (level) {
      case 8: // High heat
        return { heatVentType: 1, heatVentLevel: 4, heatVentStep: 1 }
      case 7: // Medium heat
        return { heatVentType: 1, heatVentLevel: 3, heatVentStep: 2 }
      case 6: // Low heat
        return { heatVentType: 1, heatVentLevel: 2, heatVentStep: 3 }
      case 5: // High cool
        return { heatVentType: 2, heatVentLevel: 4, heatVentStep: 1 }
      case 4: // Medium cool
        return { heatVentType: 2, heatVentLevel: 3, heatVentStep: 2 }
      case 3: // Low cool
        return { heatVentType: 2, heatVentLevel: 2, heatVentStep: 3 }
      case 1: // Generically on, assume high heat
        return { heatVentType: 1, heatVentLevel: 4, heatVentStep: 1 }
      default: // Off
        return { heatVentType: 0, heatVentLevel: 1, heatVentStep: 0 }
    }
  }

  protected async climateOn(
    id: string,
    config: ClimateRequest,
    retryWithNoSeat = false,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'rems/start'
    const temperature = climateFahrenheit(config, this.config.tempType)
    const hasSeats = !!config.seatClimateOption && isNotEmptyObject(config.seatClimateOption)
    const resp = await this.request({
      url: this.apiDomain + api,
      data: JSON.stringify({
        remoteClimate: {
          airCtrl: true,
          defrost: config.frontDefrost,
          airTemp: {
            value: temperature < 62 ? 'LOW' : temperature > 82 ? 'HIGH' : temperature.toString(),
            unit: 1,
          },
          ignitionOnDuration: {
            unit: 4,
            value: this.supportsChargingFeatures()
              ? config.durationMinutes
              : remoteEngineDuration(config.durationMinutes),
          },
          heatingAccessory: {
            steeringWheel: Number(config.steering),
            rearWindow: Number(config.rearDefrost),
            sideMirror: Number(config.rearDefrost),
          },
          ...(config.seatClimateOption &&
            isNotEmptyObject(config.seatClimateOption) &&
            !retryWithNoSeat && {
              heatVentSeat: {
                driverSeat: this.seatSettings(config.seatClimateOption.driver),
                passengerSeat: this.seatSettings(config.seatClimateOption.passenger),
                rearLeftSeat: this.seatSettings(config.seatClimateOption.rearLeft),
                rearRightSeat: this.seatSettings(config.seatClimateOption.rearRight),
              },
            }),
        },
      }),
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
      throw new UserFacingError(
        'Climate request sent, but confirmation is unavailable. Check your vehicle before trying again.',
      )
    } else {
      // Only remove optional seats after a payload rejection, not a server or
      // connection failure where the command may already have been accepted.
      if (
        !retryWithNoSeat &&
        hasSeats &&
        [400, 422].includes(resp.resp.statusCode) &&
        !this.caseInsensitiveParamExtraction('Xid', resp.resp.headers || {})
      )
        return this.climateOn(id, config, true)
    }

    const error = `Failed to send climateOn command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      url: this.apiDomain + 'rems/stop',
      headers: {
        date: this.getDateString(),
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
      throw new UserFacingError(
        'Climate stop request sent, but confirmation is unavailable. Check your vehicle before trying again.',
      )
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async setChargeLimit(
    id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'evc/sts'
    const resp = await this.request({
      url: this.apiDomain + api,
      data: JSON.stringify({
        targetSOClist: [
          {
            plugType: 0,
            targetSOClevel: config.dcPercent,
          },
          {
            plugType: 1,
            targetSOClevel: config.acPercent,
          },
        ],
      }),
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}

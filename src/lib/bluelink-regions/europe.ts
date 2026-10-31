import { getVehiclePhotoUrl } from '../vehicle-photo'
import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  ChargeLimit,
  DEFAULT_STATUS_CHECK_INTERVAL,
  MAX_COMPLETION_POLLS,
} from './base'
import { Config } from '../../config'
import Url from 'url'
import { isNotEmptyObject } from '../util'
import { HyundaiEuropeAuth } from './hyundai-europe-auth'
import { europeCarStatus } from './europe-status'

import { returnMockedCarStatus, returnMockedCar } from './mock'

interface ControlToken {
  expiry: number
  token: string
}

interface APIConfig {
  apiDomain: string
  newApiDomain?: string
  apiPort: number
  appId: string
  authCfb: string
  authBasic: string
  authHost: string
  clientId: string
  pushType: string
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.eu-ccapi.hyundai.com',
    apiPort: 8080,
    appId: '014d2225-8495-4735-812d-2616334fd15d',
    authCfb: 'RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ=',
    authBasic:
      'Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==',
    authHost: 'idpconnect-eu.hyundai.com',
    clientId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    pushType: 'GCM',
  },
  kia: {
    apiDomain: 'prd.eu-ccapi.kia.com',
    newApiDomain: 'cci-api-eu.kia.com',
    apiPort: 8080,
    appId: 'a2b8469b-30a3-4361-8e13-6fceea8fbe74',
    authCfb: 'wLTVxwidmH8CfJYBWSnHD6E0huk0ozdiuygB4hLkM5XCgzAL1Dk5sE36d/bx5PFMbZs=',
    authBasic: 'Basic ZmRjODVjMDAtMGEyZi00YzY0LWJjYjQtMmNmYjE1MDA3MzBhOnNlY3JldA==',
    authHost: 'idpconnect-eu.kia.com',
    clientId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    pushType: 'APNS',
  },
}

const MOCK_API = false

export class BluelinkEurope extends Bluelink {
  private lang = 'en' // hard-code to en as the language doesnt appear to matter from an API perspective.
  private apiConfig: APIConfig
  private controlToken: ControlToken | undefined
  private europeccs2: number | undefined
  private additionalAuthHeaders: Record<string, string>

  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = this.config.distanceUnit
    if (!(config.manufacturer in API_CONFIG)) {
      throw Error(`Region ${config.manufacturer} not supported`)
    }
    this.apiConfig = API_CONFIG[config.manufacturer]!
    this.apiDomain = `https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}`

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      'User-Agent': 'okhttp/3.14.9',
      offset: this.getTimeZone().slice(0, 3),
      'ccsp-service-id': this.apiConfig.clientId,
      'ccsp-application-id': this.apiConfig.appId,
    }
    this.additionalAuthHeaders = {
      'client-id': 'com.kia.oneapp.eu',
      'client-name': 'Kia',
      'client-os-code': 'AOS',
      'client-os-version': '36',
      'client-version': '1.0.13',
      'User-Agent': 'Ktor client',
      'Accept-Language': 'en-GB',
      'Accept-Charset': 'UTF-8',
      Accept: 'application/json',
      timezone: this.getTimeZoneFull(),
      locale: 'GB',
    }
    this.authIdHeader = 'ccsp-device-id'
    this.authHeader = 'Authorization'
    this.controlToken = undefined
    this.europeccs2 = undefined
  }

  static async init(config: Config, refreshAuth: boolean, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkEurope(config, statusCheckInterval)
    await obj.superInit(config, refreshAuth)
    return obj
  }

  private getCCS2Header(): string {
    return typeof this.europeccs2 !== 'undefined'
      ? this.europeccs2.toString()
      : this.cache.car.europeccs2
        ? this.cache.car.europeccs2.toString()
        : '0'
  }

  private requestResponseValid(
    resp: Record<string, any>,
    _data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (
      Object.hasOwn(resp, 'statusCode') &&
      (resp.statusCode === 200 || resp.statusCode === 204 || resp.statusCode === 302)
    ) {
      return { valid: true, retry: false }
    }
    return { valid: false, retry: true }
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    if (this.config.manufacturer === 'hyundai') return await this.HyundaiLogin()

    // reset session - get initial cookies
    const respReset = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/authorize?response_type=code&state=test&client_id=${this.apiConfig.clientId}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect&lang=${this.lang}`,
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respReset.resp, respReset.json).valid) {
      const error = `Failed to reset session ${JSON.stringify(respReset.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return await this.KiaLogin()
  }

  private hyundaiAuthClient(): HyundaiEuropeAuth {
    return new HyundaiEuropeAuth((props) => this.request(props), this.getTimeZoneFull())
  }

  protected async HyundaiLogin(): Promise<BluelinkTokens | undefined> {
    const deviceId = this.cache?.token?.authId || (await this.getDeviceId())
    if (!deviceId) throw Error('Could not register a Hyundai device for login.')
    return await this.hyundaiAuthClient().login(this.config.auth.username, this.config.auth.password, deviceId)
  }

  protected loginWithWebview(start_url: string, callback_url: string) {
    // @ts-ignore
    return new Promise((resolve, reject) => {
      const webview = new WebView()
      webview.shouldAllowRequest = (request) => {
        if (!request.url.startsWith(callback_url)) return true
        // we have been redirected to the callback URL - return URL and update webview to a success page
        resolve(request.url)
        webview.loadHTML(
          `
          <!DOCTYPE html>
          <html>
          <body style="background-color:#1c1c1e;">

          <center>
          <h1 style="color: white; font-family: Arial, Helvetica; font-size: xxx-large;">Login Successful</h1>
          <p style="color: white; font-family: Arial, Helvetica; font-size: xx-large;">This screen should auto-close, if not please close window.</p>
          </center>

          </body>
          </html>
          `,
        )
        return false
      }
      webview.loadURL(start_url)
      webview
        .present(false)
        .then(() => {
          reject(new Error('Could not complete login. Please try again.'))
        })
        .catch(reject)
    })
  }

  protected async KiaDeviceRegistration(tokens: BluelinkTokens): Promise<boolean | undefined> {
    if (!tokens || !tokens.additionalTokens || !isNotEmptyObject(tokens.additionalTokens)) {
      if (this.config.debugLogging) this.logger.log('Cannot init session - no additional tokens')
      return undefined
    }

    const resp = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v1/notifications/bases/devices`,
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      data: JSON.stringify({
        appToken: `${this.genRanHex(22)}:${this.genRanHex(44)}_${this.genRanHex(11)}_${this.genRanHex(62)}`,
        deviceToken: UUID.string(),
        providerType: 'AOS',
        deviceModel: 'sdk_gphone64_arm64',
        deviceOsVer: '36',
        deviceAppVer: '1.0.11',
      }),
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to perform device registration ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    const deviceId = resp.json.deviceId

    const respLang = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v1/notifications/settings/preferences/language`,
      method: 'PUT',
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      data: JSON.stringify({
        deviceId: deviceId,
        countryCd: 'GB',
        langCd: 'en',
      }),
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(respLang.resp, respLang.json).valid) {
      const error = `Failed to perform device registration lang ${JSON.stringify(respLang.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    return true
  }

  protected async KiaLogin(): Promise<BluelinkTokens | undefined> {
    const authUrl =
      `https://${this.apiConfig.authHost}/auth/api/v2/user/oauth2/authorize?` +
      [
        `client_id=01b36c86-79e8-486c-8009-15f2ad88d670`,
        `redirect_uri=https://oneapp.kia.com/redirect`,
        'response_type=code',
        'scope=account.token.transfer%20account.id.generate%20account.puid.userinfos%20account.userinfo%20read%20account.userinfos%20puid%20email%20name%20mobileNum%20birthdate%20lang%20country%20signUpDate%20gender%20nationInfo%20certProfile%20offline',
        'response_type=code',
        'state=hmgoneapp',
        'ui_locales=en-GB',
      ].join('&')

    // open webview for user to login - which handles detecting login, settings webview to authURL and finally detecting the redirectURL and returning
    const callback_url = (await this.loginWithWebview(authUrl, 'https://oneapp.kia.com/redirect')) as string

    // extract code from callback URL
    const codeParams = Url.parse(callback_url, true).query
    const code = codeParams.code
    if (!code) {
      const error = `Failed to extract code from redirect ${callback_url}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined // likely username or password incorrect
    }

    // swap code for tokens
    const respTokens = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v1/auth/token?code=${code}`,
      method: 'POST',
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
      },
    })

    if (!this.requestResponseValid(respTokens.resp, respTokens.json).valid) {
      const error = `Failed to login ${JSON.stringify(respTokens.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // this causes the script to restart to dismiss the webview if this happens on first load
    this.loginRequiredWebview = true

    const tokens = {
      accessToken: '', // set in tokenExchange
      refreshToken: '', // there is no single refresh token - we use additionalTokens for this
      expiry: Math.floor(Date.now() / 1000) + Number(respTokens.json.expiresIn), // we only get a expireIn not a actual date
      authId: await this.getDeviceId(),
      additionalTokens: {
        access: respTokens.json.accessToken,
        refresh: respTokens.json.refreshToken,
        exchangeableAccess: respTokens.json.exchangeableAccessToken,
        exchangeableRefresh: respTokens.json.exchangeableRefreshToken,
        nonCcsToken: respTokens.json.nonCcsToken,
        nonCcsRefreshToken: respTokens.json.nonCcsRefreshToken,
        idToken: respTokens.json.idToken,
      },
    }

    await this.KiaDeviceRegistration(tokens)
    await this.initKiaSession(tokens)
    return await this.tokenExchange(tokens)
  }

  protected async initKiaSession(tokens: BluelinkTokens): Promise<boolean | undefined> {
    if (!tokens || !tokens.additionalTokens || !isNotEmptyObject(tokens.additionalTokens)) {
      if (this.config.debugLogging) this.logger.log('Cannot init session - no additional tokens')
      return undefined
    }

    const resp = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/oneapp/api/v1/initialize`,
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to init session ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    const respVehicle = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/oneapp/api/v1/initialize/vehicle`,
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(respVehicle.resp, respVehicle.json).valid) {
      const error = `Failed to init vehicle session ${JSON.stringify(respVehicle.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    return true
  }

  protected async tokenExchange(tokens: BluelinkTokens): Promise<BluelinkTokens | undefined> {
    if (!tokens || !tokens.additionalTokens || !isNotEmptyObject(tokens.additionalTokens)) {
      if (this.config.debugLogging) this.logger.log('Cannot exchange tokens - no additional tokens')
      return undefined
    }

    if (this.config.debugLogging) this.logger.log('Exchanging tokens using new method')

    const respToken = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v1/auth/token-exchange?serviceType=CCS`,
      method: 'POST',
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(respToken.resp, respToken.json).valid) {
      const error = `Token Exchange Failed: ${JSON.stringify(respToken.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }
    // use existing expiry
    tokens.accessToken = `Bearer ${respToken.json.accessToken}`

    const respCar = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v1/vehicle/available-vehicles?detail=false`,
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        ...this.additionalAuthHeaders,
        'app-request-id': UUID.string(),
        Authentication: tokens.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${tokens.additionalTokens['access'] || ''}`,
        'exchangeable-token': tokens.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': tokens.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (!this.requestResponseValid(respCar.resp, respCar.json).valid) {
      const error = `car Failed: ${JSON.stringify(respCar.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    return tokens
  }

  protected async newRefreshTokens(): Promise<BluelinkTokens | undefined> {
    if (!this.cache || !this.cache.token.additionalTokens || !isNotEmptyObject(this.cache.token.additionalTokens)) {
      if (this.config.debugLogging) this.logger.log('No additional tokens - cannot refresh')
      return undefined
    }

    if (this.config.debugLogging) this.logger.log('Refreshing tokens using new method')

    // token refresh API call
    const respTokens = await this.request({
      url: `https://${this.apiConfig.newApiDomain}/domain/api/v2/auth/token-refresh`,
      data: JSON.stringify({
        accessToken: this.cache.token.additionalTokens['access'],
        refreshToken: this.cache.token.additionalTokens['refresh'],
        exchangeableAccessToken: this.cache.token.additionalTokens['exchangeableAccess'],
        exchangeableRefreshToken: this.cache.token.additionalTokens['exchangeableRefresh'],
        nonCcsToken: this.cache.token.additionalTokens['nonCcsToken'],
        nonCcsRefreshToken: this.cache.token.additionalTokens['nonCcsRefreshToken'],
      }),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        'client-id': 'com.kia.oneapp.eu',
        Authentication: this.cache.token.additionalTokens['idToken'] || '',
        Authorization: `Bearer ${this.cache.token.additionalTokens['access'] || ''}`,
        'exchangeable-token': this.cache.token.additionalTokens['exchangeableAccess'] || '',
        'non-ccs-token': this.cache.token.additionalTokens['nonCcsToken'] || '',
      },
    })

    if (this.requestResponseValid(respTokens.resp, respTokens.json).valid) {
      return this.tokenExchange({
        accessToken: '', // set in tokenExchange
        refreshToken: '', // there is no single refresh token - we use additionalTokens for this
        expiry: Math.floor(Date.now() / 1000) + Number(respTokens.json.expiresIn), // we only get a expireIn not a actual date
        authId: await this.getDeviceId(),
        additionalTokens: {
          access: respTokens.json.accessToken,
          refresh: respTokens.json.refreshToken,
          exchangeableAccess: respTokens.json.exchangeableAccessToken,
          exchangeableRefresh: respTokens.json.exchangeableRefreshToken,
          nonCcsToken: respTokens.json.nonCcsToken,
          nonCcsRefreshToken: respTokens.json.nonCcsRefreshToken,
          idToken: respTokens.json.idToken,
        },
      })
    }

    const error = `Refresh Failed: ${JSON.stringify(respTokens.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    if (this.config.manufacturer === 'hyundai') {
      if (!this.cache) return undefined
      try {
        return await this.hyundaiAuthClient().refresh(this.cache.token)
      } catch (error) {
        if (this.config.debugLogging) this.logger.log(String(error))
        return undefined
      }
    }

    if (this.cache && this.cache.token.additionalTokens) {
      return await this.newRefreshTokens()
    }

    if (!this.cache.token.refreshToken) {
      if (this.config.debugLogging) this.logger.log('No refresh token - cannot refresh')
      return undefined
    }

    if (this.config.debugLogging) this.logger.log('Refreshing tokens')
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/token`,
      data: [
        `client_id=${this.apiConfig.clientId}`,
        'grant_type=refresh_token',
        `refresh_token=${this.cache.token.refreshToken}`,
        `redirect_uri=${this.apiDomain}:${this.apiConfig.apiPort}/api/v1/user/oauth2/redirect`,
      ].join('&'),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Authorization: this.apiConfig.authBasic,
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return {
        authCookie: '',
        accessToken: `Bearer ${resp.json.access_token}`,
        refreshToken: this.cache.token.refreshToken, // we never recieve a new refresh token
        expiry: Math.floor(Date.now() / 1000) + Number(resp.json.expires_in), // we only get a expireIn not a actual date
        authId: await this.getDeviceId(),
      }
    }

    const error = `Refresh Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getDeviceId(): Promise<string | undefined> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/notifications/register`,
      data: JSON.stringify({
        pushRegId: `${this.genRanHex(22)}:${this.genRanHex(63)}-${this.genRanHex(55)}`,
        pushType: this.apiConfig.pushType,
        uuid: UUID.string().toLocaleLowerCase(), // native scriptable UUID method
      }),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
      },
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return resp.json.resMsg.deviceId
    }

    const error = `Failed to fetch Device ID: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(): Promise<BluelinkCar | undefined> {
    if (MOCK_API) return returnMockedCar()
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + `/api/v1/spa/vehicles`,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
      },
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to retrieve vehicles: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.resMsg.vehicles.length > 0) {
      let vehicle = resp.json.resMsg.vehicles[0]
      if (vin) {
        for (const v of resp.json.resMsg.vehicles) {
          if (v.vin === vin) {
            vehicle = v
            break
          }
        }
      }

      this.europeccs2 = vehicle.ccuCCS2ProtocolSupport
      return {
        id: vehicle.vehicleId,
        vin: vehicle.vin,
        photoUrl: getVehiclePhotoUrl(vehicle, this.apiDomain) ?? null,
        nickName: vehicle.nickname,
        modelName: vehicle.vehicleName,
        modelYear: vehicle.year,
        odometer: 0, // not available here
        modelColour: vehicle.detailInfo.outColor,
        modelTrim: vehicle.detailInfo.saleCarmdlCd,
        europeccs2: vehicle.ccuCCS2ProtocolSupport,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(status: any, updateTime: number): BluelinkStatus {
    return europeCarStatus(status, updateTime, this.distanceUnit, this.cache?.status)
  }

  protected async getCarStatus(id: string, forceUpdate: boolean, _location: boolean = false): Promise<BluelinkStatus> {
    if (MOCK_API) return returnMockedCarStatus()
    // CCS2 endpoint appears to be the only endpoint that works consistantly across all cars
    if (!forceUpdate) {
      const resp = await this.request({
        url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/ccs2/carstatus/latest`,
        headers: {
          Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(resp.resp, resp.json).valid) {
        return this.returnCarStatus(resp.json.resMsg.state.Vehicle, resp.json.resMsg.lastUpdateTime)
      }
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // force update does not return a useful response hence we send the command and then poll the cached status until it updates
    const currentTime = Date.now()
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/ccs2/carstatus`,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      // poll cached status API until the date is above currentTime
      let attempts = 0
      let resp = undefined
      while (attempts <= MAX_COMPLETION_POLLS) {
        attempts += 1
        await this.sleep(2000)
        resp = await this.getCarStatus(id, false)
        if (currentTime < resp.lastRemoteStatusCheck) {
          return resp
        }
      }
    }

    const error = `Failed to retrieve remote vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  // named for consistency - but this is a special Authetication token - used instead of the normal Authentication token?
  // seemingly has its own expiry which we cache within the current app session only - not across app usages (i.e. saved to cache)
  protected async getAuthCode(id: string): Promise<string> {
    if (this.controlToken && this.controlToken.expiry > Date.now()) {
      return this.controlToken.token
    }
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/pin`,
      method: 'PUT',
      data: JSON.stringify({
        pin: this.config.auth.pin,
        deviceId: this.cache.token.authId,
      }),
      headers: {
        vehicleId: id,
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.controlToken = {
        expiry: Date.now() + Number(resp.json.expiresTime) * 1000,
        token: `Bearer ${resp.json.controlToken}`,
      }
      return this.controlToken.token
    }
    const error = `Failed to get auth code: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
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
        url: `${this.apiDomain}/api/v1/spa/notifications/${id}/records`,
        headers: {
          Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // iterate over all actions to find the one we are waiting for - if it exists
      for (const record of resp.json.resMsg) {
        if (record.recordId === transactionId) {
          const result = record.result
          if (result) {
            switch (result) {
              case 'success':
                return {
                  isSuccess: true,
                  data: (await this.getStatus(false, true)).status,
                }
              case 'fail':
              case 'non-response':
                return {
                  isSuccess: false,
                  data: record,
                }
              default:
                if (this.config.debugLogging)
                  this.logger.log(`Waiting for command completion: ${JSON.stringify(record)}`)
                break
            }
          }
        }
      }

      attempts += 1
      await this.sleep(2000)
    }
    return {
      isSuccess: false,
      data: undefined,
    }
  }
  protected async lock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, true)
  }

  protected async unlock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, false)
  }

  protected async lockUnlock(id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/door`,
      method: 'POST',
      data: JSON.stringify({
        command: shouldLock ? 'close' : 'open',
      }),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
      noRetry: true,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
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
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/charge`,
      method: 'POST',
      data: JSON.stringify({
        command: shouldCharge ? 'start' : 'stop',
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      }),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeStartStop command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.climateStartStop(id, {
      command: 'start',
      windshieldFrontDefogState: config.frontDefrost,
      hvacTempType: 1,
      heating1: this.getHeatingValue(config.rearDefrost, config.steering),
      tempUnit: this.config.tempType,
      drvSeatLoc: this.distanceUnit === 'mi' ? 'R' : 'L',
      hvacTemp: config.temp,
      ...(config.seatClimateOption &&
        isNotEmptyObject(config.seatClimateOption) && {
          seatClimateInfo: {
            drvSeatClimateState: config.seatClimateOption.driver,
            psgSeatClimateState: config.seatClimateOption.passenger,
            rlSeatClimateState: config.seatClimateOption.rearLeft,
            rrSeatClimateState: config.seatClimateOption.rearRight,
          },
        }),
    })
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.climateStartStop(id, {
      command: 'stop',
    })
  }

  protected async climateStartStop(
    id: string,
    climateRequest: any,
    retryWithNoSeat = false,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/temperature`,
      method: 'POST',
      data: JSON.stringify(climateRequest),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    } else {
      // Kia/Hyundai US seems pretty particular with seat settings, hence if fail retry without them,
      if (!retryWithNoSeat && climateRequest.seatClimateInfo) {
        delete climateRequest.seatClimateInfo
        return this.climateStartStop(id, climateRequest, true)
      }
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async setChargeLimit(
    id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      // use v1 for now - need a trace to see if v2 available or not
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/charge/target`,
      method: 'POST',
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
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      // polling seemingly not an option for Europe - return the result of a force update (which itself can poll)
      return {
        isSuccess: true,
        data: await this.getCarStatus(id, true),
      }
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}

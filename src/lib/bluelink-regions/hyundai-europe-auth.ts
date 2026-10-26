import type { BluelinkTokens, RequestProps } from './base'
import { encryptPasswordWithRsaJwk } from './europe-crypto'
import { hyundaiAuthHeaders } from './europe-fingerprint'
import Url from 'url'

const AUTH_HOST = 'https://idpconnect-eu.hyundai.com'
const CCI_HOST = 'https://cci-api-eu.hyundai.com'
const CLIENT_ID = '4f4953b5-02e1-4dbc-8599-87e983ee1be5'
const REDIRECT_URI = 'https://oneapp.hyundai.com/redirect'
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36_CCS_APP_AOS'

interface AuthResponse {
  resp: Record<string, any>
  json: any
  cookies: string
}

type AuthRequest = (props: RequestProps) => Promise<AuthResponse>

function mergeCookies(...sources: string[]): string {
  const cookies = new Map<string, string>()
  for (const source of sources) {
    for (const part of source.split(';')) {
      const separator = part.indexOf('=')
      if (separator > 0) cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
    }
  }
  return [...cookies].map(([key, value]) => `${key}=${value}`).join('; ')
}

function tokenFields(data: Record<string, any>, previous: Record<string, string> = {}): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const name of [
    'accessToken',
    'exchangeableAccessToken',
    'exchangeableRefreshToken',
    'nonCcsToken',
    'nonCcsRefreshToken',
    'idToken',
  ]) {
    const value = data[name] || previous[name === 'accessToken' ? 'cciAccessToken' : name] || ''
    fields[name === 'accessToken' ? 'cciAccessToken' : name] = value
  }
  return fields
}

export class HyundaiEuropeAuth {
  constructor(
    private request: AuthRequest,
    private timezone: string,
  ) {}

  private async send(props: Omit<RequestProps, 'validResponseFunction'>): Promise<AuthResponse> {
    try {
      return await this.request({
        ...props,
        noAuth: true,
        disableAdditionalHeaders: true,
        validResponseFunction: (resp) => ({ valid: [200, 204, 302].includes(resp.statusCode), retry: false }),
      })
    } catch {
      throw Error('Could not connect to Hyundai authentication. Check your connection and try again.')
    }
  }

  private requireStatus(response: AuthResponse, stage: string, expected = 200): void {
    if (response.resp.statusCode === expected) return
    const code = response.json && typeof response.json === 'object' ? response.json.code : undefined
    const detail = typeof code === 'number' ? `, code ${code}` : ''
    throw Error(`Hyundai ${stage} failed (HTTP ${response.resp.statusCode}${detail}).`)
  }

  async login(username: string, password: string, deviceId: string): Promise<BluelinkTokens> {
    const loginHeaders = {
      'User-Agent': MOBILE_UA,
      'Accept-Language': 'en-GB,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    const authorize = await this.send({
      url: `${AUTH_HOST}/auth/api/v2/user/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&lang=en&state=ccsp&country=de`,
      notJSON: true,
      headers: loginHeaders,
    })
    this.requireStatus(authorize, 'login initialization')
    if (String(authorize.json).toLowerCase().includes('abusing') || authorize.resp.url?.includes('/error?status=400')) {
      throw Error('Hyundai blocked the login request. Try again later.')
    }

    const certs = await this.send({
      url: `${AUTH_HOST}/auth/api/v1/accounts/certs`,
      headers: { ...loginHeaders, Accept: 'application/json', Cookie: authorize.cookies },
    })
    this.requireStatus(certs, 'login certificate request')
    const jwk = certs.json?.retValue || certs.json
    if (!jwk || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') {
      throw Error('Hyundai returned an invalid login certificate.')
    }
    const encryptedPassword = encryptPasswordWithRsaJwk(password, jwk)
    const fields: Record<string, string> = {
      client_id: CLIENT_ID,
      encryptedPassword: 'true',
      password: encryptedPassword,
      redirect_uri: REDIRECT_URI,
      scope: '',
      nonce: '',
      state: 'ccsp',
      username,
      connector_session_key: '',
      kid: jwk.kid || '',
      _csrf: '',
    }
    const signin = await this.send({
      url: `${AUTH_HOST}/auth/account/signin`,
      method: 'POST',
      data: Object.entries(fields)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&'),
      notJSON: true,
      noRedirect: true,
      headers: {
        ...loginHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: mergeCookies(authorize.cookies, certs.cookies),
      },
    })
    this.requireStatus(signin, 'sign-in', 302)
    const location = Object.entries(signin.resp.headers || {}).find(([name]) => name.toLowerCase() === 'location')?.[1]
    const redirect = typeof location === 'string' ? Url.parse(location, true) : undefined
    if (redirect?.pathname?.includes('/web/v1/user/authorization')) {
      throw Error('Accept the account terms in myHyundai, then try again.')
    }
    const authCode = redirect?.query.code
    if (
      redirect?.protocol !== 'https:' ||
      redirect.host !== 'oneapp.hyundai.com' ||
      redirect.pathname !== '/redirect' ||
      typeof authCode !== 'string' ||
      !authCode
    ) {
      throw Error('Hyundai sign-in did not complete. Check your email and password in Settings.')
    }

    const tokens = await this.send({
      url: `${CCI_HOST}/auth/v1/token?code=${encodeURIComponent(authCode)}`,
      method: 'POST',
      headers: hyundaiAuthHeaders(deviceId, this.timezone),
    })
    this.requireStatus(tokens, 'token exchange')
    if (!tokens.json?.accessToken || !tokens.json.refreshToken || !tokens.json.nonCcsToken) {
      throw Error('Hyundai token exchange returned an incomplete session.')
    }
    return await this.exchange(deviceId, tokens.json.refreshToken, tokenFields(tokens.json))
  }

  async refresh(cached: BluelinkTokens): Promise<BluelinkTokens | undefined> {
    if (!cached.authId || !cached.refreshToken || !cached.additionalTokens?.cciAccessToken) return undefined
    const previous = cached.additionalTokens
    const body = JSON.stringify({
      accessToken: previous.cciAccessToken,
      refreshToken: cached.refreshToken,
      exchangeableAccessToken: previous.exchangeableAccessToken || '',
      exchangeableRefreshToken: previous.exchangeableRefreshToken || '',
      nonCcsToken: previous.nonCcsToken || '',
      nonCcsRefreshToken: previous.nonCcsRefreshToken || '',
      idToken: previous.idToken || '',
    })
    const tokens = await this.send({
      url: `${CCI_HOST}/auth/v2/token-refresh`,
      method: 'POST',
      data: body,
      headers: hyundaiAuthHeaders(cached.authId, this.timezone, body),
    })
    this.requireStatus(tokens, 'session refresh')
    if (!tokens.json || typeof tokens.json !== 'object') throw Error('Hyundai returned an invalid session refresh.')
    const fields = tokenFields(tokens.json, previous)
    const cookieToken = tokens.cookies
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('t='))
      ?.slice(2)
    if (cookieToken) fields.exchangeableAccessToken = cookieToken
    return await this.exchange(cached.authId, tokens.json.refreshToken || cached.refreshToken, fields)
  }

  private async exchange(
    deviceId: string,
    refreshToken: string,
    fields: Record<string, string>,
  ): Promise<BluelinkTokens> {
    const response = await this.send({
      url: `${CCI_HOST}/auth/v1/token-exchange?serviceType=CCS`,
      method: 'POST',
      headers: {
        ...hyundaiAuthHeaders(deviceId, this.timezone),
        authorization: `Bearer ${fields.cciAccessToken}`,
        Authentication: fields.nonCcsToken || '',
        'exchangeable-token': fields.exchangeableAccessToken || '',
        'non-ccs-token': fields.nonCcsToken || '',
      },
    })
    this.requireStatus(response, 'vehicle token exchange')
    const accessToken = response.json?.accessToken || response.json?.ccsAccessToken
    if (typeof accessToken !== 'string' || !accessToken) throw Error('Hyundai returned no vehicle access token.')
    const seconds = Number(response.json.expiresTime)
    return {
      accessToken: `Bearer ${accessToken.replace(/^Bearer\s+/i, '')}`,
      refreshToken,
      authId: deviceId,
      expiry: Math.floor(Date.now() / 1000) + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600),
      additionalTokens: fields,
    }
  }
}

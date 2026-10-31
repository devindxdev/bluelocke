import type { Config } from '../config'
import type { BluelinkTokens } from './bluelink-regions/base'
import { scriptStorageKey } from './storage'
import { UserFacingError } from './user-error'

export const LOGIN_LEASE_MS = 5 * 60 * 1000
export const BACKGROUND_LOGIN_LEASE_MS = 30 * 1000

export function authIdentity(config: Config): string {
  // This record stays in Keychain; credentials never appear in a filename/log.
  return JSON.stringify([
    config.manufacturer,
    config.auth.region,
    String(config.auth.username ?? '').trim(),
    String(config.auth.password ?? ''),
    String(config.auth.pin ?? ''),
  ])
}

interface SessionRecord {
  identity: string
  generation: string
  token?: BluelinkTokens
  devices: Record<string, string>
  authRequired?: boolean
  mfa?: { sentAt: number }
  mfaSentAt?: number
}

interface LoginLease {
  generation: string
  owner: string
  until: number
  durationMs?: number
}

function usableToken(token: any): token is BluelinkTokens {
  return !!(token && typeof token.accessToken === 'string' && token.accessToken && Number.isFinite(token.expiry))
}

export class AuthSessionStore {
  private key = scriptStorageKey('auth-session')
  private leaseKey = scriptStorageKey('login-lease')
  private generation: string
  constructor(private config: Config) {
    let previous: any
    try {
      if (Keychain.contains(this.key)) previous = JSON.parse(Keychain.get(this.key))
    } catch {
      /* Read as a fresh record. */
    }
    this.generation = previous ? previous.generation || 'legacy' : `${Date.now()}-${Math.random()}`
    if (previous?.identity === authIdentity(config) && Object.hasOwn(previous, 'lease')) {
      // v1.26 mixed its lock into a frequently rewritten session record. Retire
      // that lock while retaining the verified account's tokens and snapshot.
      // Rotating the generation also stops a delayed v1.26 run writing back.
      const previousGeneration = this.generation
      this.generation = `${Date.now()}-${Math.random()}`
      delete previous.lease
      previous.generation = this.generation
      Keychain.set(this.key, JSON.stringify(previous))
      const cacheKey = scriptStorageKey('vehicle-cache')
      try {
        const cache = Keychain.contains(cacheKey) ? JSON.parse(Keychain.get(cacheKey)) : undefined
        if (
          cache?.identity === previous.identity &&
          cache.script === Script.name() &&
          cache.generation === previousGeneration
        ) {
          cache.generation = this.generation
          Keychain.set(cacheKey, JSON.stringify(cache))
        }
      } catch {
        // The saved tokens can still rebuild an unavailable completed snapshot.
      }
    }
  }

  public generationId(): string {
    return this.generation
  }

  public assertCurrent() {
    const configKey = [
      scriptStorageKey('config'),
      `egmp-scriptable-config-${Script.name().replaceAll(' ', '')}`,
      'egmp-bluelink-config',
    ].find((key) => Keychain.contains(key))
    if (configKey) {
      const current = JSON.parse(Keychain.get(configKey))
      if (!current?.auth || authIdentity(current) !== authIdentity(this.config)) {
        throw new UserFacingError('Your sign-in details changed. Reopen Bluelocke in Scriptable to continue.')
      }
    }
    if (Keychain.contains(this.key)) {
      const current = JSON.parse(Keychain.get(this.key))
      if ((current?.generation || 'legacy') !== this.generation) {
        throw new UserFacingError('Your saved session was reset. Reopen Bluelocke in Scriptable to continue.')
      }
    }
  }

  private record(): SessionRecord {
    this.assertCurrent()
    if (Keychain.contains(this.key)) {
      try {
        const record = JSON.parse(Keychain.get(this.key))
        if (record?.identity === authIdentity(this.config))
          return { ...record, generation: this.generation, devices: record.devices || {} }
      } catch {
        /* A damaged record must not reimport an obsolete login. */
      }
      return { identity: authIdentity(this.config), generation: this.generation, devices: {} }
    }

    // v1.25 tied authentication to a selected vehicle. Recover only its tokens;
    // the single-car flow will load fresh vehicle metadata independently.
    let token: BluelinkTokens | undefined
    try {
      const configKey = scriptStorageKey('config')
      const raw = Keychain.contains(configKey) ? JSON.parse(Keychain.get(configKey)) : undefined
      const account = JSON.stringify([
        this.config.manufacturer,
        this.config.auth.region,
        this.config.auth.username.trim(),
      ])
      const selected = raw?.selectedVehicle
      if (raw?.auth && authIdentity(raw) === authIdentity(this.config) && selected?.account === account) {
        const retired = scriptStorageKey('vehicle-cache', [account, selected.vin || selected.id || 'unselected'])
        if (Keychain.contains(retired)) token = JSON.parse(Keychain.get(retired))?.token
      }
      // Legacy caches keyed by script name with spaces removed have no account
      // identity. They cannot safely establish ownership of a token.
    } catch {
      /* Fall through to a normal sign-in. */
    }
    const record: SessionRecord = {
      identity: authIdentity(this.config),
      generation: this.generation,
      devices: {},
      ...(usableToken(token) && { token }),
    }
    this.persist(record)
    return record
  }

  private persist(record: SessionRecord, resetting = false) {
    if (!resetting) this.assertCurrent()
    if (!resetting) {
      const configKey = [
        scriptStorageKey('config'),
        `egmp-scriptable-config-${Script.name().replaceAll(' ', '')}`,
        'egmp-bluelink-config',
      ].find((key) => Keychain.contains(key))
      if (configKey) {
        const current = JSON.parse(Keychain.get(configKey))
        if (!current?.auth || authIdentity(current) !== authIdentity(this.config)) {
          throw new UserFacingError('Your sign-in details changed. Reopen Bluelocke in Scriptable to continue.')
        }
      }
    }
    Keychain.set(this.key, JSON.stringify(record))
  }

  public read(): BluelinkTokens | undefined {
    const token = this.record().token
    return usableToken(token) ? token : undefined
  }

  public write(token: BluelinkTokens) {
    if (!usableToken(token)) throw Error('Sign-in did not return a usable session.')
    this.persist({ ...this.record(), token, authRequired: false })
  }

  public clear() {
    // A tombstone prevents a reset/changed account from importing v1.25 again.
    this.persist(
      { identity: authIdentity(this.config), generation: `${Date.now()}-${Math.random()}`, devices: {} },
      true,
    )
    if (Keychain.contains(this.leaseKey)) Keychain.remove(this.leaseKey)
  }

  public getDeviceId(name: string, create: () => string): string {
    const record = this.record()
    const value = record.devices[name] || record.token?.additionalTokens?.[name] || create()
    if (record.devices[name] !== value) {
      record.devices[name] = value
      this.persist(record)
    }
    return value
  }

  public authRequired(): boolean {
    return !!this.record().authRequired
  }
  public requireForegroundAuth() {
    this.persist({ ...this.record(), authRequired: true })
  }
  public clearAuthRequired() {
    this.persist({ ...this.record(), authRequired: false })
  }

  public acquireLogin(durationMs = LOGIN_LEASE_MS): string | undefined {
    this.record()
    const now = Date.now()
    const lease = this.readLoginLease()
    // A killed script cannot release its lease. Expired/malformed leases and
    // timestamps made implausible by a clock change must be recoverable.
    if (lease?.owner && Number.isFinite(lease.until) && lease.until > now && lease.until <= now + LOGIN_LEASE_MS)
      return undefined
    const owner = `${now}-${Math.random()}`
    const duration = this.loginLeaseDuration(durationMs)
    this.writeLoginLease({ generation: this.generation, owner, until: now + duration, durationMs: duration })
    return this.readLoginLease()?.owner === owner ? owner : undefined
  }

  private readLoginLease(): LoginLease | undefined {
    this.assertCurrent()
    try {
      const lease = Keychain.contains(this.leaseKey) ? JSON.parse(Keychain.get(this.leaseKey)) : undefined
      return lease?.generation === this.generation ? lease : undefined
    } catch {
      return undefined
    }
  }

  private writeLoginLease(lease: LoginLease) {
    this.assertCurrent()
    Keychain.set(this.leaseKey, JSON.stringify(lease))
  }

  private loginLeaseDuration(durationMs?: number): number {
    return typeof durationMs === 'number' && Number.isFinite(durationMs)
      ? Math.max(1000, Math.min(LOGIN_LEASE_MS, durationMs))
      : LOGIN_LEASE_MS
  }

  public renewLogin(owner: string) {
    const lease = this.readLoginLease()
    if (lease?.owner !== owner) {
      throw new UserFacingError('This sign-in attempt has ended. Reopen Bluelocke in Scriptable to continue.')
    }
    this.writeLoginLease({ ...lease, until: Date.now() + this.loginLeaseDuration(lease.durationMs) })
  }

  public releaseLogin(owner: string) {
    if (this.readLoginLease()?.owner === owner) Keychain.remove(this.leaseKey)
  }

  public readMfa<T extends { sentAt: number }>(): T | undefined {
    return this.record().mfa as T | undefined
  }
  public writeMfa<T extends { sentAt: number }>(mfa: T) {
    this.persist({ ...this.record(), mfa })
  }
  public clearMfa() {
    const record = this.record()
    delete record.mfa
    this.persist(record)
  }
  public getMfaSentAt(): number {
    return this.record().mfaSentAt || 0
  }
  public markMfaSent() {
    this.persist({ ...this.record(), mfaSentAt: Date.now() })
  }
}

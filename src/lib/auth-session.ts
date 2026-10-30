import type { Config } from '../config'
import type { BluelinkTokens } from './bluelink-regions/base'
import { scriptStorageKey } from './storage'
import { UserFacingError } from './user-error'

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
  lease?: { owner: string; until: number }
  mfa?: { sentAt: number }
  mfaSentAt?: number
}

function usableToken(token: any): token is BluelinkTokens {
  return !!(token && typeof token.accessToken === 'string' && token.accessToken && Number.isFinite(token.expiry))
}

export class AuthSessionStore {
  private key = scriptStorageKey('auth-session')
  private generation: string
  constructor(private config: Config) {
    let previous: any
    try {
      if (Keychain.contains(this.key)) previous = JSON.parse(Keychain.get(this.key))
    } catch {
      /* Read as a fresh record. */
    }
    this.generation = previous ? previous.generation || 'legacy' : `${Date.now()}-${Math.random()}`
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

  public acquireLogin(): string | undefined {
    const record = this.record()
    if (record.lease && record.lease.until > Date.now()) return undefined
    const owner = `${Date.now()}-${Math.random()}`
    this.persist({ ...record, lease: { owner, until: Date.now() + 5 * 60 * 1000 } })
    return this.record().lease?.owner === owner ? owner : undefined
  }

  public releaseLogin(owner: string) {
    const record = this.record()
    if (record.lease?.owner === owner) {
      delete record.lease
      this.persist(record)
    }
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

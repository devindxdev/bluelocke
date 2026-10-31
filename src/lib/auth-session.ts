import type { Config } from '../config'
import type { BluelinkTokens } from './bluelink-regions/base'
import { scriptStorageKey } from './storage'
import { UserFacingError } from './user-error'

const AUTH_FLOW = 'v1.24.4'

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
  flow?: string
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
    if (previous?.identity === authIdentity(config) && previous.flow !== AUTH_FLOW) {
      // Upgrade v1.26.0 and v1.26.1-beta.1 in place. Only the newer sign-in
      // control state is retired; matching tokens, devices and status survive.
      // A new generation prevents an older in-flight run restoring its gates.
      const previousGeneration = this.generation
      this.generation = `${Date.now()}-${Math.random()}`
      Keychain.set(
        this.key,
        JSON.stringify({
          identity: previous.identity,
          generation: this.generation,
          token: previous.token,
          devices: previous.devices || {},
          flow: AUTH_FLOW,
        }),
      )
      const leaseKey = scriptStorageKey('login-lease')
      if (Keychain.contains(leaseKey)) Keychain.remove(leaseKey)
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
    Keychain.set(this.key, JSON.stringify({ ...record, flow: AUTH_FLOW }))
  }

  public read(): BluelinkTokens | undefined {
    const token = this.record().token
    return usableToken(token) ? token : undefined
  }

  public write(token: BluelinkTokens) {
    if (!usableToken(token)) throw Error('Sign-in did not return a usable session.')
    this.persist({ ...this.record(), token })
  }

  public clear() {
    // A tombstone prevents a reset/changed account from importing v1.25 again.
    this.persist(
      { identity: authIdentity(this.config), generation: `${Date.now()}-${Math.random()}`, devices: {} },
      true,
    )
    const leaseKey = scriptStorageKey('login-lease')
    if (Keychain.contains(leaseKey)) Keychain.remove(leaseKey)
  }

  public getDeviceId(name: string, create: () => string): string {
    const record = this.record()
    const value = record.token?.additionalTokens?.[name] || record.devices[name] || create()
    if (record.devices[name] !== value) {
      record.devices[name] = value
      this.persist(record)
    }
    return value
  }

  public setDeviceId(name: string, value: string) {
    const record = this.record()
    record.devices[name] = value
    this.persist(record)
  }
}

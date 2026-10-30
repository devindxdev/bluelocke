import Url from 'url'

export function httpsUrl(value: unknown): Url.UrlWithStringQuery {
  if (
    typeof value !== 'string' ||
    !/^https:\/\//i.test(value) ||
    /[\s\\]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    throw Error('An HTTPS URL is required.')
  }
  const parsed = Url.parse(value)
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.auth) throw Error('Unsafe URL rejected.')
  return parsed
}

export function sameOrigin(left: string, right: string): boolean {
  try {
    const a = httpsUrl(left)
    const b = httpsUrl(right)
    return a.hostname === b.hostname && (a.port || '443') === (b.port || '443')
  } catch {
    return false
  }
}

export function exactCallback(value: string, expected: string): boolean {
  try {
    return (
      sameOrigin(value, expected) && httpsUrl(value).pathname === httpsUrl(expected).pathname && !httpsUrl(value).hash
    )
  } catch {
    return false
  }
}

export function singleQueryParam(value: string, key: string): string {
  httpsUrl(value)
  const param = Url.parse(value, true).query[key]
  if (typeof param !== 'string' || !param) throw Error('Missing or ambiguous authentication parameter.')
  return param
}

const REDACTED = '[REDACTED]'
const privateValues = new Set<string>()

// Values known locally also need masking when an API echoes them in an error
// message, URL path, or other field whose name does not identify the secret.
export function registerLogSecrets(values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const text = String(value)
    if (!text.trim() || text === REDACTED) continue
    privateValues.add(text)
  }
}

function privateKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return (
    (/token|cookie|authorization|authentication|password|passwd|passcode|secret|credential|session|otp|verification|fingerprint/.test(
      normalized,
    ) ||
      /^(identity|pauth|authcode|pin|pwd|sid|code|authorizationcode|bluelinkservicepin|securitycode|cert|certificate|key|state|nonce)$/.test(
        normalized,
      ) ||
      /id$|key$|uuid|^vin|vin$|regid|registration|enrollment|account|username|loginname|email|phone|mobile|contact|license|plate/.test(
        normalized,
      ) ||
      /^(user|owner|name|firstname|lastname|fullname|nickname|displayname|displaynameoverride)$/.test(normalized) ||
      /(?:customer|owner|driver|member)(?:name|info|details|profile)/.test(normalized) ||
      /(?:user|customer|member|mbr)(?:no|number)|^(sub|subject|jti|imei|imsi|ip|ipaddress|clientip|celno|telno|msisdn|dob|birthdate|zip)$/.test(
        normalized,
      ) ||
      /location|coord|latitude|longitude|gps|address|postal|zipcode/.test(normalized) ||
      /^(lat|lon|long|lng|alt|altitude|geolocation|position|destination|home|work|photo|photourl|imageurl|imagepath|city|street|countryname)$/.test(
        normalized,
      )) &&
    normalized !== 'valid'
  )
}

function maskKnownValues(text: string): string {
  // Replace longer values first so a shorter identifier cannot expose the tail
  // of a password or token that contains it.
  const values = [...privateValues].flatMap((value) => [
    value,
    encodeURIComponent(value),
    encodeURIComponent(value).replace(/%20/g, '+'),
    JSON.stringify(value).slice(1, -1),
  ])
  for (const value of [...new Set(values)].sort((a, b) => b.length - a.length)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Very short PINs/passwords must not wipe out every digit in a timestamp.
    text = text
      .split(REDACTED)
      .map((part) =>
        value.length < 4
          ? part.replace(
              new RegExp(`(^|[^\\w])${escaped}(?=$|[^\\w])`, 'g'),
              (_match, prefix: string) => prefix + REDACTED,
            )
          : part.replace(new RegExp(escaped, 'g'), REDACTED),
      )
      .join(REDACTED)
  }
  return text
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 12) return '[Nested data omitted]'
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const namedValue =
          key === 'value' &&
          ['name', 'key'].some((label) => {
            const name = (value as Record<string, unknown>)[label]
            return typeof name === 'string' && privateKey(name)
          })
        if (privateKey(key) || namedValue) {
          if (
            typeof item === 'string' ||
            (typeof item === 'number' && (String(item).length >= 4 || /pin/i.test(key)))
          ) {
            registerLogSecrets([item])
          }
          return [key, REDACTED]
        }
        return [key, typeof item === 'string' ? sanitizeText(item, depth + 1) : sanitizeValue(item, depth + 1)]
      }),
    )
  }
  return typeof value === 'string' ? sanitizeText(value, depth + 1) : value
}

// Log entries mix prose with JSON request/response objects. Parse complete
// fragments so arrays, nested objects and JSON-encoded bodies are all covered.
function sanitizeJsonFragments(text: string, depth: number): string {
  let result = ''
  let offset = 0
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{' && text[start] !== '[') continue
    let nesting = 0
    let quoted = false
    let escaped = false
    let end = start
    for (; end < text.length; end++) {
      const char = text[end]
      if (quoted) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') quoted = false
      } else if (char === '"') quoted = true
      else if (char === '{' || char === '[') nesting++
      else if (char === '}' || char === ']') nesting--
      if (nesting !== 0) continue
      try {
        const value = JSON.parse(text.slice(start, end + 1))
        result += sanitizeFallback(text.slice(offset, start)) + JSON.stringify(sanitizeValue(value, depth + 1))
        offset = end + 1
      } catch {
        // Malformed/truncated fragments are handled by the text fallback below.
      }
      break
    }
    // Never repeatedly scan a malformed fragment's nested opening braces.
    start = end
  }
  return result + sanitizeFallback(text.slice(offset))
}

function sanitizeFallback(text: string): string {
  // Historical logs can contain escaped JSON outside a valid JSON string.
  // Only decode those fragments; keep valid JSON bodies correctly escaped.
  return sanitizeFields(text.replace(/\\+"/g, '"'))
}

function sanitizeFields(text: string): string {
  const fields = /(^|[^\w.-])(["']?)([a-z][\w.-]*)\2(\s*[:=]\s*)/gi
  let result = ''
  let offset = 0
  let match: RegExpExecArray | null
  while ((match = fields.exec(text))) {
    const [, prefix, quote, key, separator] = match
    if (!key || !privateKey(key)) continue
    const value =
      text
        .slice(fields.lastIndex)
        .match(/^(\[REDACTED\]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[[{][^\r\n]*|[^,;&}\]\r\n]+)/)?.[0] || ''
    const valueQuote = value.startsWith('"') ? '"' : value.startsWith("'") ? "'" : ''
    if (value.length >= 4 && !value.includes(REDACTED) && !value.startsWith('[') && !value.startsWith('{')) {
      const secret = valueQuote ? value.slice(1, value.endsWith(valueQuote) ? -1 : undefined) : value.trim()
      registerLogSecrets([secret])
    }
    result +=
      text.slice(offset, match.index) +
      `${prefix}${quote}${key}${quote}${separator}${valueQuote}${REDACTED}${valueQuote}`
    offset = fields.lastIndex + value.length
    fields.lastIndex = offset
  }
  return result + text.slice(offset)
}

function sanitizeText(input: string, depth = 0): string {
  if (depth > 12) return '[Nested data omitted]'
  if (input.length > 1_000_000) return '[Oversized log data omitted]'
  if (/<(?:!doctype|html|input|form)\b/i.test(input)) return '[HTML response omitted]'
  let text = sanitizeJsonFragments(input, depth)

  // Multi-word labels emitted by older versions, and raw HTTP auth headers.
  text = text.replace(
    /\b(MFA Code entered|control token|access token|refresh token|verification code|vehicle VIN)\s*[:=]\s*[^\r\n,;]+/gi,
    `$1: ${REDACTED}`,
  )
  text = text.replace(/(Failed to set car)\s+[^\s:]+/gi, `$1 ${REDACTED}`)
  text = text.replace(/\b(Bearer|Basic)\s+[a-z0-9+/_.=~%-]+/gi, `$1 ${REDACTED}`)
  text = text.replace(/https?:\/\/[^\s<>"'\\]+/gi, (url) => {
    const withoutAuth = url.replace(/^(https?:\/\/)[^/@]+@/i, `$1${REDACTED}@`)
    return withoutAuth
      .replace(/([?&][^=&#]*=)[^&#]*/g, `$1${REDACTED}`)
      .replace(/#.*$/, `#${REDACTED}`)
      .replace(/(\/enrollment\/details\/|\/users\/|\/accounts\/)[^/?#]+/gi, `$1${REDACTED}`)
      .replace(/(\/vehicles\/|\/notifications\/)([^/?#]+)/gi, (match, prefix: string, segment: string) =>
        ['status', 'register', 'settings', REDACTED].includes(segment) ? match : `${prefix}${REDACTED}`,
      )
  })
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
  text = text.replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, REDACTED)
  text = text.replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi, REDACTED)
  text = text.replace(
    /\b(?=[a-hj-npr-z0-9]{0,16}\d)(?=[a-hj-npr-z0-9]{0,16}[a-hj-npr-z])[a-hj-npr-z0-9]{17}\b/gi,
    REDACTED,
  )
  text = text.replace(/\+\d[\d ().-]{7,}\d|\(\d{3}\)\s*\d{3}[- .]\d{4}|\b\d{3}[- .]\d{3}[- .]\d{4}\b/g, REDACTED)

  // Form bodies sometimes contain JSON or another form encoded as one value.
  text = text.replace(/(?:%[a-f0-9]{2})[^\s"<>]*/gi, (encoded) => {
    try {
      const decoded = decodeURIComponent(encoded)
      const sanitized = sanitizeText(decoded, depth + 1)
      return sanitized === decoded ? encoded : encodeURIComponent(sanitized)
    } catch {
      return '[Encoded data omitted]'
    }
  })
  return maskKnownValues(text)
}

export function sanitizeLog(input: unknown): string {
  try {
    const value = input instanceof Error ? `${input.name}: ${input.message}\n${input.stack || ''}` : input
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return sanitizeText(text ?? String(value))
  } catch {
    // Never fall back to logging the raw input when serialization/redaction fails.
    return '[Log entry omitted: unable to sanitize]'
  }
}

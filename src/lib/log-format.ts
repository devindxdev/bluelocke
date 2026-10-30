import { sanitizeLog } from './log-sanitizer'

function displayValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[Nested data omitted]'
  if (typeof value === 'string' && ['{', '['].includes(value.trim().charAt(0))) {
    try {
      // Request bodies are often JSON encoded inside another JSON string.
      // Decode them for the human-readable view only; saved/wire types stay intact.
      return displayValue(JSON.parse(value), depth + 1)
    } catch {
      return value
    }
  }
  if (Array.isArray(value)) return value.map((item) => displayValue(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, displayValue(item, depth + 1)]))
  }
  return value
}

// Keep sanitization independent of presentation. Logger writes remain compact;
// viewers and Share Debug Logs get indented JSON and readable entry boundaries.
export function formatLogForDisplay(input: unknown): string {
  const text = sanitizeLog(input)
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
        const prefix = text.slice(offset, start)
        result += prefix.trimEnd()
        if (result && !result.endsWith('\n')) result += '\n'
        result += JSON.stringify(displayValue(value), null, 2)
        if (text[end + 1] && text[end + 1] !== '\n') result += '\n'
        offset = end + 1
      } catch {
        /* Retain prose, redaction markers and incomplete JSON as text. */
      }
      break
    }
    start = end
  }
  return result + text.slice(offset)
}

import Url from 'url'
import { scriptStorageKey } from './vehicle-selection'

function photoUrl(value: unknown, baseUrl?: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const text = value.trim()
  if (!/^https?:\/\//i.test(text) && !(baseUrl && /^(\/|\.\.?\/)/.test(text))) return undefined
  try {
    const resolved = baseUrl ? Url.resolve(baseUrl, text) : text
    const parsed = Url.parse(resolved)
    if (!['https:', 'http:'].includes(parsed.protocol || '') || !parsed.hostname || parsed.auth) return undefined
    return resolved
  } catch {
    return undefined
  }
}

// The APIs use different field names. Only inspect vehicle image fields,
// not nested app icons, dealer logos, or other unrelated images.
export function getVehiclePhotoUrl(vehicle: any, baseUrl?: string): string | undefined {
  for (const value of [vehicle?.photoUrl, vehicle?.photoURL, vehicle?.imageUrl, vehicle?.imageURL]) {
    const url = photoUrl(value, baseUrl)
    if (url) return url
  }
  const image = vehicle?.imagePath
  if (typeof image?.imagePath === 'string' && typeof image?.imageName === 'string' && image.imageName.trim()) {
    return photoUrl(`${image.imagePath.replace(/\/$/, '')}/${image.imageName}`, baseUrl)
  }
  return undefined
}

function usableImage(image: Image | null | undefined): image is Image {
  return (
    !!image &&
    Number.isFinite(image.size.width) &&
    Number.isFinite(image.size.height) &&
    image.size.width > 0 &&
    image.size.height > 0
  )
}

export async function loadApiVehiclePhoto(
  url: string | null | undefined,
  scope: string[],
  forceRefresh = false,
  timeout?: number,
): Promise<Image | undefined> {
  const normalizedUrl = photoUrl(url)
  if (!normalizedUrl) return undefined
  const fs = FileManager.local()
  const key = scriptStorageKey('api-vehicle-photo', scope)
  let previous: { url: string; file: string } | undefined
  let cached: Image | undefined
  try {
    if (Keychain.contains(key)) {
      const record = JSON.parse(Keychain.get(key))
      if (/^api-vehicle-photo-[a-f0-9-]{36}\.png$/i.test(record?.file) && typeof record?.url === 'string') {
        previous = record
        if (record.url === normalizedUrl) {
          const path = fs.joinPath(fs.libraryDirectory(), record.file)
          if (fs.fileExists(path)) {
            const image = fs.readImage(path)
            if (usableImage(image)) cached = image
          }
        }
      }
    }
  } catch {
    // A damaged cache must not prevent the download or the default image.
  }
  if (cached && !forceRefresh) return cached

  let image: Image
  try {
    // Image hosts receive no account credentials or API authentication headers.
    const request = new Request(normalizedUrl)
    request.method = 'GET'
    if (timeout) request.timeoutInterval = timeout
    image = await request.loadImage()
    if (!usableImage(image)) return cached
  } catch {
    return cached
  }

  const file = `api-vehicle-photo-${UUID.string()}.png`
  const path = fs.joinPath(fs.libraryDirectory(), file)
  try {
    fs.writeImage(path, image)
    Keychain.set(key, JSON.stringify({ url: normalizedUrl, file }))
  } catch {
    try {
      if (fs.fileExists(path)) fs.remove(path)
    } catch {
      /* best-effort cache cleanup */
    }
    return image
  }
  if (previous && previous.file !== file) {
    try {
      const oldPath = fs.joinPath(fs.libraryDirectory(), previous.file)
      if (fs.fileExists(oldPath)) fs.remove(oldPath)
    } catch {
      /* keep the successfully cached replacement */
    }
  }
  return image
}

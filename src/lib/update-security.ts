import { httpsUrl } from './secure-url'

export function validateReleaseAssetUrl(
  value: string,
  owner = 'devindxdev',
  repository = 'bluelocke',
  tag?: string,
): string {
  const url = httpsUrl(value)
  const prefix = `/${owner}/${repository}/releases/download/`
  const path = url.pathname || ''
  const rest = path.slice(prefix.length).split('/')
  const safeTag = !!rest[0] && /^[a-z0-9][a-z0-9._+-]*$/i.test(decodeURIComponent(rest[0]))
  if (
    url.hostname !== 'github.com' ||
    (url.port && url.port !== '443') ||
    url.search ||
    url.hash ||
    !path.startsWith(prefix) ||
    rest.length !== 2 ||
    !safeTag ||
    !rest[0] ||
    rest[1] !== 'bluelocke.js' ||
    (tag && rest[0] !== encodeURIComponent(tag))
  ) {
    throw Error('The update is not a release asset from the configured repository.')
  }
  return value
}

export function allowedReleaseRedirect(value: string): boolean {
  try {
    const url = httpsUrl(value)
    return (
      (!url.port || url.port === '443') &&
      ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(
        url.hostname || '',
      )
    )
  } catch {
    return false
  }
}

import {
  getVehicleImagePlacement,
  normalizeVehicleImageCrop,
  VEHICLE_IMAGE_SIZE,
  VEHICLE_IMAGE_SOURCE_MAX_SIZE,
  VehicleImageCrop,
} from './vehicle-image-geometry'

interface SavedVehicleImage {
  id: string
  crop: VehicleImageCrop
}

function imageKey(vehicleId: string): string {
  return `bluelocke-custom-image:${JSON.stringify([Script.name(), vehicleId])}`
}

function imageDirectory(fs: FileManager, vehicleId: string): string {
  return fs.joinPath(
    fs.joinPath(fs.libraryDirectory(), `custom-vehicle-images/script-${encodeURIComponent(Script.name())}`),
    `vehicle-${encodeURIComponent(vehicleId)}`,
  )
}

function imagePath(fs: FileManager, vehicleId: string, id: string, source = false): string {
  return fs.joinPath(imageDirectory(fs, vehicleId), `${id}${source ? '-source' : ''}.png`)
}

function savedImage(vehicleId: string): SavedVehicleImage | undefined {
  try {
    const key = imageKey(vehicleId)
    if (!Keychain.contains(key)) return undefined
    const saved = JSON.parse(Keychain.get(key))
    if (!saved || typeof saved.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(saved.id)) return undefined
    return saved
  } catch (_error) {
    return undefined
  }
}

function isUsableImage(image: Image | undefined | null): image is Image {
  return (
    !!image &&
    Number.isFinite(image.size.width) &&
    Number.isFinite(image.size.height) &&
    image.size.width >= 1 &&
    image.size.height >= 1 &&
    image.size.width * image.size.height <= 64_000_000
  )
}

export function getCustomVehicleImage(vehicleId: string): Image | undefined {
  try {
    const saved = savedImage(vehicleId)
    if (!saved) return undefined
    const fs = FileManager.local()
    const path = imagePath(fs, vehicleId, saved.id)
    if (!fs.fileExists(path)) return undefined
    const image = fs.readImage(path)
    return isUsableImage(image) ? image : undefined
  } catch (_error) {
    // A missing or damaged custom image must not prevent the app or widget from loading.
    return undefined
  }
}

export function getCustomVehicleImageSource(vehicleId: string): { image: Image; crop: VehicleImageCrop } | undefined {
  try {
    const saved = savedImage(vehicleId)
    if (!saved) return undefined
    const fs = FileManager.local()
    const path = imagePath(fs, vehicleId, saved.id, true)
    if (!fs.fileExists(path)) return undefined
    const image = fs.readImage(path)
    return isUsableImage(image) ? { image, crop: normalizeVehicleImageCrop(image.size, saved.crop) } : undefined
  } catch (_error) {
    return undefined
  }
}

export function prepareVehicleImage(image: Image): Image {
  if (!isUsableImage(image)) throw new Error('Choose a valid image smaller than 64 megapixels.')
  const scale = Math.min(1, VEHICLE_IMAGE_SOURCE_MAX_SIZE / Math.max(image.size.width, image.size.height))
  if (scale === 1) return image
  const context = new DrawContext()
  context.size = new Size(
    Math.max(1, Math.round(image.size.width * scale)),
    Math.max(1, Math.round(image.size.height * scale)),
  )
  context.opaque = false
  context.respectScreenScale = false
  context.drawImageInRect(image, new Rect(0, 0, context.size.width, context.size.height))
  return context.getImage()
}

function removeImageFiles(fs: FileManager, vehicleId: string, id: string) {
  for (const source of [false, true]) {
    try {
      const path = imagePath(fs, vehicleId, id, source)
      if (fs.fileExists(path)) fs.remove(path)
    } catch (_error) {
      // Cleanup is best-effort; never undo a successful save or reset over an old file.
    }
  }
}

export function saveCustomVehicleImage(vehicleId: string, image: Image, crop?: Partial<VehicleImageCrop>): Image {
  const source = prepareVehicleImage(image)
  const normalizedCrop = normalizeVehicleImageCrop(source.size, crop)
  const rendered = renderVehicleImage(source, normalizedCrop)
  const fs = FileManager.local()
  const previous = savedImage(vehicleId)
  const id = UUID.string()
  fs.createDirectory(imageDirectory(fs, vehicleId), true)
  try {
    fs.writeImage(imagePath(fs, vehicleId, id, true), source)
    fs.writeImage(imagePath(fs, vehicleId, id), rendered)
    // Commit only after both images exist, so a failed import leaves the old image intact.
    Keychain.set(imageKey(vehicleId), JSON.stringify({ id, crop: normalizedCrop }))
  } catch (error) {
    removeImageFiles(fs, vehicleId, id)
    throw error
  }
  if (previous) removeImageFiles(fs, vehicleId, previous.id)
  return rendered
}

export function renderVehicleImage(source: Image, crop?: Partial<VehicleImageCrop>): Image {
  const normalizedCrop = normalizeVehicleImageCrop(source.size, crop)
  const placement = getVehicleImagePlacement(source.size, VEHICLE_IMAGE_SIZE, normalizedCrop)
  const context = new DrawContext()
  context.size = new Size(VEHICLE_IMAGE_SIZE.width, VEHICLE_IMAGE_SIZE.height)
  context.opaque = false
  context.respectScreenScale = false
  context.drawImageInRect(source, new Rect(placement.x, placement.y, placement.width, placement.height))
  return context.getImage()
}

export function removeCustomVehicleImage(vehicleId: string) {
  const previous = savedImage(vehicleId)
  const key = imageKey(vehicleId)
  if (Keychain.contains(key)) Keychain.remove(key)
  if (previous) removeImageFiles(FileManager.local(), vehicleId, previous.id)
}

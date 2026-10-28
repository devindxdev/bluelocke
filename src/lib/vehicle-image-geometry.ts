export interface VehicleImageSize {
  width: number
  height: number
}

export interface VehicleImageCrop {
  zoom: number
  x: number
  y: number
}

export const VEHICLE_IMAGE_SIZE: VehicleImageSize = { width: 1200, height: 600 }
export const VEHICLE_IMAGE_SOURCE_MAX_SIZE = 1600

export function getMaximumImageZoom(source: VehicleImageSize): number {
  const fit = Math.min(VEHICLE_IMAGE_SIZE.width / source.width, VEHICLE_IMAGE_SIZE.height / source.height)
  const fill = Math.max(VEHICLE_IMAGE_SIZE.width / source.width, VEHICLE_IMAGE_SIZE.height / source.height)
  return Math.max(4, fill / fit)
}

export function normalizeVehicleImageCrop(
  source: VehicleImageSize,
  crop?: Partial<VehicleImageCrop>,
): VehicleImageCrop {
  const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
  return {
    zoom: clamp(crop?.zoom, 1, 0.5, getMaximumImageZoom(source)),
    x: clamp(crop?.x, 0.5, 0, 1),
    y: clamp(crop?.y, 0.5, 0, 1),
  }
}

// Keep this self-contained: the editor uses the same function in its WebView.
export function getVehicleImagePlacement(source: VehicleImageSize, frame: VehicleImageSize, crop: VehicleImageCrop) {
  const scale = Math.min(frame.width / source.width, frame.height / source.height) * crop.zoom
  const width = source.width * scale
  const height = source.height * scale
  return { x: (frame.width - width) * crop.x, y: (frame.height - height) * crop.y, width, height }
}

// Self-contained so touch, wheel, and slider zoom share the same focal-point math in the WebView.
export function zoomVehicleImageAt(
  source: VehicleImageSize,
  frame: VehicleImageSize,
  crop: VehicleImageCrop,
  nextZoom: number,
  anchor: { x: number; y: number },
): VehicleImageCrop {
  const fit = Math.min(frame.width / source.width, frame.height / source.height)
  const fill = Math.max(frame.width / source.width, frame.height / source.height)
  const maximum = Math.max(4, fill / fit)
  const zoom = Math.max(0.5, Math.min(maximum, Number.isFinite(nextZoom) ? nextZoom : crop.zoom))
  const oldWidth = source.width * fit * crop.zoom
  const oldHeight = source.height * fit * crop.zoom
  const ratio = zoom / crop.zoom
  const width = oldWidth * ratio
  const height = oldHeight * ratio
  const left = anchor.x - (anchor.x - (frame.width - oldWidth) * crop.x) * ratio
  const top = anchor.y - (anchor.y - (frame.height - oldHeight) * crop.y) * ratio
  return {
    zoom,
    x: Math.abs(frame.width - width) < 0.000001 ? 0.5 : Math.max(0, Math.min(1, left / (frame.width - width))),
    y: Math.abs(frame.height - height) < 0.000001 ? 0.5 : Math.max(0, Math.min(1, top / (frame.height - height))),
  }
}

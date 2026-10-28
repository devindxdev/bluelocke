import type { VehicleImageSize } from './vehicle-image-geometry'

const WIDE_MEDIUM_WIDGET_WIDTH = 364
const REGULAR_MEDIUM_WIDGET_WIDTH = 338
const NARROW_MEDIUM_WIDGET_WIDTH = 329

export interface MediumWidgetGeometry {
  widgetWidth: number
  paddingTop: number
  paddingLeft: number
  paddingBottom: number
  paddingRight: number
  titleInset: number
  titleFontSize: number
  titleMinimumScaleFactor: number
  titleRowHeight: number
  titleBottomSpacer: number
  carImageWidth: number
  mediaRightSafetyInset: number
  contentRowHeight: number
  statsColumnWidth: number
  contentGap: number
  batteryInfoTopSpacer: number
  statsTrailingInset: number
  topMetricRowHeight: number
  primaryMetricRowHeight: number
  secondaryMetricRowHeight: number
  rightMetricFontSize: number
  batteryPercentFontSize: number
  chargingFontSize: number
  batteryIconSize: VehicleImageSize
  chargingIconSize: number
  footerTopSpacer: number
  footerLeadingInset: number
  footerTrailingInset: number
  footerGroupTargetWidth: number
  footerRowHeight: number
  footerGap: number
  footerIconSize: number
  footerFontSize: number
}

export interface MediumWidgetFooterLayout {
  footerCellWidth: number
  footerOuterLead: number
  footerOuterTrail: number
}

function getMediumWidgetWidth(screenWidth: number): number {
  if (screenWidth >= 428) return WIDE_MEDIUM_WIDGET_WIDTH
  if (screenWidth >= 390) return REGULAR_MEDIUM_WIDGET_WIDTH
  return NARROW_MEDIUM_WIDGET_WIDTH
}

function interpolateMediumValue(widgetWidth: number, wide: number, regular: number, narrow: number): number {
  if (widgetWidth >= REGULAR_MEDIUM_WIDGET_WIDTH) {
    const t = (widgetWidth - REGULAR_MEDIUM_WIDGET_WIDTH) / (WIDE_MEDIUM_WIDGET_WIDTH - REGULAR_MEDIUM_WIDGET_WIDTH)
    return regular + (wide - regular) * t
  }

  const t = (widgetWidth - NARROW_MEDIUM_WIDGET_WIDTH) / (REGULAR_MEDIUM_WIDGET_WIDTH - NARROW_MEDIUM_WIDGET_WIDTH)
  return narrow + (regular - narrow) * t
}

function interpolateMediumSize(
  widgetWidth: number,
  wide: VehicleImageSize,
  regular: VehicleImageSize,
  narrow: VehicleImageSize,
): VehicleImageSize {
  return {
    width: Math.round(interpolateMediumValue(widgetWidth, wide.width, regular.width, narrow.width)),
    height: Math.round(interpolateMediumValue(widgetWidth, wide.height, regular.height, narrow.height)),
  }
}

export function getMediumWidgetGeometry(screenWidth: number): MediumWidgetGeometry {
  const widgetWidth = getMediumWidgetWidth(screenWidth)

  return {
    widgetWidth,
    paddingTop: Math.round(interpolateMediumValue(widgetWidth, 20, 18, 18)),
    paddingLeft: Math.round(interpolateMediumValue(widgetWidth, 5, 5, 5)),
    paddingBottom: Math.round(interpolateMediumValue(widgetWidth, 20, 16, 16)),
    paddingRight: Math.round(interpolateMediumValue(widgetWidth, 15, 12, 12)),
    titleInset: Math.round(interpolateMediumValue(widgetWidth, 8, 0, 0)),
    titleFontSize: Math.round(interpolateMediumValue(widgetWidth, 25, 23, 22)),
    titleMinimumScaleFactor: interpolateMediumValue(widgetWidth, 0.8, 0.72, 0.68),
    titleRowHeight: Math.round(interpolateMediumValue(widgetWidth, 32, 30, 29)),
    titleBottomSpacer: Math.round(interpolateMediumValue(widgetWidth, 2, 3, 3)),
    carImageWidth: Math.round(interpolateMediumValue(widgetWidth, 220, 176, 168)),
    mediaRightSafetyInset: Math.round(interpolateMediumValue(widgetWidth, 0, 8, 10)),
    contentRowHeight: Math.round(interpolateMediumValue(widgetWidth, 100, 92, 90)),
    statsColumnWidth: Math.round(interpolateMediumValue(widgetWidth, 125, 108, 102)),
    contentGap: Math.round(interpolateMediumValue(widgetWidth, 4, 3, 3)),
    batteryInfoTopSpacer: Math.round(interpolateMediumValue(widgetWidth, 10, 9, 8)),
    statsTrailingInset: Math.round(interpolateMediumValue(widgetWidth, 0, 4, 4)),
    topMetricRowHeight: Math.round(interpolateMediumValue(widgetWidth, 20, 18, 18)),
    primaryMetricRowHeight: Math.round(interpolateMediumValue(widgetWidth, 26, 24, 24)),
    secondaryMetricRowHeight: Math.round(interpolateMediumValue(widgetWidth, 24, 22, 22)),
    rightMetricFontSize: Math.round(interpolateMediumValue(widgetWidth, 17, 16, 15)),
    batteryPercentFontSize: Math.round(interpolateMediumValue(widgetWidth, 15, 14, 13)),
    chargingFontSize: Math.round(interpolateMediumValue(widgetWidth, 14, 12, 12)),
    batteryIconSize: interpolateMediumSize(
      widgetWidth,
      { width: 32, height: 24 },
      { width: 30, height: 22 },
      { width: 28, height: 21 },
    ),
    chargingIconSize: Math.round(interpolateMediumValue(widgetWidth, 28, 24, 23)),
    footerTopSpacer: Math.round(interpolateMediumValue(widgetWidth, 8, 6, 6)),
    footerLeadingInset: Math.round(interpolateMediumValue(widgetWidth, 0, 0, 0)),
    footerTrailingInset: Math.round(interpolateMediumValue(widgetWidth, 0, 4, 4)),
    footerGroupTargetWidth: Math.round(interpolateMediumValue(widgetWidth, 274, 236, 224)),
    footerRowHeight: Math.round(interpolateMediumValue(widgetWidth, 24, 22, 22)),
    footerGap: Math.round(interpolateMediumValue(widgetWidth, 5, 6, 6)),
    footerIconSize: Math.round(interpolateMediumValue(widgetWidth, 18, 15, 14)),
    footerFontSize: Math.round(interpolateMediumValue(widgetWidth, 12, 11, 10)),
  }
}

export function getMediumWidgetFooterLayout(
  usableWidth: number,
  footerLeadingInset: number,
  footerTrailingInset: number,
  footerGroupTargetWidth: number,
  footerGap: number,
): MediumWidgetFooterLayout {
  const footerAvailable = Math.max(0, usableWidth - footerLeadingInset - footerTrailingInset)
  const footerGroupWidth = Math.min(footerGroupTargetWidth, footerAvailable)
  const footerCellWidth = Math.max(1, Math.floor((footerGroupWidth - footerGap * 2) / 3))
  const footerUsedWidth = footerCellWidth * 3 + footerGap * 2
  const footerCenteringSlack = Math.max(0, footerAvailable - footerUsedWidth)

  return {
    footerCellWidth,
    footerOuterLead: footerLeadingInset + Math.floor(footerCenteringSlack / 2),
    footerOuterTrail: footerTrailingInset + (footerCenteringSlack - Math.floor(footerCenteringSlack / 2)),
  }
}

// The image occupies only the left content column, never the title, metrics, or footer.
export function getMediumWidgetImageFrame(profile: MediumWidgetGeometry, image: VehicleImageSize) {
  const usableWidth = profile.widgetWidth - profile.paddingLeft - profile.paddingRight
  const mediaWidth = Math.max(1, usableWidth - profile.statsColumnWidth - profile.contentGap)
  const maxWidth = Math.max(1, Math.min(profile.carImageWidth, mediaWidth - profile.mediaRightSafetyInset))
  const scale = Math.min(maxWidth / image.width, profile.contentRowHeight / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return {
    mediaWidth,
    width,
    height,
    leading: Math.max(0, mediaWidth - width - profile.mediaRightSafetyInset),
    top: Math.max(0, (profile.contentRowHeight - height) / 2),
  }
}

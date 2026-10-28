import { VEHICLE_IMAGE_SIZE } from './vehicle-image-geometry'
import { getMediumWidgetFooterLayout, getMediumWidgetGeometry, getMediumWidgetImageFrame } from './widget-layout'
import { getWidgetPreviewLabels, VehicleImagePreviewOptions } from './widget-preview-data'

export function createVehicleImageLivePreview(options: VehicleImagePreviewOptions) {
  const profile = getMediumWidgetGeometry(options.screenWidth)
  const frame = getMediumWidgetImageFrame(profile, VEHICLE_IMAGE_SIZE)
  const labels = getWidgetPreviewLabels(options)
  const contentTop = profile.paddingTop + profile.titleRowHeight + 2
  const height =
    contentTop + profile.contentRowHeight + profile.footerTopSpacer + profile.footerRowHeight + profile.paddingBottom
  const width = profile.widgetWidth
  const usableWidth = width - profile.paddingLeft - profile.paddingRight
  const footer = getMediumWidgetFooterLayout(
    usableWidth,
    profile.footerLeadingInset,
    profile.footerTrailingInset,
    profile.footerGroupTargetWidth,
    profile.footerGap,
  )
  const footerY = contentTop + profile.contentRowHeight + profile.footerTopSpacer + profile.footerRowHeight * 0.75
  const footerX = profile.paddingLeft + footer.footerOuterLead
  const metricRight = width - profile.paddingRight - profile.statsTrailingInset
  const metricTop = contentTop + profile.batteryInfoTopSpacer + 2
  const metricY = metricTop + profile.primaryMetricRowHeight * 0.8
  const escape = (text: string) =>
    text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
  const iconSize = profile.footerIconSize
  const footerItem = (index: number, text: string, icon: string) => {
    const x = footerX + index * (footer.footerCellWidth + profile.footerGap)
    return `<g transform="translate(${x},${footerY - iconSize * 0.8})">${icon}<text class="widget-label" x="${iconSize + profile.footerGap}" y="${iconSize * 0.8}" font-size="${profile.footerFontSize}" font-weight="500">${escape(text)}</text></g>`
  }
  const odometerIcon = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#0a84ff" stroke-width="2"/><path d="m12 12 5-5M5 12h2m5-7v2m5 5h2" fill="none" stroke="#0a84ff" stroke-width="2"/></svg>`
  const clockIcon = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M4 7a9 9 0 1 1-1 9M4 3v5H0m12-2v6l4 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
  const batteryIcon = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M5 5h4v2h6V5h4v2h2v13H3V7h2z" fill="#34c759"/><path d="M7 12h4m6-2v6m-3-3h6" stroke="white" stroke-width="1.5"/></svg>`
  return {
    frame,
    html: `<div class="widget-guide${options.appearance === 'dark' ? ' dark' : ''}" id="preview" style="aspect-ratio:${width}/${height}">
      <svg class="widget-data" viewBox="0 0 ${width} ${height}" aria-label="Live widget preview with sample vehicle data">
        <text class="widget-label" x="${profile.paddingLeft + 25}" y="${profile.paddingTop + profile.titleRowHeight * 0.8}" font-size="25" font-weight="500">${escape(labels.title)}</text>
        <text class="widget-label" text-anchor="end" x="${metricRight}" y="${options.electric ? metricTop + profile.topMetricRowHeight + profile.primaryMetricRowHeight : metricY}" font-size="${profile.rightMetricFontSize}" font-weight="600">${escape(labels.energy)}</text>
        <text class="widget-label" text-anchor="end" x="${metricRight}" y="${options.electric ? metricTop + profile.rightMetricFontSize : metricTop + profile.primaryMetricRowHeight + 2 + profile.secondaryMetricRowHeight * 0.8}" font-size="${profile.rightMetricFontSize}" font-weight="600">${escape(labels.range)}</text>
        ${footerItem(0, labels.odometer, odometerIcon)}
        ${footerItem(1, labels.updated, clockIcon)}
        ${footerItem(2, labels.twelveVolt, batteryIcon)}
      </svg>
      <div class="widget-image-slot" style="left:${(profile.paddingLeft / width) * 100}%;top:${(contentTop / height) * 100}%;width:${(frame.mediaWidth / width) * 100}%;height:${(profile.contentRowHeight / height) * 100}%">
        <canvas id="canvas" width="1200" height="600" role="img" aria-label="Editable vehicle image area" style="left:${(frame.leading / frame.mediaWidth) * 100}%;top:${(frame.top / profile.contentRowHeight) * 100}%;width:${(frame.width / frame.mediaWidth) * 100}%;height:${(frame.height / profile.contentRowHeight) * 100}%"></canvas>
        <button id="resize-image" class="resize-handle" aria-label="Drag to resize image; arrow keys also resize" style="left:calc(${((frame.leading + frame.width) / frame.mediaWidth) * 100}% - 28px);top:calc(${((frame.top + frame.height) / profile.contentRowHeight) * 100}% - 28px)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9V4h5M16 11v5h-5M4 4l12 12" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
      </div>
    </div>`,
  }
}

export const SETTINGS_SCREENS = [
  ['settings', (h) => h.screens.loadConfigScreen(h.bl)],
  ['account', (h) => h.screens.loadAccountSettingsScreen(h.bl)],
  ['welcome', (h) => h.screens.loadAccountSettingsScreen(undefined, true)],
  ['vehicle', (h) => h.screens.loadCarSettingsScreen(h.bl)],
  ['climate', (h) => h.screens.loadClimateSettingsScreen()],
  ['warm', (h) => h.screens.loadStandardClimatePresetScreen('warm')],
  ['cool', (h) => h.screens.loadStandardClimatePresetScreen('cool')],
  ['appearance', (h) => h.screens.loadAppearanceSettingsScreen()],
  ['support', (h) => h.screens.loadSupportScreen(h.bl)],
  ['troubleshooting', (h) => h.screens.loadTroubleshootingScreen()],
]

export function snapshotSettings(h) {
  return h.top().rows.map((row) => ({
    height: row.height,
    background: row.backgroundColor?.hex,
    selectable: !!row.onSelect,
    cells: row.cells.map((cell) => ({
      title: cell.title,
      subtitle: cell.subtitle,
      kind: cell.kind,
      color: cell.titleColor?.hex,
      subtitleColor: cell.subtitleColor?.hex,
      font: cell.titleFont?.name,
      subtitleFont: cell.subtitleFont?.name,
      align: cell.align,
      width: cell.widthWeight,
      actionable: !!cell.onTap,
    })),
  }))
}

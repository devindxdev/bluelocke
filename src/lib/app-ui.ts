// Native iOS text styles and semantic colours shared by the app and Settings.
// UITable keeps text, buttons, and selection behaviour in the system renderer.

export function appColors() {
  const background = Color.dynamic(new Color('F2F2F7'), new Color('1C1C1E'))
  return {
    background,
    surface: background,
    label: Color.dynamic(new Color('1C1C1E'), new Color('F2F2F7')),
    secondary: Color.dynamic(new Color('636366'), new Color('AEAEB2')),
    accent: Color.dynamic(new Color('007AFF'), new Color('0A84FF')),
    separator: Color.dynamic(new Color('E5E5EA'), new Color('38383A')),
    error: Color.dynamic(new Color('C9342D'), new Color('FF6961')),
  }
}

export function appRow(height = 56, grouped = false): UITableRow {
  const row = new UITableRow()
  row.height = height
  row.cellSpacing = 12
  row.dismissOnSelect = false
  row.backgroundColor = grouped ? appColors().surface : appColors().background
  return row
}

export function appText(row: UITableRow, title: string, subtitle?: string): UITableCell {
  const cell = row.addText(title, subtitle)
  cell.titleFont = Font.body()
  cell.titleColor = appColors().label
  cell.subtitleFont = Font.subheadline()
  cell.subtitleColor = appColors().secondary
  cell.leftAligned()
  return cell
}

export function appSpace(height = 12): UITableRow {
  return appRow(height)
}

export function appNavigation(
  navigation: { isRoot: boolean; back: () => void },
  options: { rootAction?: string; enabled?: boolean; dismissOnBack?: boolean } = {},
): UITableRow {
  const row = appRow(44)
  const title = navigation.isRoot ? (options.rootAction ?? 'Done') : '‹ Back'
  const enabled = options.enabled !== false
  if (navigation.isRoot) row.addText('').widthWeight = 60
  const button = enabled ? row.addButton(title) : row.addText(title)
  button.widthWeight = 40
  button.titleFont = Font.body()
  button.titleColor = enabled ? appColors().accent : appColors().secondary
  if (navigation.isRoot) button.rightAligned()
  else button.leftAligned()
  button.dismissOnTap = enabled && (navigation.isRoot || !!options.dismissOnBack)
  if (enabled) button.onTap = navigation.isRoot ? () => {} : navigation.back
  return row
}

export function appHeader(
  title: string,
  options: {
    subtitle?: string
    action?: string
    onAction?: () => any
    enabled?: boolean
    dismissOnAction?: boolean
  } = {},
): UITableRow {
  const row = appRow(options.subtitle || title.length > 18 ? 84 : 64)
  const label = appText(row, title, options.subtitle)
  label.titleFont = Font.title1()
  label.widthWeight = options.action ? 74 : 100
  if (options.action) {
    const enabled = options.enabled !== false && !!options.onAction
    const button = enabled ? row.addButton(options.action) : row.addText(options.action)
    button.widthWeight = 26
    button.titleFont = Font.body()
    button.titleColor = enabled ? appColors().accent : appColors().secondary
    button.rightAligned()
    button.dismissOnTap = options.dismissOnAction ?? false
    if (enabled) button.onTap = options.onAction!
  }
  return row
}

export function appSection(title: string): UITableRow {
  const row = appRow(38)
  const cell = appText(row, title)
  cell.titleFont = Font.footnote()
  cell.titleColor = appColors().secondary
  return row
}

export function appListRow(
  title: string,
  options: {
    subtitle?: string
    value?: string
    onSelect?: () => any
    enabled?: boolean
    destructive?: boolean
    grouped?: boolean
  } = {},
): UITableRow {
  const row = appRow(options.subtitle ? 72 : 56, options.grouped !== false)
  const label = appText(row, title, options.subtitle)
  label.widthWeight = options.value ? 64 : 92
  if (options.destructive) label.titleColor = appColors().error
  const actionable = !!options.onSelect && options.enabled !== false
  if (options.value || actionable) {
    const value = appText(row, options.value ?? '›')
    value.widthWeight = options.value ? 36 : 8
    value.titleFont = Font.body()
    value.titleColor = actionable ? appColors().accent : appColors().secondary
    value.rightAligned()
  }
  if (actionable) row.onSelect = options.onSelect!
  return row
}

export function appCaption(text: string, error = false): UITableRow {
  const row = appRow(44)
  const cell = appText(row, text)
  cell.titleFont = Font.footnote()
  cell.titleColor = error ? appColors().error : appColors().secondary
  return row
}

export function appSeparator(): UITableRow {
  const row = appRow(1)
  row.backgroundColor = appColors().separator
  return row
}

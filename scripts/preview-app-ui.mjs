import fs from 'node:fs'
import path from 'node:path'
import { uiHarness } from './ui-harness.mjs'

const destination = process.argv[2]
if (!destination) throw new Error('Pass the output HTML path')
const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const fontSizes = { title1: 28, body: 17, subheadline: 15, footnote: 13 }
const rowHTML = (row) =>
  `<div class="native-row" style="min-height:${row.height}px;background:#${row.backgroundColor.hex}">${row.cells.map((cell) => `<div class="native-cell" style="flex:${cell.widthWeight ?? 1};text-align:${cell.align ?? 'left'};color:#${cell.titleColor?.hex ?? '1c1c1e'}"><span style="font-size:${fontSizes[cell.titleFont?.name] ?? 17}px">${escape(cell.title)}</span>${cell.subtitle ? `<small style="color:#${cell.subtitleColor?.hex}">${escape(cell.subtitle)}</small>` : ''}</div>`).join('')}</div>`
const screens = []
for (const dark of [false, true]) {
  const h = uiHarness({ dark })
  const opening = h.screens.loadConfigScreen(h.bl)
  await h.flush()
  screens.push(
    `<section><h2>Settings · ${dark ? 'Dark' : 'Light'}</h2><div class="phone" style="background:#${h.ui.appColors().background.hex}">${h.top().rows.map(rowHTML).join('')}</div></section>`,
  )
  h.top().close()
  await opening
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bluelocke · Settings preview</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#e5e5ea;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,sans-serif}h1{font-size:22px;margin:0 0 8px}p{font-size:14px;color:#636366;margin:0 0 28px}main{display:grid;grid-template-columns:repeat(2,minmax(0,375px));gap:32px;align-items:start}h2{font-size:14px;font-weight:500;margin:0 0 12px;color:#636366}.phone{overflow:hidden;border-radius:24px;padding:12px 0}.native-row{display:flex;align-items:center;gap:12px;padding:0 16px}.native-cell{min-width:0;overflow-wrap:anywhere;line-height:1.3}.native-cell small{display:block;margin-top:4px;font-size:15px}section{min-width:0}@media(max-width:600px){body{padding:16px}main{grid-template-columns:minmax(0,375px);gap:24px}}
</style></head><body><h1>Settings</h1><p>Settings layout preview. Final typography and controls are supplied by iOS.</p><main>${screens.join('')}</main></body></html>`
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, html)
console.log(destination)

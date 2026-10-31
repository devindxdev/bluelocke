import fs from 'node:fs'
import path from 'node:path'
import { builtAppHarness } from './built-app-harness.mjs'

const destination = process.argv[2]
if (!destination) throw Error('Pass the output HTML path')
const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const fontSizes = { title1: 28, body: 17, subheadline: 15, footnote: 13 }
const screens = []
for (const account of [false, true]) {
  const h = builtAppHarness({ account })
  await h.flush()
  if (h.errors.length) throw Error(h.errors.join('\n'))
  const rows = h
    .top()
    .rows.map(
      (row) =>
        `<div class="row" style="min-height:${row.height}px;background:#${row.backgroundColor?.hex ?? 'f2f2f7'}">${row.cells.map((cell) => `<div class="cell" style="flex:${cell.widthWeight ?? 1};text-align:${cell.align ?? 'left'};color:#${cell.titleColor?.hex ?? '1c1c1e'}"><span style="font-size:${fontSizes[cell.titleFont?.name] ?? 17}px">${escape(cell.title)}</span>${cell.subtitle ? `<small style="color:#${cell.subtitleColor?.hex ?? '636366'}">${escape(cell.subtitle)}</small>` : ''}</div>`).join('')}</div>`,
    )
    .join('')
  screens.push(
    `<section><h2>${account ? 'Settings' : 'First-time setup'}</h2><div class="phone">${rows}</div></section>`,
  )
  h.top().close()
  await h.execution
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bluelocke — Corrected Settings</title><style>
*{box-sizing:border-box}body{margin:0;padding:28px;background:#e5e5ea;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,sans-serif}h1{font-size:22px;margin:0 0 8px}p{font-size:14px;color:#636366;margin:0 0 24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,375px));gap:28px;align-items:start}h2{font-size:14px;margin:0 0 12px;font-weight:500}.phone{overflow:hidden;border-radius:24px;padding:12px 0;background:#f2f2f7}.row{display:flex;align-items:center;gap:12px;padding:0 16px}.cell{min-width:0;overflow-wrap:anywhere;line-height:1.3}.cell small{display:block;margin-top:4px;font-size:15px}@media(max-width:650px){main{grid-template-columns:minmax(0,375px)}body{padding:16px}}
</style></head><body><h1>Bluelocke · v1.26.0 Settings UI</h1><p>Preview from the corrected build. Native typography and controls are supplied by iOS.</p><main>${screens.join('')}</main></body></html>`
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, html)
console.log(destination)

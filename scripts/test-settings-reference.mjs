import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { uiHarness } from './ui-harness.mjs'
import { SETTINGS_SCREENS, snapshotSettings } from './settings-snapshot.mjs'
const reference = JSON.parse(fs.readFileSync(new URL('./fixtures/v1.26.0-settings.json', import.meta.url), 'utf8'))
for (const dark of [false, true])
  for (const [name, open] of SETTINGS_SCREENS) {
    test(`${dark ? 'dark' : 'light'} ${name}: preserves v1.26.0 layout with vehicle selection added`, async () => {
      const h = uiHarness({ dark, account: name !== 'welcome' })
      const opening = open(h)
      await h.flush()
      const expected = structuredClone(reference.pages[`${dark ? 'dark' : 'light'}/${name}`])
      if (name === 'settings') {
        expected.find((row) => row.cells[0]?.title === 'Vehicle').cells[0].subtitle = 'Selection, display name, and photo'
      }
      if (name === 'vehicle') {
        const selection = structuredClone(expected[2])
        selection.cells[0].title = 'Selected vehicle'
        selection.cells[0].subtitle = '2022 Tucson'
        expected.splice(2, 0, selection, structuredClone(expected[3]))
      }
      assert.deepEqual(JSON.parse(JSON.stringify(snapshotSettings(h))), expected)
      h.top().close()
      await opening
    })
  }

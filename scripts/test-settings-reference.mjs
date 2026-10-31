import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { uiHarness } from './ui-harness.mjs'
import { SETTINGS_SCREENS, snapshotSettings } from './settings-snapshot.mjs'
const reference = JSON.parse(fs.readFileSync(new URL('./fixtures/v1.26.0-settings.json', import.meta.url), 'utf8'))
for (const dark of [false, true])
  for (const [name, open] of SETTINGS_SCREENS) {
    test(`${dark ? 'dark' : 'light'} ${name}: layout, labels, options, and controls match v1.26.0`, async () => {
      const h = uiHarness({ dark, account: name !== 'welcome' })
      const opening = open(h)
      await h.flush()
      assert.deepEqual(
        JSON.parse(JSON.stringify(snapshotSettings(h))),
        reference.pages[`${dark ? 'dark' : 'light'}/${name}`],
      )
      h.top().close()
      await opening
    })
  }

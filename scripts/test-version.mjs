import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')

function runtime(current = 'v1.26.1-beta.1', latest = 'v1.26.0', sourceFile = 'src/lib/version.ts') {
  const calls = []
  const context = vm.createContext({
    Request: class {
      constructor(url) {
        calls.push(url)
        this.response = { statusCode: 200 }
      }
      async loadJSON() {
        return {
          tag_name: latest,
          name: `Bluelocke ${latest}`,
          body: 'Plain text release notes.',
          assets: [
            {
              name: 'bluelocke.js',
              browser_download_url: `https://github.com/devindxdev/bluelocke/releases/download/${latest}/bluelocke.js`,
            },
          ],
        }
      }
    },
  })
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, sourceFile), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInContext(`(function(require,module,exports) {${code}\n})`, context)(
    (dependency) =>
      dependency.endsWith('version.json')
        ? { default: { version: current } }
        : { validateReleaseAssetUrl: (value) => value },
    module,
    module.exports,
  )
  return { Version: module.exports.Version, calls }
}

test('beta identifiers remain visible and compare before their final stable release', () => {
  const { Version } = runtime()
  const beta = new Version('devindxdev', 'bluelocke')
  assert.equal(beta.getCurrentVersion(), 'v1.26.1-beta.1')
  assert.equal(Version.versionToNumber('v1.26.0'), 1260)
  assert.ok(Number.isFinite(Version.versionToNumber(beta.getCurrentVersion())))
  assert.ok(Version.versionToNumber('v1.26.0') < Version.versionToNumber(beta.getCurrentVersion()))
  assert.ok(Version.versionToNumber(beta.getCurrentVersion()) < Version.versionToNumber('v1.26.1'))
})

test('beta builds use stable update metadata without prompting a downgrade', async () => {
  const { Version, calls } = runtime()
  const beta = new Version('devindxdev', 'bluelocke')
  assert.equal(await beta.promptForUpdate(), false)
  assert.equal(await beta.getReleaseVersion(), 'v1.26.0')
  assert.deepEqual(calls, ['https://api.github.com/repos/devindxdev/bluelocke/releases/latest'])
})

test('beta builds can recognize a newer stable release', async () => {
  const { Version } = runtime('v1.26.1-beta.1', 'v1.27.0')
  assert.equal(await new Version('devindxdev', 'bluelocke').promptForUpdate(), true)
})

for (const installed of ['v1.26.0', 'v1.26.1-beta.1']) {
  test(`${installed} recognizes the v1.26.1 rollback release as an update`, async () => {
    const { Version } = runtime(installed, 'v1.26.1')
    const version = new Version('devindxdev', 'bluelocke')
    assert.equal(await version.promptForUpdate(), true)
    assert.equal(await version.getReleaseVersion(), 'v1.26.1')
  })
}

test('a patched installation does not prompt for its current release or older releases', async () => {
  for (const latest of ['v1.26.1', 'v1.26.0']) {
    const { Version } = runtime('v1.26.1', latest)
    assert.equal(await new Version('devindxdev', 'bluelocke').promptForUpdate(), false)
  }
})

test('the actual v1.26.0 updater prompts for v1.27.0 while ignoring a v1.26.1 patch', async () => {
  for (const [latest, expected] of [
    ['v1.26.1', false],
    ['v1.27.0', true],
  ]) {
    const { Version } = runtime('v1.26.0', latest, 'scripts/fixtures/v1.26.0-version.ts')
    assert.equal(await new Version('devindxdev', 'bluelocke').promptForUpdate(), expected)
  }
})

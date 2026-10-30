import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
function harness() {
  const h = {
    files: new Map(),
    requests: [],
    payload: '// Scriptable script\n' + 'x'.repeat(1500),
    failMove: false,
    failStage: false,
  }
  const fm = {
    fileExists: (file) => h.files.has(file),
    write: (file, data) => {
      if (h.failStage) throw Error('Storage full')
      h.files.set(file, data)
    },
    remove: (file) => h.files.delete(file),
    copy: (from, to) => h.files.set(to, h.files.get(from)),
    move: (from, to) => {
      if (h.failMove) throw Error('Move failed')
      h.files.set(to, h.files.get(from))
      h.files.delete(from)
    },
  }
  const context = vm.createContext({
    Script: { name: () => 'Bluelocke' },
    UUID: { string: () => 'test-id' },
    FileManager: { iCloud: () => fm },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 200 }
        h.requests.push(this)
      }
      async load() {
        return { toRawString: () => h.payload }
      }
    },
  })
  const modules = new Map()
  const load = (file) => {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const require = (name) => {
      if (name === 'url') return { default: Url }
      if (name.endsWith('/scriptable-utils')) return { getTable: () => ({ connect: (fn) => fn }), OK: async () => {} }
      if (name.endsWith('/util')) return { getAppLogger: () => ({ log() {} }) }
      if (name.endsWith('secure-url') || name.endsWith('update-security'))
        return load(`src/lib/${name.split('/').pop()}.ts`)
      return {}
    }
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(require, module, module.exports)
    return module.exports
  }
  h.url = load('src/lib/secure-url.ts')
  h.update = load('src/lib/update-security.ts')
  h.about = load('src/about.ts')
  return h
}
const release = 'https://github.com/devindxdev/bluelocke/releases/download/v1.26.0/bluelocke.js'
const script = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/Bluelocke.js'

test('URL checks reject lookalike origins, userinfo, HTTP and ambiguous callback codes', () => {
  const { url } = harness()
  for (const input of [
    'http://trusted.example/callback',
    'https://trusted.example.attacker.test/callback',
    'https://trusted.example@attacker.test/callback',
    'https://trusted.example/callback-extra',
  ])
    assert.equal(url.exactCallback(input, 'https://trusted.example/callback'), false)
  assert.equal(url.exactCallback('https://trusted.example/callback?code=ok', 'https://trusted.example/callback'), true)
  assert.throws(() => url.singleQueryParam('https://trusted.example/callback?code=one&code=two', 'code'))
  assert.equal(url.singleQueryParam('https://trusted.example/callback?code=a%26b', 'code'), 'a&b')
})

test('updates accept only the configured repository release file and HTTPS GitHub asset hosts', () => {
  const { update } = harness()
  assert.equal(update.validateReleaseAssetUrl(release), release)
  for (const value of [
    release.replace('https:', 'http:'),
    release.replace('github.com/', 'github.com.attacker.test/'),
    release.replace('/devindxdev/', '/someone-else/'),
    release.replace('bluelocke.js', 'other.js'),
    release + '?redirect=evil',
    release.replace('v1.26.0', '..'),
    release.replace('v1.26.0', '%2e%2e%2fother'),
  ])
    assert.throws(() => update.validateReleaseAssetUrl(value))
  assert.equal(update.allowedReleaseRedirect('https://release-assets.githubusercontent.com/asset?signature=xyz'), true)
  assert.equal(update.allowedReleaseRedirect('http://release-assets.githubusercontent.com/asset'), false)
  assert.equal(update.allowedReleaseRedirect('https://release-assets.githubusercontent.com.attacker.test/asset'), false)
})

test('invalid update downloads never replace the installed script', async () => {
  const h = harness()
  h.files.set(script, 'original script')
  h.payload = '<html>Not a script</html>'
  assert.equal(await h.about.doUpgrade(release), false)
  assert.equal(h.files.get(script), 'original script')
  assert.equal(h.files.size, 1)
})

test('staging or final installation failure preserves the installed script', async () => {
  for (const failure of ['failStage', 'failMove']) {
    const h = harness()
    h.files.set(script, 'original script')
    h[failure] = true
    assert.equal(await h.about.doUpgrade(release), false)
    assert.equal(h.files.get(script), 'original script')
    assert.ok(![...h.files.keys()].some((file) => file.endsWith('.download')))
  }
})

test('a valid update retains a backup and guards redirects', async () => {
  const h = harness()
  h.files.set(script, 'original script')
  assert.equal(await h.about.doUpgrade(release), true)
  assert.equal(h.files.get(script + '.backup'), 'original script')
  assert.equal(h.files.get(script).toRawString(), h.payload)
  assert.equal(h.requests[0].allowInsecureRequest, false)
  assert.equal(h.requests[0].onRedirect({ url: 'https://attacker.test/payload' }), null)
})

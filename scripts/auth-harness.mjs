import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { Buffer } from 'node:buffer'
import ts from 'typescript'
const ROOT = path.resolve(import.meta.dirname, '..')

export function runtime({ background = false, siri = false, keys = new Map(), name = 'Blue locke' } = {}) {
  const h = { keys, requests: [], forms: [], confirmations: [], photoEdits: [], prompts: [], inputs: [], logs: [] }
  const context = vm.createContext({
    Error,
    Date,
    Buffer,
    console,
    Device: { systemVersion: () => '18.0' },
    Script: { name: () => name },
    config: { runsInWidget: background, runsWithSiri: siri },
    UUID: { string: () => '00000000-0000-4000-8000-000000000001' },
    Keychain: {
      contains: (key) => keys.has(key),
      get: (key) => keys.get(key),
      set: (key, value) => keys.set(key, value),
      remove: (key) => keys.delete(key),
    },
    Timer: { schedule: () => ({ invalidate() {} }) },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 200, headers: {}, cookies: [] }
      }
      async loadJSON() {
        h.requests.push(this)
        if (!h.transport) throw Error('Unexpected network request')
        return h.transport(this)
      }
      async loadString() {
        return this.loadJSON()
      }
    },
  })
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const require = (dep) => {
      if (dep === 'url') return { default: Url }
      if (dep === 'buffer') return { Buffer }
      if (dep.endsWith('/logger'))
        return {
          Logger: class {
            log(text) {
              h.logs.push(text)
            }
          },
        }
      if (dep.replace(/\/$/, '').endsWith('/scriptable-utils'))
        return {
          form: (options) => async (initial) => {
            const form = { options, initial }
            h.forms.push(form)
            return form
          },
          confirm: async (...args) => h.confirmations.push(args),
          textInput: async (...args) => {
            h.prompts.push(args)
            return h.inputs.shift() ?? null
          },
        }
      if (dep.endsWith('/vehicle-image-editor'))
        return { loadVehicleImageSettings: async (bl) => h.photoEdits.push(bl) }
      if (dep.endsWith('/europe-status')) return load('src/lib/bluelink-regions/europe-status.ts')
      if (dep.endsWith('/vehicle-photo')) return { getVehiclePhotoUrl: () => undefined }
      if (dep.endsWith('/util')) return { isNotEmptyObject: (object) => !!object && Object.keys(object).length > 0 }
      const resolved = dep.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(file), dep + '.ts'))
        : 'src/' + dep + '.ts'
      if (
        resolved === 'src/config.ts' ||
        /src\/lib\/bluelink-regions\/(base|canada|usa|usa-kia|europe|india|australia)\.ts$/.test(resolved) ||
        resolved === 'src/lib/log-sanitizer.ts' ||
        resolved === 'src/lib/user-error.ts'
      )
        return load(resolved)
      return {}
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.load = load
  h.settings = load('src/config.ts')
  h.account = {
    ...h.settings.getConfig(),
    manufacturer: 'hyundai',
    auth: { username: 'driver@example.test', password: 'private-password', pin: '1234', region: 'canada' },
  }
  h.Base = load('src/lib/bluelink-regions/base.ts').Bluelink
  return h
}

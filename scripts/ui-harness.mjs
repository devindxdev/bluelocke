import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import Url from 'node:url'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function uiHarness({ dark = false, electric = false, account = true, settingsSource } = {}) {
  const h = {
    tables: [],
    legacyForms: [],
    keys: new Map(),
    choices: [],
    alerts: [],
    alertHistory: [],
    pickers: [],
    messages: [],
    requests: [],
    logs: [],
    writes: 0,
    sleeps: [],
    invalidations: 0,
    photoEdits: 0,
    openedMaps: [],
    symbolBridges: [],
  }
  class Color {
    constructor(hex) {
      this.hex = hex
    }
    static dynamic(light, night) {
      return dark ? night : light
    }
  }
  class Cell {
    constructor(kind, title, subtitle) {
      Object.assign(this, { kind, title, subtitle })
    }
    leftAligned() {
      this.align = 'left'
    }
    rightAligned() {
      this.align = 'right'
    }
    centerAligned() {
      this.align = 'center'
    }
  }
  class Row {
    constructor() {
      this.cells = []
      this.height = 44
    }
    addText(title, subtitle) {
      const cell = new Cell('text', title, subtitle)
      this.cells.push(cell)
      return cell
    }
    addImage(image) {
      const cell = new Cell('image')
      cell.image = image
      this.cells.push(cell)
      return cell
    }
    addButton(title) {
      const cell = new Cell('button', title)
      this.cells.push(cell)
      return cell
    }
  }
  class Size {
    constructor(width, height) {
      Object.assign(this, { width, height })
    }
  }
  class Rect {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height })
    }
  }
  class DrawContext {
    setFillColor(color) {
      this.color = color
    }
    fillRect() {}
    fillEllipse() {}
    drawImageInRect(image, rect) {
      this.draw = { image, rect }
    }
    getImage() {
      return { size: this.size, symbol: this.draw.image.symbol, symbolColor: dark ? 'AEAEB2' : '636366' }
    }
  }
  const getTable = () => {
    let state,
      render,
      options,
      active = false,
      resolve
    const table = {
      getState: () => state,
      isTableActive: () => active,
      setState: (values) => {
        state = { ...state, ...values }
        table.rows = render().flat()
      },
      connect:
        (fn) =>
        (...args) =>
          fn({ state, setState: table.setState }, ...args),
      present: async (opts) => {
        options = opts
        state = opts.defaultState
        render = opts.render
        active = true
        h.tables.push(table)
        table.rows = render().flat()
        options.afterFirstRender?.()
        return new Promise((done) => {
          resolve = done
        })
      },
      close: () => {
        active = false
        resolve(state)
      },
    }
    return table
  }
  class Alert {
    constructor() {
      this.inputs = []
    }
    addTextField(_placeholder, initial) {
      this.inputs.push(initial)
      return { setDecimalPadKeyboard() {}, setEmailAddressKeyboard() {} }
    }
    addSecureTextField(...args) {
      return this.addTextField(...args)
    }
    addAction() {}
    addCancelAction() {}
    async presentAlert() {
      h.alertHistory.push({ title: this.title, message: this.message })
      const answer = h.alerts.shift()
      if (!answer) throw new Error(`Missing answer for ${this.title}`)
      this.inputs[0] = answer.text
      return answer.button ?? 0
    }
    textFieldValue(index) {
      return this.inputs[index]
    }
  }
  const library = {
    getTable,
    form: (options) => async (initial) => {
      const page = { options, initial }
      h.legacyForms.push(page)
      return page
    },
    quickOptions: async (options, settings) => {
      h.pickers.push({ options, settings })
      return h.choices.length ? h.choices.shift() : null
    },
    confirm: async (title, options) => {
      h.messages.push({ title, ...options })
      return false
    },
    destructiveConfirm: async () => false,
  }
  const context = vm.createContext({
    Script: { name: () => 'Bluelocke' },
    Keychain: {
      contains: (key) => h.keys.has(key),
      get: (key) => {
        if (!h.keys.has(key)) throw new Error('Keychain key does not exist')
        return h.keys.get(key)
      },
      set: (key, value) => {
        if (h.failWrites) throw new Error('Storage unavailable')
        h.writes++
        h.keys.set(key, value)
      },
      remove: (key) => {
        if (!h.keys.has(key)) throw new Error('Keychain key does not exist')
        h.keys.delete(key)
      },
    },
    Font: new Proxy(
      {},
      {
        get:
          (_, name) =>
          (...args) => ({ name, args }),
      },
    ),
    Color,
    Size,
    Rect,
    DrawContext,
    SFSymbol: { named: (name) => ({ image: { symbol: name, size: { width: 20, height: 20 } }, applyFont() {} }) },
    Data: {
      fromPNG: (image) => ({ toBase64String: () => Buffer.from(JSON.stringify(image)).toString('base64') }),
      fromBase64String: (value) => value,
    },
    Image: { fromData: (data) => JSON.parse(Buffer.from(data, 'base64').toString()) },
    WebView: class {
      async loadHTML(html) {
        this.html = html
      }
      async evaluateJavaScript(code, callback) {
        h.symbolBridges.push({ code, callback })
        if (callback !== true || !code.trim().startsWith('(function')) throw new Error('Unsupported Promise return')
        return Object.fromEntries(
          [...this.html.matchAll(/data-key="([^"]+)" src="data:image\/png;base64,([^"]+)"/g)].map((match) => [
            match[1],
            match[2],
          ]),
        )
      }
    },
    UITableRow: Row,
    UITableCell: { button: (title) => new Cell('button', title) },
    Alert,
    Device: { systemVersion: () => '18', isUsingDarkAppearance: () => dark },
    CallbackURL: class {
      constructor(url) {
        this.url = url
        this.params = {}
      }
      addParameter(key, value) {
        this.params[key] = value
      }
      open() {
        h.openedMaps.push(this)
      }
    },
    App: {
      close: () => {
        h.closed = true
      },
    },
    console,
  })
  const modules = new Map()
  const allowed = new Set([
    'src/about.ts',
    'src/config.ts',
    'src/lib/storage.ts',
    'src/lib/secure-url.ts',
    'src/lib/update-security.ts',
    'src/lib/user-error.ts',
    'src/lib/log-sanitizer.ts',
    'src/lib/vehicle-photo.ts',
    'src/settings.ts',
    'src/lib/app-ui.ts',
    'src/lib/native-settings.ts',
    'src/lib/settings-navigation.ts',
    'src/lib/bluelink-regions/base.ts',
  ])
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative).exports
    const module = { exports: {} }
    modules.set(relative, module)
    const source = ts.transpileModule(
      relative === 'src/settings.ts' && settingsSource !== undefined
        ? settingsSource
        : fs.readFileSync(path.join(ROOT, relative), 'utf8'),
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      },
    ).outputText
    const require = (dependency) => {
      if (dependency === 'url') return { default: Url }
      if (dependency.endsWith('scriptable-utils')) return library
      if (dependency.endsWith('/util'))
        return {
          getAppLogger: () => ({ log: (text) => h.logs.push(text), readAndRedact: () => h.logs.join('\n') }),
          getSiriLogger: () => ({ readAndRedact: () => '' }),
          getChargingPowerString: (value) => (value ? `${value} kW` : '-'),
          getChargeCompletionString: () => '6:30 PM',
          sleep: () => new Promise((resolve) => h.sleeps.push(resolve)),
        }
      if (dependency.endsWith('/version'))
        return {
          Version: class {
            async promptForUpdate() {
              return false
            }
            getCurrentVersion() {
              return 'v1.0.0'
            }
            async getRelease() {
              if (h.offlineReleases) throw new Error('Offline')
              return { version: 'v1.0.0', notes: 'Example release notes', name: 'Bluelocke', url: '' }
            }
            static versionToNumber(version) {
              return Number(version.replace('v', '').replaceAll('.', ''))
            }
          },
        }
      if (dependency === 'widget' || dependency.endsWith('/widget'))
        return { deleteWidgetCache: () => {}, getWidgetLogger: () => ({ readAndRedact: () => '' }) }
      if (dependency.endsWith('/vehicle-image-editor'))
        return {
          loadVehicleImageSettings: async () => {
            h.photoEdits++
          },
        }
      if (
        dependency.endsWith('/custom-vehicle-image') ||
        dependency.endsWith('/vehicle-images') ||
        dependency.endsWith('/defaultImage') ||
        dependency === 'buffer'
      )
        return {}
      if (dependency.endsWith('/logger'))
        return {
          Logger: class {
            log() {}
          },
        }
      const resolved = dependency.startsWith('.')
        ? path.relative(ROOT, path.resolve(ROOT, path.dirname(relative), dependency + '.ts'))
        : 'src/' + dependency + '.ts'
      if (!allowed.has(resolved)) throw new Error(`Unmocked dependency: ${dependency} from ${relative}`)
      return load(resolved)
    }
    vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: relative })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.config = load('src/config.ts')
  if (account) {
    h.config.setConfig({
      ...h.config.getConfig(),
      auth: { username: 'driver@example.test', password: 'password', region: 'canada', pin: '1234' },
    })
    h.writes = 0
  }
  h.screens = load('src/settings.ts')
  h.about = load('src/about.ts')
  h.ui = load('src/lib/app-ui.ts')
  h.forms = load('src/lib/native-settings.ts')
  h.vehicle = {
    car: { id: 'car', vin: 'VIN-1', nickName: 'Tucson', modelName: 'Tucson', modelYear: '2022', odometer: 25316 },
    status: {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: Date.now() - 120000,
      isCharging: false,
      isPluggedIn: false,
      chargingPower: 0,
      remainingChargeTimeMins: 0,
      range: 415,
      locked: true,
      climate: false,
      soc: 76,
      fuelLevel: 42,
      supportsChargeCommands: electric,
      twelveSoc: 96,
      odometer: 25316,
      ...(electric && { chargeLimit: { acPercent: 80, dcPercent: 80 } }),
    },
  }
  h.clientConfig = h.config.getConfig()
  h.bl = {
    getCachedStatus: () => h.vehicle,
    getConfig: () => h.clientConfig,
    getCarImage: async () => ({ size: { width: 1200, height: 600 } }),
    supportsChargingFeatures: () => electric,
    getDistanceUnit: () => 'km',
    deleteCache: () => {
      h.invalidations++
    },
    refreshAuth: async () => {},
    getStatus: async () => h.vehicle,
    processRequest: async (command, payload, callback) => h.requests.push({ command, payload, callback }),
  }
  h.flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }
  h.top = () => [...h.tables].reverse().find((table) => table.isTableActive())
  h.texts = () =>
    h.top().rows.flatMap((row) => row.cells.flatMap((cell) => [cell.title, cell.subtitle].filter(Boolean)))
  h.tap = async (title) => {
    const table = h.top()
    for (const row of table.rows) {
      for (const cell of row.cells) {
        if (cell.title === title && cell.kind === 'button' && cell.onTap) {
          await cell.onTap()
          if (cell.dismissOnTap) table.close()
          return
        }
      }
      if (row.cells.some((cell) => cell.title === title) && row.onSelect) {
        await row.onSelect()
        if (row.dismissOnSelect) table.close()
        return
      }
    }
    throw new Error(`No enabled action: ${title}`)
  }
  return h
}

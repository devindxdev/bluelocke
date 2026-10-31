import fs from 'node:fs'
import vm from 'node:vm'

// Boot the emitted release itself. Only iOS APIs and the vehicle service are
// simulated; no app modules, routing functions, or Settings renderers are replaced.
export function builtAppHarness({ account = false, background = false } = {}) {
  const h = {
    keys: new Map(),
    files: new Map(),
    tables: [],
    requests: [],
    alerts: [],
    answers: [],
    choices: [],
    errors: [],
  }
  const configKey = 'egmp-scriptable-config-BuiltTest'
  if (account)
    h.keys.set(
      configKey,
      JSON.stringify({
        manufacturer: 'hyundai',
        auth: { username: 'driver@example.test', password: 'password', pin: '1234', region: 'canada' },
      }),
    )
  class Cell {
    constructor(title, subtitle, kind = 'text') {
      Object.assign(this, { title, subtitle, kind })
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
    }
    addText(title, subtitle) {
      const cell = new Cell(title, subtitle)
      this.cells.push(cell)
      return cell
    }
    addButton(title) {
      const cell = new Cell(title, undefined, 'button')
      this.cells.push(cell)
      return cell
    }
    addImage(image) {
      const cell = new Cell(undefined, undefined, 'image')
      cell.image = image
      this.cells.push(cell)
      return cell
    }
    addCell(cell) {
      this.cells.push(cell)
    }
  }
  class Table {
    constructor() {
      this.rows = []
    }
    removeAllRows() {
      this.rows = []
    }
    addRow(row) {
      this.rows.push(row)
    }
    reload() {}
    present() {
      this.active = true
      h.tables.push(this)
      return new Promise((resolve) => {
        this.resolve = resolve
      })
    }
    close() {
      this.active = false
      this.resolve()
    }
  }
  class Color {
    constructor(hex) {
      this.hex = hex
    }
    static dynamic(light) {
      return light
    }
  }
  for (const name of [
    'black',
    'white',
    'gray',
    'lightGray',
    'darkGray',
    'blue',
    'red',
    'green',
    'orange',
    'yellow',
    'clear',
  ])
    Color[name] = () => new Color(name)
  class Alert {
    constructor() {
      this.actions = []
      this.inputs = []
    }
    addAction(text) {
      this.actions.push(text)
    }
    addCancelAction(text) {
      this.actions.push(text)
    }
    addDestructiveAction(text) {
      this.actions.push(text)
    }
    addTextField(_hint, value = '') {
      this.inputs.push(value)
      return { setEmailAddressKeyboard() {}, setDecimalPadKeyboard() {}, setNumberPadKeyboard() {} }
    }
    addSecureTextField(...args) {
      return this.addTextField(...args)
    }
    textFieldValue(i) {
      return this.inputs[i]
    }
    async presentAlert() {
      h.alerts.push(this)
      const answer = h.answers.shift()
      if (answer) {
        this.inputs[0] = answer.text
        return answer.button ?? 0
      }
      return -1
    }
    async presentSheet() {
      h.alerts.push(this)
      const chosen = h.choices.shift() ?? (this.actions.includes('Settings') ? 'Settings' : 'Cancel')
      return this.actions.indexOf(chosen)
    }
    present() {
      return this.presentAlert()
    }
  }
  class Timer {
    invalidate() {}
    schedule(callback) {
      if (!this.repeats) queueMicrotask(callback)
    }
    static schedule(_interval, repeat, callback) {
      const timer = new Timer()
      timer.repeats = repeat
      timer.schedule(callback)
      return timer
    }
  }
  const fm = {
    fileExists: (key) => h.files.has(key),
    readString: (key) => h.files.get(key),
    writeString: (key, value) => h.files.set(key, value),
    fileSize: (key) => (h.files.get(key)?.length ?? 0) / 1024,
    remove: (key) => h.files.delete(key),
    createDirectory() {},
    move: (from, to) => {
      h.files.set(to, h.files.get(from))
      h.files.delete(from)
    },
    joinPath: (a, b) => `${a}/${b}`,
    libraryDirectory: () => '/library',
    documentsDirectory: () => '/documents',
  }
  const context = vm.createContext({
    Error,
    Date,
    queueMicrotask,
    console: {
      log() {},
      warn: (value) => h.errors.push(String(value)),
      error: (value) => h.errors.push(String(value)),
    },
    Script: {
      name: () => 'BuiltTest',
      complete() {
        h.completed = true
      },
    },
    config: { runsInWidget: background, runsWithSiri: false },
    args: {},
    Keychain: {
      contains: (key) => h.keys.has(key),
      get: (key) => h.keys.get(key),
      set: (key, value) => h.keys.set(key, value),
      remove: (key) => h.keys.delete(key),
    },
    FileManager: { iCloud: () => fm, local: () => fm },
    Device: {
      model: () => 'iPhone',
      screenSize: () => ({ width: 390, height: 844 }),
      isPhone: () => true,
      isPad: () => false,
      isUsingDarkAppearance: () => false,
      systemVersion: () => '18.0',
    },
    Font: new Proxy(
      {},
      {
        get:
          (_target, name) =>
          (...args) => ({ name, args }),
      },
    ),
    Color,
    UITable: Table,
    UITableRow: Row,
    UITableCell: {
      text: (title, subtitle) => new Cell(title, subtitle),
      button: (title) => new Cell(title, undefined, 'button'),
      image: (image) => ({ image }),
    },
    Alert,
    Timer,
    UUID: { string: () => '00000000-0000-4000-8000-000000000001' },
    URLScheme: { forRunningScript: () => 'scriptable:///run?scriptName=BuiltTest' },
    Safari: { open() {} },
    App: { close() {} },
    DateFormatter: class {
      string() {
        return '20261031010000'
      }
    },
    Request: class {
      constructor(url) {
        this.url = url
        this.response = { statusCode: 503, headers: {}, cookies: [] }
      }
      async loadJSON() {
        h.requests.push(this)
        throw new Error('Simulated vehicle service outage')
      }
      async load() {
        h.requests.push(this)
        return {}
      }
      async loadString() {
        return this.loadJSON()
      }
    },
  })
  try {
    h.execution = Promise.resolve(
      vm.runInContext(fs.readFileSync(new URL('../build/bluelocke.js', import.meta.url), 'utf8'), context, {
        filename: 'bluelocke.js',
      }),
    ).catch((error) => h.errors.push(error.message))
  } catch (error) {
    h.errors.push(error.message)
  }
  h.flush = async () => {
    for (let n = 0; n < 120; n++) await Promise.resolve()
  }
  h.top = () => [...h.tables].reverse().find((table) => table.active)
  h.texts = () =>
    h.top()?.rows.flatMap((row) => row.cells.flatMap((cell) => [cell.title, cell.subtitle].filter(Boolean))) ?? []
  h.tap = async (title) => {
    const table = h.top()
    for (const row of table?.rows ?? []) {
      const button = row.cells.find((cell) => cell.kind === 'button' && cell.title === title && cell.onTap)
      if (button) {
        await button.onTap()
        if (button.dismissOnTap) table.close()
        await h.flush()
        return
      }
      if (row.cells.some((cell) => cell.title === title) && row.onSelect) {
        await row.onSelect()
        await h.flush()
        return
      }
    }
    throw new Error(`No enabled action: ${title}`)
  }
  return h
}

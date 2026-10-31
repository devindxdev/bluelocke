import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULT_MESSAGE = 'Unable to load your vehicle. Open Bluelocke in Scriptable to try again.'
const SCREENSHOT_ERROR =
  'Failed to set car private-vehicle: {"error":{"errorDesc":"Please try again","errorCode":"7406"},"responseHeader":{"responseCode":1}} request {"url":"https://mybluelink.ca/tods/api/vhcllst","method":"POST","headers":{"Cookie":"private-cookie"},"data":"{\\"vehicleId\\":\\"private-vehicle\\"}"}'

function runtime(mode = 'widget') {
  const h = { logs: [], menus: [], widgets: [], outputs: [], completed: false }
  const account = {
    manufacturer: 'hyundai',
    auth: { region: 'canada', username: 'driver@example.test', password: 'secret', pin: '1234' },
    widgetAppearance: 'white',
  }
  class Stack {
    constructor() {
      this.children = []
    }
    addStack() {
      const item = new Stack()
      this.children.push(item)
      return item
    }
    addText(text) {
      const item = { text }
      this.children.push(item)
      return item
    }
    addSpacer() {}
    layoutVertically() {}
  }
  class Widget extends Stack {
    setPadding() {}
  }
  class Color {
    constructor(hex) {
      this.hex = hex
    }
    static red() {
      return new Color('red')
    }
    static white() {
      return new Color('white')
    }
    static black() {
      return new Color('black')
    }
  }
  const logger = { log: (text) => h.logs.push(text), readAndRedact: () => h.logs.join('\n') }
  const context = vm.createContext({
    Error,
    console,
    config: { runsInWidget: mode === 'widget', runsWithSiri: mode === 'shortcut' },
    Script: {
      name: () => 'Bluelocke',
      setWidget: (widget) => h.widgets.push(widget),
      setShortcutOutput: (output) => h.outputs.push(output),
      complete: () => {
        h.completed = true
      },
    },
    URLScheme: { forRunningScript: () => 'scriptable:///run?scriptName=Bluelocke' },
    App: {
      close: () => {
        h.closed = true
      },
    },
    Color,
    ListWidget: Widget,
    Font: { boldSystemFont: (size) => ({ size }), systemFont: (size) => ({ size }) },
    Device: { isUsingDarkAppearance: () => false },
  })
  const modules = new Map()
  const source = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText
  const require = (dependency) => {
    if (dependency.endsWith('user-error')) return load('src/lib/user-error.ts')
    if (dependency.endsWith('log-sanitizer')) return load('src/lib/log-sanitizer.ts')
    if (dependency === 'widget') return load('src/widget.ts')
    if (dependency === 'config') return { getConfig: () => account, configExists: () => true }
    if (dependency.endsWith('/settings')) return { hasCompleteAccountSettings: () => true }
    if (dependency === 'lib/bluelink')
      return {
        initRegionalBluelink: async () => {
          if (h.loginFailed) return { loginFailed: () => true }
          throw h.initError
        },
      }
    if (dependency.endsWith('/util')) return { getAppLogger: () => logger, getSiriLogger: () => logger }
    if (dependency.endsWith('/scriptable-utils'))
      return { quickOptions: async (_options, options) => h.menus.push(options), confirm: async () => {} }
    if (dependency.endsWith('/logger'))
      return {
        Logger: class {
          log(text) {
            logger.log(text)
          }
        },
      }
    return {}
  }
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    vm.runInContext(`(function(require, module, exports) {\n${source(file)}\n})`, context, { filename: file })(
      require,
      module,
      module.exports,
    )
    return module.exports
  }
  h.helper = load('src/lib/user-error.ts')
  h.widget = load('src/widget.ts')
  h.initError = new Error(SCREENSHOT_ERROR)
  h.initialize = async () => {
    context.require = require
    context.exports = {}
    await vm.runInContext(source('src/index.ts'), context, { filename: 'src/index.ts' })
  }
  h.texts = (widget) => {
    const result = []
    const visit = (item) => {
      if ('text' in item) result.push(item.text)
      for (const child of item.children || []) visit(child)
    }
    visit(widget)
    return result
  }
  return h
}

test('ordinary server errors, strings, and spoofed objects use the generic public message', () => {
  const h = runtime()
  for (const error of [
    new Error(SCREENSHOT_ERROR),
    SCREENSHOT_ERROR,
    { publicMessage: SCREENSHOT_ERROR },
    null,
    undefined,
  ]) {
    assert.equal(h.helper.getUserErrorMessage(error), DEFAULT_MESSAGE)
  }
})

test('typed user-facing errors retain actionable guidance', () => {
  const h = runtime()
  const message = 'Open Bluelocke in Scriptable to enter your verification code.'
  assert.equal(h.helper.getUserErrorMessage(new h.helper.UserFacingError(message)), message)
})

test('error widgets hide raw request details and open the current script when tapped', () => {
  const h = runtime()
  const widget = h.widget.createErrorWidget(SCREENSHOT_ERROR, { widgetAppearance: 'white' })
  assert.deepEqual(h.texts(widget), ['Error', DEFAULT_MESSAGE])
  assert.equal(widget.url, 'scriptable:///run?scriptName=Bluelocke')
  const typed = h.widget.createErrorWidget(new h.helper.UserFacingError('Sign in again in Scriptable.'), {
    widgetAppearance: 'white',
  })
  assert.deepEqual(h.texts(typed), ['Error', 'Sign in again in Scriptable.'])
})

for (const mode of ['app', 'widget', 'shortcut']) {
  test(`${mode}: initialization failure keeps request JSON in sanitized diagnostics and shows only safe guidance`, async () => {
    const h = runtime(mode)
    await h.initialize()
    const shown =
      mode === 'app' ? h.menus.map((menu) => menu.title) : mode === 'widget' ? h.texts(h.widgets[0]) : h.outputs
    assert.ok(shown.includes(DEFAULT_MESSAGE))
    for (const value of ['private-vehicle', 'private-cookie', '7406', 'headers', 'Cookie', 'vhcllst'])
      assert.ok(!shown.join('\n').includes(value))
    assert.ok(h.logs.some((line) => line.includes('7406')))
    assert.ok(!h.logs.join('\n').includes('private-cookie'))
    if (mode !== 'app') assert.equal(h.completed, true)
  })
}

for (const mode of ['widget', 'shortcut']) {
  test(`${mode}: known authentication failure preserves Canada verification guidance`, async () => {
    const h = runtime(mode)
    h.loginFailed = true
    await h.initialize()
    const shown = mode === 'widget' ? h.texts(h.widgets[0]) : h.outputs
    assert.ok(shown.some((text) => text.includes('Canada 2FA') && text.includes('verification code')))
  })
}

test('typed initialization errors retain their safe guidance in the widget', async () => {
  const h = runtime()
  h.initError = new h.helper.UserFacingError('Another sign-in is already in progress. Try again shortly.')
  await h.initialize()
  assert.ok(h.texts(h.widgets[0]).includes(h.initError.publicMessage))
})

test('shared error dialogs hide request details while keeping sanitized diagnostics', () => {
  const h = runtime('app')
  const displayed = [],
    saved = []
  const file = 'src/lib/scriptable-utils/errorHandling.ts'
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(
    (dep) => {
      if (dep.endsWith('/confirm')) return { OK: (title, opts) => displayed.push({ title, ...opts }) }
      if (dep.endsWith('/PersistedLog')) return { default: () => ({ log: (entry) => saved.push(entry) }) }
      if (dep.endsWith('/user-error')) return h.helper
      if (dep.endsWith('/log-sanitizer')) return { sanitizeLog: () => 'sanitized request diagnostics' }
      throw Error(dep)
    },
    module,
    module.exports,
  )
  module.exports.alertAndLogError(new Error(SCREENSHOT_ERROR), 'status refresh')
  assert.equal(displayed[0].message, DEFAULT_MESSAGE)
  assert.equal(saved[0].error, 'sanitized request diagnostics')
})

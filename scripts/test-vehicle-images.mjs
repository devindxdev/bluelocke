import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'
import Url from 'node:url'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const plain = (value) => JSON.parse(JSON.stringify(value))
const photo = (width = 1600, height = 900) => ({ size: { width, height } })

function harness() {
  const h = {
    name: 'Bluelocke',
    files: new Map(),
    keys: new Map(),
    writes: 0,
    nextId: 0,
    failWriteAt: undefined,
    failKeychain: false,
    failCleanup: false,
    option: null,
    selectedImage: photo(),
    selectedPaths: [],
    editorCrop: { zoom: 1, x: 0.5, y: 0.5 },
    confirmations: [],
    messages: [],
    imageLogs: [],
    webEvaluations: [],
    answers: [],
    reviewActions: [],
    requests: [],
    imageRequests: [],
    imageResponses: new Map(),
    runtimeConfig: { runsInWidget: false, runsWithSiri: false },
    imports: [],
    previews: [],
    widgetPreviews: [],
    menus: [],
    editorReady: true,
    previewFamily: 'Medium Widget',
    previewSettings: { widgetAppearance: 'white', distanceUnit: 'km' },
    presentations: 0,
    fullscreenRequests: [],
    html: '',
  }
  const fileManager = {
    libraryDirectory: () => '/library',
    joinPath: (left, right) => path.posix.join(left, right),
    createDirectory: () => {},
    fileExists: (file) => h.files.has(file),
    readImage: (file) => {
      const image = h.files.get(file)
      if (image instanceof Error) throw image
      return image
    },
    writeImage: (file, image) => {
      h.writes++
      if (h.failWriteAt === h.writes) throw new Error('Out of storage')
      h.files.set(file, image)
    },
    remove: (file) => {
      if (h.failCleanup) throw new Error('Cannot remove')
      h.files.delete(file)
    },
    downloadFileFromiCloud: async (file) => h.imports.push(file),
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
    drawImageInRect(image, rect) {
      this.draw = { image, rect }
    }
    getImage() {
      return { size: this.size, draw: this.draw, opaque: this.opaque, respectScreenScale: this.respectScreenScale }
    }
  }
  class Color {
    constructor(hex) {
      this.hex = hex
    }
    static white() {
      return new Color('ffffff')
    }
    static black() {
      return new Color('000000')
    }
    static green() {
      return new Color('34c759')
    }
    static red() {
      return new Color('ff3b30')
    }
  }
  class WidgetStack {
    constructor() {
      this.children = []
    }
    addStack() {
      const stack = new WidgetStack()
      this.children.push(stack)
      return stack
    }
    addImage(image) {
      const item = { image }
      this.children.push(item)
      return item
    }
    addText(text) {
      const item = { text, leftAlignText() {}, rightAlignText() {} }
      this.children.push(item)
      return item
    }
    addSpacer(size) {
      this.children.push({ spacer: size })
    }
    layoutVertically() {}
    layoutHorizontally() {}
    centerAlignContent() {}
  }
  class ListWidget extends WidgetStack {
    setPadding(...padding) {
      this.padding = padding
    }
    async presentMedium() {
      if (h.failWidgetPreview) throw new Error('Could not present widget')
      h.widgetPreviews.push({ family: 'medium', widget: this })
    }
    async presentSmall() {
      h.widgetPreviews.push({ family: 'small', widget: this })
    }
  }
  const ask = async (title, options) => {
    h.confirmations.push(title)
    h.messages.push({ title, ...plain(options || {}) })
    if (h.failConfirmationTitle === title) throw new Error('Could not show confirmation')
    return h.answers.length ? h.answers.shift() : true
  }
  const context = vm.createContext({
    Script: { name: () => h.name },
    Keychain: {
      contains: (key) => h.keys.has(key),
      get: (key) => h.keys.get(key),
      set: (key, value) => {
        if (h.failKeychain) throw new Error('Keychain unavailable')
        h.keys.set(key, value)
      },
      remove: (key) => h.keys.delete(key),
    },
    UUID: { string: () => `00000000-0000-4000-8000-${String(++h.nextId).padStart(12, '0')}` },
    FileManager: { local: () => fileManager, iCloud: () => fileManager },
    Size,
    Rect,
    DrawContext,
    Color,
    ListWidget,
    Font: new Proxy({}, { get: (_, name) => (size) => ({ name, size }) }),
    Device: { screenSize: () => ({ width: 440, height: 956 }), isUsingDarkAppearance: () => false },
    SFSymbol: { named: () => ({ image: photo(20, 20) }) },
    Timer: {
      schedule: () => {
        throw new Error('A preview must not start a refresh timer')
      },
    },
    Data: { fromPNG: () => ({ toBase64String: () => 'AA==' }), fromBase64String: (value) => value },
    Image: { fromFile: (file) => h.files.get(file), fromData: () => h.embeddedImage || photo() },
    Photos: {
      fromLibrary: async () => {
        if (h.photoError) throw h.photoError
        return h.selectedImage
      },
    },
    DocumentPicker: {
      open: async (types) => {
        h.pickerTypes = plain(types)
        return h.selectedPaths
      },
    },
    QuickLook: { present: async (image) => h.previews.push(image) },
    WebView: class {
      async loadHTML(html) {
        h.html = html
      }
      async present(fullscreen) {
        h.presentations++
        h.fullscreenRequests.push(fullscreen)
      }
      async evaluateJavaScript(code, useCallback) {
        h.webEvaluations.push({ code, useCallback })
        if (code.includes('vehicleImagePreviewReady')) {
          if (h.failEditorStartup) throw new Error('Native editor startup failed')
          let completed = false
          let completionValue
          const value = vm.runInNewContext(code, {
            window: { vehicleImagePreviewReady: Promise.resolve(h.editorReady) },
            completion: (result) => {
              completed = true
              completionValue = result
            },
          })
          // Native WKWebView does not unwrap Promises like Playwright's page.evaluate does.
          if (value && typeof value.then === 'function') {
            throw new Error('JavaScript execution returned a result of an unsupported type')
          }
          await Promise.resolve()
          assert.equal(completed, true)
          return completionValue
        }
        if (code.includes('getVehicleImagePreviewAppearance')) return h.editorAppearance
        return h.editorCrop
      }
    },
    Request: class {
      constructor(url) {
        this.url = url
        h.requests.push(url)
        h.imageRequests.push(this)
      }
      async loadImage() {
        if (h.imageResponses.has(this.url)) {
          const response = h.imageResponses.get(this.url)
          if (response instanceof Error) throw response
          return response
        }
        if (h.failImageDownloads) throw new Error('Image download failed')
        return h.builtinImage || photo(800, 400)
      }
    },
    config: h.runtimeConfig,
    console,
  })
  const modules = new Map()
  function load(relative) {
    const file = path.resolve(ROOT, relative)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }
    modules.set(file, module)
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const localRequire = (name) => {
      if (name.endsWith('scriptable-utils'))
        return {
          confirm: ask,
          destructiveConfirm: ask,
          quickOptions: async (options, settings) => {
            h.menus.push(plain(options))
            if (settings.title === 'How does your image look?') {
              return h.reviewActions.length
                ? h.reviewActions.shift()
                : h.answers.shift() === false
                  ? 'Keep Current'
                  : 'Use Image'
            }
            return settings.title === 'Preview with sample data' ? h.previewFamily : h.option
          },
        }
      if (name.endsWith('/util'))
        return {
          getIconName: (key) => key,
          getTintedIconAsync: async () => photo(20, 20),
          tintSFSymbol: async () => ({ image: photo(20, 20) }),
          getBatteryPercentColor: () => Color.green(),
          getChargingIcon: () => undefined,
          getChargingPowerString: () => '0 kW',
          dateStringOptions: { hour: 'numeric', minute: '2-digit' },
        }
      if (name.endsWith('/vehicle-images')) return { resolveVehicleImage: () => h.vehicleImageOverride }
      if (name.endsWith('/defaultImage')) return { defaultImage: '' }
      if (name.endsWith('/logger') || name.endsWith('/config')) return {}
      if (name === 'buffer') return { Buffer }
      if (name === 'url') return { default: Url }
      return load(path.relative(ROOT, path.resolve(path.dirname(file), name + '.ts')))
    }
    const wrapper = vm.runInContext(`(function(require, module, exports) {\n${source}\n})`, context, { filename: file })
    wrapper(localRequire, module, module.exports)
    return module.exports
  }
  h.apiPhotos = load('src/lib/vehicle-photo.ts')
  h.geometry = load('src/lib/vehicle-image-geometry.ts')
  h.storage = load('src/lib/custom-vehicle-image.ts')
  h.editor = load('src/lib/vehicle-image-editor.ts')
  h.widget = load('src/widget.ts')
  h.layout = load('src/lib/widget-layout.ts')
  h.previewData = load('src/lib/widget-preview-data.ts')
  h.evaluateNative = (code, useCallback) => new context.WebView().evaluateJavaScript(code, useCallback)
  h.bl = () => ({
    getCachedStatus: () => ({ car: { id: 'car-id', vin: 'VIN-1' } }),
    getConfig: () => h.previewSettings,
    getLogger: () => ({
      log: (message) => {
        if (h.failLogging) throw new Error('Logging is unavailable')
        h.imageLogs.push(message)
      },
    }),
    supportsChargingFeatures: () => false,
    getCarImage: async () => h.storage.getCustomVehicleImage('VIN-1') || photo(1200, 600),
    getStatus: () => {
      throw new Error('Preview attempted to fetch vehicle status')
    },
    refreshAuth: () => {
      throw new Error('Preview attempted to refresh authentication')
    },
  })
  h.base = () => {
    const { Bluelink } = load('src/lib/bluelink-regions/base.ts')
    const bl = Object.create(Bluelink.prototype)
    bl.cache = { car: { id: 'car-id', vin: 'VIN-1', modelName: 'Unknown', modelYear: '2026' } }
    bl.config = { manufacturer: 'hyundai', debugLogging: false }
    return bl
  }
  return h
}

test('fit preserves aspect ratio and fill crops to a wide frame', () => {
  const { geometry: g } = harness()
  assert.deepEqual(
    plain(g.getVehicleImagePlacement({ width: 800, height: 800 }, g.VEHICLE_IMAGE_SIZE, { zoom: 1, x: 0.5, y: 0.5 })),
    { x: 300, y: 0, width: 600, height: 600 },
  )
  assert.deepEqual(
    plain(g.getVehicleImagePlacement({ width: 800, height: 800 }, g.VEHICLE_IMAGE_SIZE, { zoom: 2, x: 0.5, y: 0.5 })),
    { x: 0, y: -300, width: 1200, height: 1200 },
  )
})

test('crop controls are finite and clamped, including tall portraits', () => {
  const { geometry: g } = harness()
  assert.deepEqual(plain(g.normalizeVehicleImageCrop({ width: 800, height: 800 }, { zoom: Infinity, x: -3, y: NaN })), {
    zoom: 1,
    x: 0,
    y: 0.5,
  })
  assert.equal(g.getMaximumImageZoom({ width: 200, height: 1600 }), 16)
  assert.equal(g.normalizeVehicleImageCrop({ width: 800, height: 800 }, { zoom: 100, y: 10 }).zoom, 4)
})

test('editor and native renderer share a standalone placement function', () => {
  const { geometry: g, editor } = harness()
  const serialized = vm.runInNewContext(`(${g.getVehicleImagePlacement.toString()})`)
  const args = [{ width: 500, height: 1200 }, g.VEHICLE_IMAGE_SIZE, { zoom: 3, x: 0.8, y: 0.2 }]
  assert.deepEqual(plain(serialized(...args)), plain(g.getVehicleImagePlacement(...args)))
  const html = editor.vehicleImageEditorHTML('AA==', args[0], args[2])
  assert.ok(html.includes(g.getVehicleImagePlacement.toString()))
  assert.ok(html.includes("default-src 'none'"))
  assert.ok(!html.includes('https://'))
})

test('large images are resized without upscaling small images or flattening transparency', () => {
  const h = harness()
  const resized = h.storage.prepareVehicleImage(photo(8000, 6000))
  assert.deepEqual(plain(resized.size), { width: 1600, height: 1200 })
  assert.equal(resized.opaque, false)
  assert.equal(resized.respectScreenScale, false)
  const small = photo(300, 150)
  assert.equal(h.storage.prepareVehicleImage(small), small)
  for (const invalid of [photo(0, 10), photo(NaN, 10), photo(10000, 10000), null]) {
    assert.throws(() => h.storage.prepareVehicleImage(invalid), /valid image/)
  }
})

test('save retains source and crop, creates a bounded transparent PNG, and replaces old files', () => {
  const h = harness()
  const crop = { zoom: 2, x: 0.8, y: 0.25 }
  const rendered = h.storage.saveCustomVehicleImage('VIN-1', photo(2000, 1000), crop)
  assert.deepEqual(plain(rendered.size), { width: 1200, height: 600 })
  assert.equal(rendered.opaque, false)
  assert.equal(h.files.size, 2)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), rendered)
  assert.deepEqual(plain(h.storage.getCustomVehicleImageSource('VIN-1').crop), crop)
  assert.deepEqual(plain(h.storage.getCustomVehicleImageSource('VIN-1').image.size), { width: 1600, height: 800 })
  h.storage.saveCustomVehicleImage('VIN-1', photo(), { zoom: 1 })
  assert.equal(h.files.size, 2)
})

test('images are isolated by vehicle and exact script name, including punctuation', () => {
  const h = harness()
  h.name = 'Car A'
  const first = h.storage.saveCustomVehicleImage('VIN-1', photo())
  h.name = 'CarA'
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  h.name = 'Car A'
  assert.equal(h.storage.getCustomVehicleImage('VIN-2'), undefined)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), first)
  h.name = 'a:b'
  h.storage.saveCustomVehicleImage('c', photo())
  h.name = 'a'
  assert.equal(h.storage.getCustomVehicleImage('b:c'), undefined)
})

test('failed file write or keychain commit keeps the previous image and removes staged files', () => {
  for (const failure of ['source', 'rendered', 'keychain']) {
    const h = harness()
    const previous = h.storage.saveCustomVehicleImage('VIN-1', photo())
    const previousKeys = [...h.keys.entries()]
    if (failure === 'keychain') h.failKeychain = true
    else h.failWriteAt = h.writes + (failure === 'source' ? 1 : 2)
    assert.throws(() => h.storage.saveCustomVehicleImage('VIN-1', photo(600, 600)))
    assert.equal(h.storage.getCustomVehicleImage('VIN-1'), previous)
    assert.deepEqual([...h.keys.entries()], previousKeys)
    assert.equal(h.files.size, 2)
  }
})

test('missing, corrupt, or invalid custom-image records fail open to built-in images', () => {
  const h = harness()
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  h.storage.saveCustomVehicleImage('VIN-1', photo())
  const renderedPath = [...h.files.keys()].find((file) => !file.endsWith('-source.png'))
  h.files.set(renderedPath, new Error('Corrupt PNG'))
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  h.files.delete(renderedPath)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  const key = [...h.keys.keys()][0]
  h.keys.set(key, '{bad json')
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  h.keys.set(key, JSON.stringify({ id: '../../outside' }))
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
})

test('reset removes only the current vehicle image and tolerates cleanup failures', () => {
  const h = harness()
  h.storage.saveCustomVehicleImage('VIN-1', photo())
  const other = h.storage.saveCustomVehicleImage('VIN-2', photo())
  h.failCleanup = true
  h.storage.removeCustomVehicleImage('VIN-1')
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  assert.equal(h.storage.getCustomVehicleImage('VIN-2'), other)
})

test('shared app/widget loader prioritizes custom images even during force refresh', async () => {
  const h = harness()
  const image = h.storage.saveCustomVehicleImage('VIN-1', photo())
  const bl = h.base()
  assert.equal(await bl.getCarImage(), image)
  assert.equal(await bl.getCarImage('white', true), image)
  assert.equal(h.requests.length, 0)
  h.storage.removeCustomVehicleImage('VIN-1')
  const builtin = await bl.getCarImage()
  assert.notEqual(builtin, image)
  assert.equal(h.requests.length, 1)
})

test('cancelled picker and declined save leave the current image unchanged', async () => {
  const h = harness()
  const current = h.storage.saveCustomVehicleImage('VIN-1', photo())
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 0)
  h.option = 'Choose from Photos'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), current)
  assert.equal(h.writes, 2)
})

test('confirmed photo import saves the preview crop and can reopen it for adjustment', async () => {
  const h = harness()
  h.option = 'Choose from Photos'
  h.editorCrop = { zoom: 2.5, x: 0.2, y: 0.8 }
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.deepEqual(plain(h.storage.getCustomVehicleImageSource('VIN-1').crop), h.editorCrop)
  h.option = 'Preview & Adjust Image'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.ok(h.html.includes('"zoom":2.5,"x":0.2,"y":0.8'))
  assert.equal(h.files.size, 2)
})

test('Files import accepts images only, downloads iCloud content, and handles cancellation', async () => {
  const h = harness()
  h.option = 'Choose from Files'
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 0)
  h.selectedPaths = ['/picked/image.png']
  h.files.set('/picked/image.png', photo(800, 600))
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.deepEqual(h.pickerTypes, ['public.image'])
  assert.deepEqual(h.imports, ['/picked/image.png'])
  assert.ok(h.storage.getCustomVehicleImage('VIN-1'))
})

test('unreadable files, denied permissions, and an unloaded editor never replace a saved image', async () => {
  for (const failure of ['file', 'permission', 'preview']) {
    const h = harness()
    const current = h.storage.saveCustomVehicleImage('VIN-1', photo())
    h.option = failure === 'file' ? 'Choose from Files' : 'Choose from Photos'
    h.selectedPaths = ['/unreadable.png']
    if (failure === 'permission') h.photoError = new Error('Photos permission denied')
    if (failure === 'preview') h.editorCrop = null
    await h.editor.loadVehicleImageSettings(h.bl())
    assert.equal(h.storage.getCustomVehicleImage('VIN-1'), current)
    assert.ok(h.confirmations.includes('We could not update your vehicle image'))
    assert.equal(h.writes, 2)
  }
})

test('live preview opens directly, does not save on cancel, and reset requires confirmation', async () => {
  const h = harness()
  const current = h.storage.saveCustomVehicleImage('VIN-1', photo())
  h.option = 'Preview & Adjust Image'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.widgetPreviews.length, 0)
  assert.equal(h.writes, 2)
  assert.equal(h.requests.length, 0)
  h.option = 'Restore Default Image'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), current)
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
  assert.equal(h.files.size, 0)
})

const widgetItems = (stack) => stack.children.flatMap((child) => (child.children ? widgetItems(child) : [child]))

test('all supported image frames fit inside the left column and its vertical bounds', () => {
  const h = harness()
  for (const screenWidth of [320, 375, 390, 414, 428, 440]) {
    const profile = h.layout.getMediumWidgetGeometry(screenWidth)
    for (const size of [
      { width: 1200, height: 600 },
      { width: 400, height: 1600 },
      { width: 1600, height: 200 },
    ]) {
      const frame = h.layout.getMediumWidgetImageFrame(profile, size)
      assert.ok(frame.height <= profile.contentRowHeight + 1e-9)
      assert.ok(frame.leading + frame.width <= frame.mediaWidth - profile.mediaRightSafetyInset + 1e-9)
      assert.ok(frame.top + frame.height <= profile.contentRowHeight + 1e-9)
      assert.ok(Math.abs(frame.width / frame.height - size.width / size.height) < 1e-9)
    }
  }
  const wide = h.layout.getMediumWidgetImageFrame(h.layout.getMediumWidgetGeometry(440), { width: 1200, height: 600 })
  assert.deepEqual(plain(wide), { mediaWidth: 215, width: 200, height: 100, leading: 15, top: 0 })
})

test('native medium preview reuses the widget layout with only dummy data and no keychain writes', async () => {
  const h = harness()
  const image = photo(1200, 600)
  const widget = await h.widget.createVehicleImageWidgetPreview(image, 'medium', {
    screenWidth: 440,
    appearance: 'white',
    distanceUnit: 'km',
    electric: false,
  })
  const items = widgetItems(widget)
  const texts = items.filter((item) => 'text' in item).map((item) => item.text)
  for (const expected of ['   Example Vehicle', 'Fuel 42%', '~285 km', '37046 km', '12V 96%'])
    assert.ok(texts.includes(expected), expected)
  const imageItem = items.find((item) => item.image === image)
  assert.deepEqual(plain(imageItem.imageSize), { width: 200, height: 100 })
  assert.equal(h.requests.length, 0)
  assert.equal(h.writes, 0)
  assert.equal(h.keys.size, 0)
})

test('native small/electric/dark preview uses dummy battery and chosen distance units', async () => {
  const h = harness()
  const widget = await h.widget.createVehicleImageWidgetPreview(photo(1200, 600), 'small', {
    screenWidth: 390,
    appearance: 'dark',
    distanceUnit: 'mi',
    electric: true,
  })
  const texts = widgetItems(widget)
    .filter((item) => 'text' in item)
    .map((item) => item.text)
  assert.ok(texts.includes('Range 285 mi'))
  assert.ok(texts.includes('76%'))
  assert.ok(texts.includes('12V 96%'))
  assert.equal(widget.backgroundColor.hex, '000000')
  assert.equal(h.requests.length, 0)
  assert.equal(h.keys.size, 0)
})

test('native small ICE preview includes fuel, range, and the auxiliary battery reading', async () => {
  const h = harness()
  const widget = await h.widget.createVehicleImageWidgetPreview(photo(1200, 600), 'small', {
    screenWidth: 390,
    appearance: 'white',
    distanceUnit: 'mi',
    electric: false,
  })
  const texts = widgetItems(widget)
    .filter((item) => 'text' in item)
    .map((item) => item.text)
  for (const text of ['Fuel 42%', 'Range 285 mi', '12V 96%']) assert.ok(texts.includes(text), text)
})

test('live widget includes dummy metrics around the directly editable image area', () => {
  const h = harness()
  const options = { screenWidth: 440, appearance: 'dark', distanceUnit: 'km', electric: false }
  const html = h.editor.vehicleImageEditorHTML('AA==', { width: 1600, height: 900 }, undefined, options)
  for (const text of ['Example Vehicle', 'Fuel 42%', '~285 km', '37046 km', '12V 96%', 'Live widget'])
    assert.ok(html.includes(text), text)
  assert.ok(html.includes('200 &times; 100 point image area'))
  assert.ok(html.includes('class="widget-guide dark"'))
  assert.ok(html.includes('vehicleImagePreviewReady'))
  assert.ok(html.includes('id="resize-image"'))
  assert.ok(html.includes("canvas.addEventListener('wheel'"))
  assert.ok(!html.includes('The next screen'))
})

test('editing stays in one live widget screen before confirmation without opening a native preview', async () => {
  const h = harness()
  h.option = 'Choose from Photos'
  h.answers = [false]
  h.editorCrop = { zoom: 2, x: 0.3, y: 0.7 }
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.widgetPreviews.length, 0)
  assert.ok(h.confirmations.includes('Use this vehicle image?'))
  assert.equal(h.writes, 0)
  assert.equal(h.keys.size, 0)
})

test('an image that fails to decode never opens a blank editor or overwrites a saved image', async () => {
  const h = harness()
  const current = h.storage.saveCustomVehicleImage('VIN-1', photo())
  h.option = 'Choose from Photos'
  h.editorReady = false
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 0)
  assert.equal(h.widgetPreviews.length, 0)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), current)
  assert.equal(h.writes, 2)
})

test('reset is always offered and clears custom image state even if its file is unreadable', async () => {
  const h = harness()
  h.storage.saveCustomVehicleImage('VIN-1', photo())
  const renderedPath = [...h.files.keys()].find((file) => !file.endsWith('-source.png'))
  h.files.set(renderedPath, new Error('Corrupt PNG'))
  h.option = 'Restore Default Image'
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.ok(h.menus[0].includes('Restore Default Image'))
  assert.equal(h.keys.size, 0)
  assert.equal(h.files.size, 0)
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), undefined)
})

test('restore returns to the matched Tucson picture rather than a generic replacement', async () => {
  const h = harness()
  const original = photo(1100, 500)
  h.vehicleImageOverride = {
    cacheKey: 'vehicle-image-tucson-nline-white.png',
    imageUrl: 'https://example.invalid/tucson-nline-white.png',
  }
  h.files.set('/library/vehicle-image-tucson-nline-white.png', original)
  const custom = h.storage.saveCustomVehicleImage('VIN-1', photo())
  const bl = h.base()
  bl.cache.car.modelName = 'Tucson N Line'
  bl.cache.car.modelTrim = 'N Line'
  bl.cache.car.modelColour = 'white'
  assert.equal(await bl.getCarImage(), custom)
  h.storage.removeCustomVehicleImage('VIN-1')
  assert.equal(await bl.getCarImage(), original)
  assert.equal(h.requests.length, 0)
})

test('editing does not depend on the native widget presenter being available', async () => {
  const h = harness()
  h.storage.saveCustomVehicleImage('VIN-1', photo())
  h.failWidgetPreview = true
  h.option = 'Choose from Photos'
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.widgetPreviews.length, 0)
  assert.equal(h.writes, 4)
  assert.ok(!h.confirmations.includes('We could not update your vehicle image'))
})

test('preview and adjust opens the saved source and crop immediately', async () => {
  const h = harness()
  const original = h.storage.saveCustomVehicleImage('VIN-1', photo(), { zoom: 2, x: 0.25, y: 0.75 })
  h.option = 'Preview & Adjust Image'
  h.editorCrop = { zoom: 2, x: 0.25, y: 0.75 }
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.widgetPreviews.length, 0)
  assert.equal(h.writes, 2)
  assert.ok(h.html.includes('"zoom":2,"x":0.25,"y":0.75'))
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), original)
  assert.deepEqual(plain(h.storage.getCustomVehicleImageSource('VIN-1').crop), h.editorCrop)
})

test('live preview uses the widget appearance without changing settings on cancel', async () => {
  const h = harness()
  h.option = 'Choose from Photos'
  h.previewSettings.widgetAppearance = 'dark'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.widgetPreviews.length, 0)
  assert.ok(h.html.includes('class="widget-guide dark"'))
  assert.equal(h.previewSettings.widgetAppearance, 'dark')
  assert.equal(h.keys.size, 0)
})

test('zoom preserves the photo point under the fingers or cursor', () => {
  const h = harness()
  const source = { width: 1600, height: 900 }
  const frame = h.geometry.VEHICLE_IMAGE_SIZE
  const crop = { zoom: 2, x: 0.5, y: 0.5 }
  const anchor = { x: 700, y: 350 }
  const before = h.geometry.getVehicleImagePlacement(source, frame, crop)
  const next = h.geometry.zoomVehicleImageAt(source, frame, crop, 3, anchor)
  const after = h.geometry.getVehicleImagePlacement(source, frame, next)
  assert.ok(Math.abs((anchor.x - before.x) / before.width - (anchor.x - after.x) / after.width) < 1e-9)
  assert.ok(Math.abs((anchor.y - before.y) / before.height - (anchor.y - after.y) / after.height) < 1e-9)
  assert.equal(next.zoom, 3)
})

test('direct zoom is bounded and its serialized function is standalone in the minified editor', () => {
  const h = harness()
  const zoom = vm.runInNewContext(`(${h.geometry.zoomVehicleImageAt.toString()})`)
  const source = { width: 800, height: 800 }
  const frame = { width: 1200, height: 600 }
  const crop = { zoom: 1, x: 0.5, y: 0.5 }
  const anchor = { x: 600, y: 300 }
  for (const [value, expected] of [
    [-100, 0.5],
    [1000, 4],
    [NaN, 1],
  ]) {
    const result = zoom(source, frame, crop, value, anchor)
    assert.equal(result.zoom, expected)
    assert.ok(result.x >= 0 && result.x <= 1)
    assert.ok(result.y >= 0 && result.y <= 1)
  }
})

test('preview and adjust is available for the original image before a custom photo is chosen', async () => {
  const h = harness()
  h.option = 'Preview & Adjust Image'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.widgetPreviews.length, 0)
  assert.equal(h.writes, 0)
  assert.equal(h.keys.size, 0)
})

function liveEditorHarness() {
  const h = harness()
  const nodes = new Map()
  let draws = 0
  const node = (id) => {
    if (nodes.has(id)) return nodes.get(id)
    const listeners = new Map()
    const classes = new Set()
    const element = {
      value: '',
      textContent: '',
      hidden: true,
      naturalWidth: 1600,
      classList: {
        contains: (key) => classes.has(key),
        toggle: (key, force) => {
          if (force) classes.add(key)
          else classes.delete(key)
        },
      },
      addEventListener(type, fn) {
        listeners.set(type, [...(listeners.get(type) || []), fn])
      },
      setPointerCapture() {},
      setAttribute() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
      getContext: () => ({
        clearRect() {},
        drawImage() {
          draws++
        },
      }),
      emit(type, values = {}) {
        const event = {
          target: element,
          prevented: false,
          cancelable: true,
          propagationStopped: false,
          preventDefault() {
            this.prevented = true
          },
          stopPropagation() {
            this.propagationStopped = true
          },
          ...values,
        }
        for (const fn of listeners.get(type) || []) fn(event)
        return event
      },
    }
    Object.defineProperty(element, 'src', {
      set() {
        element.onload?.()
      },
    })
    nodes.set(id, element)
    return element
  }
  const html = h.editor.vehicleImageEditorHTML('AA==', { width: 1600, height: 900 })
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const window = {}
  vm.runInNewContext(script, { window, document: { getElementById: node } })
  return { node, crop: () => plain(window.getVehicleImageCrop()), draws: () => draws }
}

test('live pointer gestures pinch in place and continue as a drag after lifting one finger', () => {
  const h = liveEditorHarness()
  const canvas = h.node('canvas')
  canvas.emit('pointerdown', { pointerId: 1, clientX: 60, clientY: 50 })
  canvas.emit('pointerdown', { pointerId: 2, clientX: 140, clientY: 50 })
  canvas.emit('pointermove', { pointerId: 1, clientX: 40, clientY: 50 })
  canvas.emit('pointermove', { pointerId: 2, clientX: 160, clientY: 50 })
  assert.equal(h.crop().zoom, 1.5)
  const pinched = h.crop()
  canvas.emit('pointerup', { pointerId: 1 })
  canvas.emit('lostpointercapture', { pointerId: 1 })
  canvas.emit('pointermove', { pointerId: 2, clientX: 180, clientY: 60 })
  assert.equal(h.crop().zoom, pinched.zoom)
  assert.notEqual(h.crop().x, pinched.x)
  assert.equal(h.node('live-zoom').textContent, '150%')
  canvas.emit('pointerup', { pointerId: 2 })
  assert.equal(canvas.classList.contains('dragging'), false)
  assert.ok(h.draws() > 3)
})

test('an ignored third pointer and its cancellation do not interrupt a live pinch', () => {
  const h = liveEditorHarness()
  const canvas = h.node('canvas')
  canvas.emit('pointerdown', { pointerId: 1, clientX: 60, clientY: 50 })
  canvas.emit('pointerdown', { pointerId: 2, clientX: 140, clientY: 50 })
  canvas.emit('pointerdown', { pointerId: 3, clientX: 100, clientY: 20 })
  canvas.emit('pointercancel', { pointerId: 3 })
  canvas.emit('pointermove', { pointerId: 2, clientX: 180, clientY: 50 })
  assert.equal(h.crop().zoom, 1.5)
  canvas.emit('pointercancel', { pointerId: 1 })
  canvas.emit('pointercancel', { pointerId: 2 })
  assert.equal(canvas.classList.contains('dragging'), false)
})

test('corner handle, mouse wheel, keyboard, and sliders all redraw the same live widget', () => {
  const h = liveEditorHarness()
  const handle = h.node('resize-image')
  handle.emit('pointerdown', { pointerId: 7, clientX: 180, clientY: 80 })
  handle.emit('pointermove', { pointerId: 7, clientX: 200, clientY: 100 })
  handle.emit('pointerup', { pointerId: 7 })
  assert.ok(h.crop().zoom > 1.3)
  const beforeWheel = h.crop().zoom
  const wheel = h.node('canvas').emit('wheel', { deltaY: -100, clientX: 100, clientY: 50 })
  assert.equal(wheel.prevented, true)
  assert.ok(h.crop().zoom > beforeWheel)
  const beforeKey = h.crop().zoom
  handle.emit('keydown', { key: 'ArrowLeft' })
  assert.ok(Math.abs(h.crop().zoom - beforeKey / 1.1) < 1e-9)
  h.node('zoom').value = '2'
  h.node('zoom').emit('input')
  assert.equal(h.crop().zoom, 2)
  assert.equal(h.node('live-zoom').textContent, '200%')
  assert.ok(h.draws() >= 5)
})

test('native readiness check rejects the old Promise return and accepts the fixed callback-only result', async () => {
  const h = harness()
  await assert.rejects(h.evaluateNative('window.vehicleImagePreviewReady.then(completion)', true), /unsupported type/)
  assert.equal(await h.evaluateNative(h.editor.VEHICLE_IMAGE_EDITOR_READY_SCRIPT, true), true)
  h.editorReady = false
  assert.equal(await h.evaluateNative(h.editor.VEHICLE_IMAGE_EDITOR_READY_SCRIPT, true), false)
})

test('a photo opens the editor through the native-safe readiness bridge', async () => {
  const h = harness()
  h.option = 'Choose from Photos'
  h.answers = [false]
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.equal(h.presentations, 1)
  assert.equal(h.webEvaluations[0].code, h.editor.VEHICLE_IMAGE_EDITOR_READY_SCRIPT)
  assert.equal(h.webEvaluations[0].useCallback, true)
  assert.ok(h.webEvaluations[0].code.startsWith('void '))
  assert.ok(!h.confirmations.includes('We could not update your vehicle image'))
  assert.equal(h.writes, 0)
})

test('startup errors include the precise stage and reason without changing the saved image', async () => {
  for (const failLogging of [false, true]) {
    const h = harness()
    const original = h.storage.saveCustomVehicleImage('VIN-1', photo())
    h.failEditorStartup = true
    h.failLogging = failLogging
    h.option = 'Choose from Photos'
    await h.editor.loadVehicleImageSettings(h.bl())
    const alert = h.messages.at(-1)
    assert.equal(alert.title, 'We could not update your vehicle image')
    assert.ok(alert.message.includes('Step: Starting the live editor'))
    assert.ok(alert.message.includes('Details: Native editor startup failed'))
    assert.ok(alert.message.includes('Your previous image has not been changed.'))
    assert.equal(h.storage.getCustomVehicleImage('VIN-1'), original)
    assert.equal(h.writes, 2)
    assert.equal(h.presentations, 0)
    if (!failLogging) assert.ok(h.imageLogs.at(-1).includes('Starting the live editor'))
  }
})

test('storage errors are identified as save failures and preserve the previous photo', async () => {
  const h = harness()
  const original = h.storage.saveCustomVehicleImage('VIN-1', photo())
  h.failWriteAt = h.writes + 2
  h.option = 'Choose from Photos'
  await h.editor.loadVehicleImageSettings(h.bl())
  const alert = h.messages.at(-1)
  assert.ok(alert.message.includes('Step: Saving the vehicle image'))
  assert.ok(alert.message.includes('Out of storage'))
  assert.equal(h.storage.getCustomVehicleImage('VIN-1'), original)
  assert.equal(h.files.size, 2)
})

test('a confirmation error after a successful save does not falsely claim the previous image was kept', async () => {
  const h = harness()
  h.option = 'Choose from Photos'
  h.failConfirmationTitle = 'Your vehicle image is saved'
  await h.editor.loadVehicleImageSettings(h.bl())
  assert.ok(h.storage.getCustomVehicleImage('VIN-1'))
  const alert = h.messages.at(-1)
  assert.equal(alert.title, 'Your image was updated, but something went wrong')
  assert.ok(alert.message.includes('Your image change was saved.'))
  assert.ok(!alert.message.includes('Your previous image has not been changed.'))
})

test('error details are bounded and never include the photo payload', () => {
  const h = harness()
  const payload = 'AAAA'.repeat(500)
  const detail = h.editor.formatVehicleImageError(
    new Error(`Could not decode data:image/png;base64,${payload}\nTry another image.`),
  )
  assert.ok(detail.includes('[image data]'))
  assert.ok(!detail.includes(payload))
  assert.ok(!detail.includes('data:image'))
  assert.ok(detail.length <= 300)
  assert.equal(h.editor.formatVehicleImageError({ message: 'Native bridge error' }), 'Native bridge error')
})

test('image import and adjustment use fullscreen instead of an iOS swipe-to-dismiss sheet', async () => {
  for (const option of ['Choose from Photos', 'Preview & Adjust Image']) {
    const h = harness()
    h.option = option
    h.answers = [false]
    await h.editor.loadVehicleImageSettings(h.bl())
    assert.deepEqual(h.fullscreenRequests, [true])
    assert.equal(h.writes, 0)
    assert.equal(h.keys.size, 0)
  }
})

test('touching or dragging the photo and resize handle cannot initiate page scrolling', () => {
  const h = liveEditorHarness()
  for (const id of ['canvas', 'resize-image']) {
    for (const type of ['touchstart', 'touchmove']) {
      const event = h.node(id).emit(type)
      assert.equal(event.prevented, true)
      assert.equal(event.propagationStopped, true)
    }
    const uncancelable = h.node(id).emit('touchmove', { cancelable: false })
    assert.equal(uncancelable.prevented, false)
    assert.equal(uncancelable.propagationStopped, true)
  }
})

test('touch scrolling is not globally disabled for the editor controls or surrounding page', () => {
  const h = liveEditorHarness()
  for (const id of ['zoom', 'x', 'y', 'preview']) {
    const event = h.node(id).emit('touchmove')
    assert.equal(event.prevented, false)
    assert.equal(event.propagationStopped, false)
  }
})

test('a matching GitHub trim image takes priority over the API photo, including cached and custom images', async () => {
  const h = harness()
  const bl = h.base()
  bl.cache.car.photoUrl = 'https://images.example.test/tucson.jpeg'
  h.vehicleImageOverride = {
    cacheKey: 'tucson-nline-white.png',
    imageUrl: 'https://raw.githubusercontent.com/example/tucson.png',
  }
  const githubImage = photo(1200, 600)
  h.imageResponses.set(h.vehicleImageOverride.imageUrl, githubImage)
  assert.equal(await bl.getCarImage(), githubImage)
  assert.deepEqual(h.requests, [h.vehicleImageOverride.imageUrl])
  h.requests.length = 0
  assert.equal(await bl.getCarImage(), githubImage)
  assert.equal(h.requests.length, 0)
  const custom = h.storage.saveCustomVehicleImage('VIN-1', photo())
  assert.equal(await bl.getCarImage('white', true), custom)
  assert.equal(h.requests.length, 0)
})

test('an unmatched trim uses its API photo before the existing generic model/default image', async () => {
  const h = harness()
  const bl = h.base()
  bl.cache.car.modelName = 'Ioniq 5'
  bl.cache.car.photoUrl = 'https://images.example.test/my-car.jpeg'
  const apiImage = photo(1000, 550)
  h.imageResponses.set(bl.cache.car.photoUrl, apiImage)
  // An old generic cache must not hide the more accurate API photo.
  h.files.set('/library/ioniq5_white.png', photo())
  assert.equal(await bl.getCarImage(), apiImage)
  assert.deepEqual(h.requests, [bl.cache.car.photoUrl])
})

for (const damagedCache of [false, true])
  test(`a failed GitHub download${damagedCache ? ' with a corrupt local image' : ''} falls through to the API photo`, async () => {
    const h = harness()
    const bl = h.base()
    bl.cache.car.photoUrl = 'https://images.example.test/vehicle.png'
    h.vehicleImageOverride = {
      cacheKey: 'matched-tucson.png',
      imageUrl: 'https://raw.githubusercontent.com/example/missing.png',
    }
    if (damagedCache) h.files.set('/library/matched-tucson.png', new Error('Corrupt image'))
    h.imageResponses.set(h.vehicleImageOverride.imageUrl, new Error('404'))
    const apiImage = photo(1000, 500)
    h.imageResponses.set(bl.cache.car.photoUrl, apiImage)
    assert.equal(await bl.getCarImage(), apiImage)
    assert.deepEqual(h.requests, [h.vehicleImageOverride.imageUrl, bl.cache.car.photoUrl])
  })

test('a missing or unavailable API photo preserves the old default fallback and does not retry the API twice', async () => {
  for (const url of [null, 'https://images.example.test/unavailable.png']) {
    const h = harness()
    const bl = h.base()
    bl.cache.car.photoUrl = url
    h.files.set('/library/ioniq5_white.png', new Error('Corrupt default cache'))
    if (url) h.imageResponses.set(url, new Error('Image expired'))
    const fallback = photo(800, 400)
    h.builtinImage = fallback
    assert.equal(await bl.getCarImage(), fallback)
    assert.equal(h.requests.filter((request) => request === url).length, url ? 1 : 0)
    assert.ok(h.requests.at(-1).includes('/car-images/'))
  }
  const h = harness()
  const bl = h.base()
  bl.cache.car.photoUrl = 'https://images.example.test/unavailable.png'
  h.failImageDownloads = true
  const embedded = photo(400, 200)
  h.embeddedImage = embedded
  assert.equal(await bl.getCarImage(), embedded)
  assert.equal(h.requests.filter((url) => url === bl.cache.car.photoUrl).length, 1)
})

test('API photos are cached for offline loads and a failed forced refresh can reuse that photo', async () => {
  const h = harness()
  const bl = h.base()
  bl.cache.car.photoUrl = 'https://images.example.test/vehicle.jpeg'
  const apiImage = photo(900, 500)
  h.imageResponses.set(bl.cache.car.photoUrl, apiImage)
  assert.equal(await bl.getCarImage(), apiImage)
  h.imageResponses.set(bl.cache.car.photoUrl, new Error('Offline'))
  assert.equal(await bl.getCarImage(), apiImage)
  assert.equal(h.requests.length, 1)
  assert.equal(await bl.getCarImage('white', true), apiImage)
  assert.equal(h.requests.length, 2)
})

test('API photo caches stay separate for each vehicle and exact script name', async () => {
  const h = harness()
  const a = h.base()
  const b = h.base()
  b.cache.car.vin = 'VIN-2'
  const url = 'https://images.example.test/shared-endpoint.jpeg'
  a.cache.car.photoUrl = b.cache.car.photoUrl = url
  const first = photo(900, 500)
  const second = photo(1000, 600)
  h.imageResponses.set(url, first)
  assert.equal(await a.getCarImage(), first)
  h.imageResponses.set(url, second)
  assert.equal(await b.getCarImage(), second)
  h.name = 'Blue locke'
  const third = photo(1100, 550)
  h.imageResponses.set(url, third)
  assert.equal(await a.getCarImage(), third)
  h.name = 'Bluelocke'
  assert.equal(await a.getCarImage(), first)
  assert.equal(await b.getCarImage(), second)
  assert.equal(h.requests.length, 3)
})

test('a changed API URL replaces its cached file and a damaged cache is downloaded again', async () => {
  const h = harness()
  const bl = h.base()
  bl.cache.car.photoUrl = 'https://images.example.test/old.jpeg'
  await bl.getCarImage()
  const oldPath = [...h.files.keys()].find((file) => file.includes('/api-vehicle-photo-'))
  bl.cache.car.photoUrl = 'https://images.example.test/new.jpeg'
  const replacement = photo(1100, 650)
  h.imageResponses.set(bl.cache.car.photoUrl, replacement)
  assert.equal(await bl.getCarImage(), replacement)
  assert.equal(h.files.has(oldPath), false)
  const newPath = [...h.files.keys()].find((file) => file.includes('/api-vehicle-photo-'))
  h.files.set(newPath, new Error('Corrupt image'))
  assert.equal(await bl.getCarImage(), replacement)
  assert.equal(h.requests.length, 3)
})

test('an API photo still displays when cache storage fails and widgets use a bounded unauthenticated request', async () => {
  for (const failure of ['file', 'keychain']) {
    const h = harness()
    const bl = h.base()
    h.runtimeConfig.runsInWidget = true
    bl.cache.car.photoUrl = 'https://images.example.test/vehicle.jpeg'
    const apiImage = photo(900, 550)
    h.imageResponses.set(bl.cache.car.photoUrl, apiImage)
    if (failure === 'file') h.failWriteAt = 1
    else h.failKeychain = true
    assert.equal(await bl.getCarImage(), apiImage)
    assert.equal(h.imageRequests[0].timeoutInterval, 5)
    assert.equal(h.imageRequests[0].headers, undefined)
    assert.equal(h.files.size, 0)
  }
})

test('regional photo fields and Kia USA image paths normalize to usable HTTP image URLs', () => {
  const { apiPhotos } = harness()
  for (const field of ['photoUrl', 'photoURL', 'imageUrl', 'imageURL']) {
    assert.equal(
      apiPhotos.getVehiclePhotoUrl({ [field]: ' https://images.example.test/car.jpeg?version=2 ' }),
      'https://images.example.test/car.jpeg?version=2',
    )
  }
  assert.equal(
    apiPhotos.getVehiclePhotoUrl({ photoUrl: '/vin/car.jpeg' }, 'https://mybluelink.ca/tods/api/'),
    'https://mybluelink.ca/vin/car.jpeg',
  )
  assert.equal(
    apiPhotos.getVehiclePhotoUrl(
      { imagePath: { imagePath: '/content/dam/kia/us/owners/image/vehicle-app/', imageName: 'ev6.png' } },
      'https://owners.kia.com/',
    ),
    'https://owners.kia.com/content/dam/kia/us/owners/image/vehicle-app/ev6.png',
  )
  for (const value of [
    undefined,
    null,
    '',
    'null',
    'file:///photo.png',
    'javascript:alert(1)',
    'https://user:password@example.test/car.png',
    42,
    {},
  ]) {
    assert.equal(apiPhotos.getVehiclePhotoUrl({ photoUrl: value }), undefined)
  }
  assert.equal(
    apiPhotos.getVehiclePhotoUrl(
      { supportedApp: { appImage: { imagePath: '/app/', imageName: 'logo.png' } } },
      'https://owners.kia.com/',
    ),
    undefined,
  )
})

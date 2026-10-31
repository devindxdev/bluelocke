import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const modules = new Map()
function load(file) {
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const require = (dep) =>
    dep.endsWith('/scriptable-utils') ? {} : load(path.resolve(path.dirname(file), dep + '.ts'))
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(require, module, module.exports)
  return module.exports
}
const { vehicleImageEditorHTML } = load(path.join(root, 'src/lib/vehicle-image-editor.ts'))
const { defaultImage } = load(path.join(root, 'src/resources/defaultImage.ts'))
const output = path.resolve(process.argv[2] || '/tmp/bluelocke-vehicle-preview.html')
fs.writeFileSync(output, vehicleImageEditorHTML(defaultImage, { width: 200, height: 79 }))
console.log(output)

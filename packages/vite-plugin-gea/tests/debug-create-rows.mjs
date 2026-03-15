/**
 * Minimal test to debug 01 create rows - run with: npx tsx tests/debug-create-rows.mjs
 */
import { JSDOM } from 'jsdom'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { geaPlugin } from '../index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, 'fixtures/benchmark-table.jsx')

// Setup JSDOM
const dom = new JSDOM('<!doctype html><html><body></body></html>')
dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  NodeFilter: dom.window.NodeFilter,
  MutationObserver: dom.window.MutationObserver,
  Event: dom.window.Event,
  CustomEvent: dom.window.CustomEvent,
  requestAnimationFrame: dom.window.requestAnimationFrame,
  cancelAnimationFrame: dom.window.cancelAnimationFrame,
})

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

async function main() {
  const { default: Component } = await import('../../gea/src/lib/base/component.tsx')
  const { Store } = await import('../../gea/src/lib/store.ts')
  const store = new Store({ data: [] })

  const source = `import { Component } from 'gea'
import store from './benchmark-store.ts'
export default class T extends Component {
  template() {
    return (
      <table><tbody id="tbody">
        {store.state.data.map(item => (
          <tr key={item.id}><td>{item.id}</td><td>{item.label}</td></tr>
        ))}
      </tbody></table>
    )
  }
}`

  const plugin = geaPlugin()
  const transform = plugin.transform?.handler || plugin.transform
  const result = await transform?.call({}, source, fixturePath)
  const code = result?.code || result
  const compiledSource = `${code
    .replace(/^import .*;$/gm, '')
    .replaceAll('import.meta.hot', 'undefined')
    .replaceAll('import.meta.url', '""')
    .replace(/export default class\s+/, 'class ')}
return T;`

  const Cls = new Function('Component', 'store', compiledSource)(Component, store)
  const root = document.createElement('div')
  document.body.appendChild(root)
  const view = new Cls()
  view.render(root)

  console.log('Before set - root tr count:', root.querySelectorAll('tbody tr').length)
  console.log('view.__stores:', view.__stores)
  console.log('store === view.__stores?.store:', store === view.__stores?.store)
  console.log('view.element_:', view.element_)
  console.log('view.el:', view.el)
  console.log('view.$("#tbody"):', view.$('#tbody'))
  console.log('root.innerHTML:', root.innerHTML?.slice(0, 200))

  store.state.data = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, label: `row ${i + 1}` }))
  await flush()

  const rowCount = root.querySelectorAll('tbody tr').length
  console.log('After set - root tr count:', rowCount)
  console.log('root innerHTML length:', root.innerHTML?.length)
  assert.equal(rowCount, 1000, `expected 1000 rows, got ${rowCount}`)
  console.log('OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

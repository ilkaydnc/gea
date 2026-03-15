import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { JSDOM } from 'jsdom'

import { geaPlugin } from '../index'

const __dirname = dirname(fileURLToPath(import.meta.url))

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  dom.window.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
  dom.window.cancelAnimationFrame = (id: number) => clearTimeout(id)

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Element: globalThis.Element,
    Node: globalThis.Node,
    NodeFilter: globalThis.NodeFilter,
    MutationObserver: globalThis.MutationObserver,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  }

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

  return () => {
    Object.assign(globalThis, previous)
    dom.window.close()
  }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

async function cleanupDelay() {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

async function compileJsxComponent(source: string, id: string, className: string, bindings: Record<string, unknown>) {
  const plugin = geaPlugin()
  const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform?.handler
  const result = await transform?.call({} as never, source, id)
  assert.ok(result)

  const code = typeof result === 'string' ? result : result.code
  const compiledSource = `${code
    .replace(/^import .*;$/gm, '')
    .replaceAll('import.meta.hot', 'undefined')
    .replaceAll('import.meta.url', '""')
    .replace(/export default class\s+/, 'class ')}
return ${className};`

  return new Function(...Object.keys(bindings), compiledSource)(...Object.values(bindings))
}

async function loadRuntimeModules(seed: string) {
  const { default: ComponentManager } = await import('../../gea/src/lib/base/component-manager')
  ComponentManager.instance = undefined
  return Promise.all([
    import(`../../gea/src/lib/base/component.tsx?${seed}`),
    import(`../../gea/src/lib/store.ts?${seed}`),
  ])
}

function buildRows(count: number, startId = 1) {
  return Array.from({ length: count }, (_, i) => ({ id: startId + i, label: `row ${startId + i}` }))
}

// ---------------------------------------------------------------------------
// Vanilla baseline — matches the DOM structure of our gea component
// ---------------------------------------------------------------------------

const rowTemplate = (() => {
  const tr = (() => {
    try {
      return document.createElement('tr')
    } catch {
      return null
    }
  })()
  if (tr) tr.innerHTML = '<td> </td><td> </td>'
  return tr
})()

function ensureTemplate() {
  if (rowTemplate) return rowTemplate
  const tr = document.createElement('tr')
  tr.innerHTML = '<td> </td><td> </td>'
  return tr
}

function vanillaCreateRow(tmpl: HTMLElement, id: number, label: string) {
  const tr = tmpl.cloneNode(true) as HTMLElement
  tr.firstChild!.firstChild!.nodeValue = String(id)
  tr.firstChild!.nextSibling!.firstChild!.nodeValue = label
  return tr
}

class VanillaBench {
  tbody: HTMLElement
  rows: HTMLElement[] = []
  data: Array<{ id: number; label: string }> = []
  tmpl: HTMLElement

  constructor(tbody: HTMLElement) {
    this.tbody = tbody
    this.tmpl = ensureTemplate()
  }

  populate(count: number, startId = 1) {
    this.rows = []
    this.data = []
    this.tbody.textContent = ''
    const detached = !this.tbody.parentNode
    if (!detached) this.tbody.remove()
    for (let i = 0; i < count; i++) {
      const id = startId + i
      const label = `row ${id}`
      const tr = vanillaCreateRow(this.tmpl, id, label)
      this.rows.push(tr)
      this.data.push({ id, label })
      this.tbody.appendChild(tr)
    }
    if (!detached) document.body.appendChild(this.tbody)
  }

  update() {
    for (let i = 0; i < this.data.length; i += 10) {
      this.data[i].label += ' !!!'
      this.rows[i].firstChild!.nextSibling!.firstChild!.nodeValue = this.data[i].label
    }
  }

  swap() {
    if (this.data.length <= 998) return
    this.tbody.insertBefore(this.rows[998], this.rows[2])
    this.tbody.insertBefore(this.rows[1], this.rows[999])
    const tmp = this.rows[998]
    this.rows[998] = this.rows[1]
    this.rows[1] = tmp
    const tmpd = this.data[998]
    this.data[998] = this.data[1]
    this.data[1] = tmpd
  }

  removeRow(idx: number) {
    this.rows[idx].remove()
    this.rows.splice(idx, 1)
    this.data.splice(idx, 1)
  }

  clear() {
    this.tbody.textContent = ''
    this.rows = []
    this.data = []
  }

  append(count: number, startId: number) {
    for (let i = 0; i < count; i++) {
      const id = startId + i
      const label = `row ${id}`
      const tr = vanillaCreateRow(this.tmpl, id, label)
      this.rows.push(tr)
      this.data.push({ id, label })
      this.tbody.appendChild(tr)
    }
  }

  replace(count: number, startId: number) {
    this.tbody.textContent = ''
    this.rows = []
    this.data = []
    for (let i = 0; i < count; i++) {
      const id = startId + i
      const label = `row ${id}`
      const tr = vanillaCreateRow(this.tmpl, id, label)
      this.rows.push(tr)
      this.data.push({ id, label })
      this.tbody.appendChild(tr)
    }
  }
}

// ---------------------------------------------------------------------------
// Gea setup
// ---------------------------------------------------------------------------

async function setupGea(seed: string) {
  const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
  const store = new Store({ data: [] as Array<{ id: number; label: string }> })

  const fixturePath = join(__dirname, 'fixtures/benchmark-table.jsx')
  const Cls = await compileJsxComponent(
    `import { Component } from 'gea'
     import store from './benchmark-store.ts'
     export default class T extends Component {
       template() {
         return (
           <table><tbody id="tbody">
             {store.data.map(item => (
               <tr key={item.id}><td>{item.id}</td><td>{item.label}</td></tr>
             ))}
           </tbody></table>
         )
       }
     }`,
    fixturePath,
    'T',
    { Component, store },
  )

  const root = document.createElement('div')
  document.body.appendChild(root)
  const view = new Cls()
  view.render(root)
  return { store, view, root }
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

const WARMUP = 3
const RUNS = 7

function median(arr: number[]) {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface SimResult {
  vanilla: number
  gea: number
  slowdown: number
}

function report(name: string, r: SimResult) {
  const color = r.slowdown <= 1.5 ? '🟢' : r.slowdown <= 3 ? '🟡' : '🔴'
  console.log(
    `    ${color} ${name.padEnd(24)} vanilla ${r.vanilla.toFixed(2).padStart(8)}ms   ` +
      `gea ${r.gea.toFixed(2).padStart(8)}ms   slowdown ${r.slowdown.toFixed(2)}x`,
  )
}

// ---------------------------------------------------------------------------
// Benchmark simulations
// ---------------------------------------------------------------------------
//
// This suite runs the same operations in JSDOM for both vanilla DOM and gea
// (compiled component + store) and reports gea/vanilla slowdown ratios.
// It finishes in ~5–6s vs ~5min for the full browser benchmark.
//
// RELIABILITY:
// - Ratios do NOT match the real benchmark numerically. In the browser, DOM/
//   layout/paint dominate, so gea is only ~1.1–1.5x slower than vanilla. In
//   JSDOM, vanilla DOM is cheap, so ratios are much higher (2–18x). That’s
//   expected.
// - Use the simulation for: (1) regression checks — re-run after a change and
//   compare ratios; a big jump (e.g. remove row 1.8x → 15x) indicates a regression.
//   (2) Relative ordering — which operations are costliest for gea (e.g.
//   partial update vs remove row) correlates with real benchmark ordering.
// - For final numbers and cross-framework comparison, run the full benchmark
//   and the report (see .cursor/skills/js-framework-benchmark-report/SKILL.md).
//

describe('benchmark simulation: gea vs vanilla slowdown', () => {
  test('01 create rows (1k)', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      const { store, root } = await setupGea(`sim-create-${Date.now()}`)

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        vanilla.clear()
        const v0 = performance.now()
        vanilla.populate(1000)
        const v1 = performance.now()

        store.data = []
        await flush()
        const e0 = performance.now()
        store.data = buildRows(1000)
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('create rows', r)
      const rowCount = root.querySelectorAll('tbody tr').length
      assert.equal(rowCount, 1000, `expected 1000 rows, got ${rowCount}`)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('02 replace all rows (1k)', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      vanilla.populate(1000)
      const { store } = await setupGea(`sim-replace-${Date.now()}`)
      store.data = buildRows(1000)
      await flush()

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        const startId = (run + 1) * 2000 + 1
        const v0 = performance.now()
        vanilla.replace(1000, startId)
        const v1 = performance.now()

        const e0 = performance.now()
        store.data = buildRows(1000, startId + 1000)
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('replace all rows', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('03 partial update (1k, every 10th)', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      vanilla.populate(1000)
      const { store } = await setupGea(`sim-partial-${Date.now()}`)
      store.data = buildRows(1000)
      await flush()

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        const v0 = performance.now()
        vanilla.update()
        const v1 = performance.now()

        const e0 = performance.now()
        for (let i = 0; i < store.data.length; i += 10) {
          store.data[i].label += ' !!!'
        }
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('partial update', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('04 select row', async () => {
    const restoreDom = installDom()
    try {
      const [{ default: Component }, { Store }] = await loadRuntimeModules(`sim-select-${Date.now()}`)
      const store = new Store({ data: [] as Array<{ id: number; label: string }>, selected: 0 })
      const selectRowFixturePath = join(__dirname, 'fixtures/benchmark-select-row.jsx')

      const Cls = await compileJsxComponent(
        `import { Component } from 'gea'
         import store from './benchmark-store.ts'
         export default class T extends Component {
           template() {
             return (
               <table><tbody id="tbody">
                 {store.data.map(item => (
                   <tr key={item.id} class={store.selected === item.id ? 'danger' : ''}>
                     <td>{item.id}</td><td>{item.label}</td>
                   </tr>
                 ))}
               </tbody></table>
             )
           }
         }`,
        selectRowFixturePath,
        'T',
        { Component, store },
      )

      const root = document.createElement('div')
      document.body.appendChild(root)
      const view = new Cls()
      view.render(root)

      store.data = buildRows(1000)
      await flush()

      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      vanilla.populate(1000)
      let vanillaSelected: HTMLElement | null = null

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        const selectId = (run % 1000) + 1

        const v0 = performance.now()
        if (vanillaSelected) vanillaSelected.className = ''
        vanillaSelected = vanilla.rows[selectId - 1]
        vanillaSelected.className = 'danger'
        const v1 = performance.now()

        const e0 = performance.now()
        store.selected = selectId
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('select row', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('05 swap rows', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      vanilla.populate(1000)
      const { store } = await setupGea(`sim-swap-${Date.now()}`)
      store.data = buildRows(1000)
      await flush()

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        const v0 = performance.now()
        vanilla.swap()
        const v1 = performance.now()

        const e0 = performance.now()
        const tmp = store.data[1]
        store.data[1] = store.data[998]
        store.data[998] = tmp
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('swap rows', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('07 remove row', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      const { store } = await setupGea(`sim-remove-${Date.now()}`)

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        vanilla.populate(1000)
        store.data = buildRows(1000)
        await flush()

        const v0 = performance.now()
        vanilla.removeRow(500)
        const v1 = performance.now()

        const e0 = performance.now()
        store.data.splice(500, 1)
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('remove row', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('08 append rows (1k to 1k)', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      const { store } = await setupGea(`sim-append-${Date.now()}`)

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        vanilla.populate(1000)
        store.data = buildRows(1000)
        await flush()

        const startId = 1001 + run * 1000
        const v0 = performance.now()
        vanilla.append(1000, startId)
        const v1 = performance.now()

        const e0 = performance.now()
        const rawOld = store.data.__getTarget || store.data
        store.data = rawOld.concat(buildRows(1000, startId + 1000))
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('append rows', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })

  test('09 clear rows (1k)', async () => {
    const restoreDom = installDom()
    try {
      const vanilla = new VanillaBench(document.createElement('tbody'))
      document.body.appendChild(vanilla.tbody)
      const { store } = await setupGea(`sim-clear-${Date.now()}`)

      const vTimes: number[] = []
      const eTimes: number[] = []

      for (let run = 0; run < WARMUP + RUNS; run++) {
        vanilla.populate(1000)
        store.data = buildRows(1000)
        await flush()

        const v0 = performance.now()
        vanilla.clear()
        const v1 = performance.now()

        const e0 = performance.now()
        store.data = []
        const p1 = performance.now()
        await flush()
        const e1 = performance.now()

        if (run >= WARMUP) {
          console.log(`run ${run}: set: ${(p1 - e0).toFixed(2)}ms, flush: ${(e1 - p1).toFixed(2)}ms`)
        }

        if (run >= WARMUP) {
          vTimes.push(v1 - v0)
          eTimes.push(e1 - e0)
        }
      }

      const r: SimResult = { vanilla: median(vTimes), gea: median(eTimes), slowdown: median(eTimes) / median(vTimes) }
      report('clear rows', r)
    } finally {
      await cleanupDelay()
      restoreDom()
    }
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'

import babelGenerator from '@babel/generator'
import { JSDOM } from 'jsdom'

import { parseSource } from '../parse'
import { transformComponentFile } from '../transform-component'

const generate = 'default' in babelGenerator ? babelGenerator.default : babelGenerator

function transformComponentSource(source: string): string {
  const parsed = parseSource(source)
  assert.ok(parsed)
  assert.ok(parsed.componentClassName)

  const original = parseSource(source)
  assert.ok(original)

  const transformed = transformComponentFile(
    parsed.ast,
    parsed.imports,
    new Map(),
    parsed.componentClassName!,
    '/virtual/test-component.jsx',
    original.ast,
    new Set(),
  )

  assert.equal(transformed, true)
  return generate(parsed.ast).code
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)
  const cancelAnimationFrame = (id: number) => clearTimeout(id)

  dom.window.requestAnimationFrame = requestAnimationFrame
  dom.window.cancelAnimationFrame = cancelAnimationFrame

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
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
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame,
    cancelAnimationFrame,
  })

  return () => {
    Object.assign(globalThis, previous)
    dom.window.close()
  }
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function loadRuntimeModules(seed: string) {
  const { default: ComponentManager } = await import('../../gea/src/lib/base/component-manager.ts')
  ComponentManager.instance = undefined
  return Promise.all([
    import(`../../gea/src/lib/base/component.tsx?${seed}`),
    import(`../../gea/src/lib/store.ts?${seed}`),
  ])
}

// --- Optimization #3: Prop patch methods (inlined into __onPropChange) ---
test('compiler inlines prop text patches into __onPropChange', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class PropChild extends Component {
      template(props) {
        return <div class="value">{props.count}</div>
      }
    }
  `)

  assert.match(output, /__onPropChange/)
  assert.match(output, /textContent = value/)
  assert.doesNotMatch(output, /__geaPatchProp_count\(/)
})

test('compiler inlines this.props text patches into __onPropChange', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class PropChild extends Component {
      template() {
        return <span>{this.props.label}</span>
      }
    }
  `)

  assert.match(output, /__onPropChange/)
  assert.match(output, /textContent = value/)
  assert.doesNotMatch(output, /__geaPatchProp_label\(/)
})

test('compiler inlines class prop patches into __onPropChange', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class ChildBadge extends Component {
      template({ activeClass }) {
        return <div class={activeClass}>Counter</div>
      }
    }
  `)

  assert.match(output, /__onPropChange/)
  assert.match(output, /className/)
  assert.doesNotMatch(output, /__geaPatchProp_activeClass\(/)
})

test('compiler generates __geaPatchProp_* for attribute props (data-*, aria-*)', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class StatusBadge extends Component {
      template({ dataState }) {
        return <div data-state={dataState}>Status</div>
      }
    }
  `)

  assert.match(output, /__onPropChange/)
  assert.match(output, /setAttribute/)
  assert.match(output, /removeAttribute/)
})

// --- Optimization #5: createElement uses template ---
test('ComponentManager createElement produces valid DOM from HTML string', async () => {
  const restoreDom = installDom()

  try {
    const { default: ComponentManager } = await import('../../gea/src/lib/base/component-manager.ts')
    const manager = ComponentManager.getInstance()
    const el = manager.createElement('<div id="test" class="foo">hello</div>')

    assert.ok(el)
    assert.equal(el.tagName, 'DIV')
    assert.equal(el.id, 'test')
    assert.equal(el.className, 'foo')
    assert.equal(el.textContent, 'hello')
  } finally {
    restoreDom()
  }
})

// --- Optimization #6: Store __raw ---
test('store state proxy exposes __raw as alias for __getTarget', async () => {
  const restoreDom = installDom()

  try {
    const [, { Store }] = await loadRuntimeModules(`opt-raw-${Date.now()}`)
    const store = new Store({ items: [{ id: 1, name: 'a' }] })

    assert.strictEqual(store.items.__raw, store.items.__getTarget)
    assert.ok(Array.isArray(store.items.__raw))
    assert.equal(store.items.__raw.length, 1)
    assert.equal(store.items.__raw[0].name, 'a')
  } finally {
    restoreDom()
  }
})

test('store __raw forEach passes raw values without proxy overhead', async () => {
  const restoreDom = installDom()

  try {
    const [, { Store }] = await loadRuntimeModules(`opt-raw-foreach-${Date.now()}`)
    const store = new Store({ items: [{ id: 1 }, { id: 2 }] })

    const collected: unknown[] = []
    store.items.__raw.forEach((item: { id: number }) => {
      collected.push(item)
      assert.ok(!(item as any).__isProxy, 'raw forEach should pass unproxied values')
    })

    assert.equal(collected.length, 2)
    assert.equal(collected[0], store.items.__getTarget[0])
  } finally {
    restoreDom()
  }
})

// --- Optimization #7: Array patch with multiple expressions ---
test('compiler generates patch for array item with multiple text expressions', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class MultiExprList extends Component {
      constructor() {
        super()
        this.items = [{ id: 1, label: 'a' }, { id: 2, label: 'b' }]
      }

      template() {
        return (
          <ul>
            {this.items.map(item => (
              <li key={item.id} data-gea-item>
                {item.label} - {item.id}
              </li>
            ))}
          </ul>
        )
      }
    }
  `)

  assert.match(output, /__ensureArrayConfigs\(\)/)
  assert.match(output, /__applyListChanges/)
  assert.match(output, /propPatchers/)
  assert.match(output, /item\.label.*item\.id/, 'prop patcher should combine label and id in single update')
})

// --- Optimization #8: onAfterRenderAsync scheduling ---
test('onAfterRenderAsync is invoked after render', async () => {
  const restoreDom = installDom()

  try {
    const seed = `opt-raf-${Date.now()}`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    let afterRenderCalled = false
    class RafComponent extends Component {
      template() {
        return '<div>test</div>'
      }
      onAfterRenderAsync() {
        afterRenderCalled = true
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const comp = new RafComponent()
    comp.render(root)

    await flushMicrotasks()

    assert.ok(afterRenderCalled, 'onAfterRenderAsync should be called')

    comp.dispose()
  } finally {
    restoreDom()
  }
})

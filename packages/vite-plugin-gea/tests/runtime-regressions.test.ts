import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

import { JSDOM } from 'jsdom'

import { geaPlugin } from '../index'

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

test('runtime-only bindings update when state changes after render', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-binding`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const RuntimeBindingComponent = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class RuntimeBindingComponent extends Component {
          count = 0

          template() {
            return <div class="count">{this.count}</div>
          }
        }
      `,
      '/virtual/RuntimeBindingComponent.jsx',
      'RuntimeBindingComponent',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new RuntimeBindingComponent()
    component.render(root)

    assert.equal(component.el.textContent?.trim(), '0')

    component.count = 1
    await flushMicrotasks()

    assert.equal(component.el.textContent?.trim(), '1')
    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('simple conditional class bindings toggle on and off', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-simple-class-toggle`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const ToggleClassComponent = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class ToggleClassComponent extends Component {
          active = false

          template() {
            return <div class={this.active ? 'panel active' : 'panel'}>Panel</div>
          }
        }
      `,
      '/virtual/ToggleClassComponent.jsx',
      'ToggleClassComponent',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new ToggleClassComponent()
    component.render(root)

    assert.equal(component.el.className, 'panel')

    component.active = true
    await flushMicrotasks()
    assert.equal(component.el.className, 'panel active')

    component.active = false
    await flushMicrotasks()
    assert.equal(component.el.className, 'panel')

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('mapped conditional attributes add and remove in place', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-mapped-attribute-toggle`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const AttributeList = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class AttributeList extends Component {
          items = [{ id: 1, label: 'one', active: false }]

          template() {
            return (
              <div class="items">
                {this.items.map(item => (
                  <button key={item.id} data-state={item.active ? 'on' : null}>
                    {item.label}
                  </button>
                ))}
              </div>
            )
          }
        }
      `,
      '/virtual/AttributeList.jsx',
      'AttributeList',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new AttributeList()
    component.render(root)
    await flushMicrotasks()

    const button = () => component.el.querySelector('button')

    assert.equal(button()?.hasAttribute('data-state'), false)

    component.items[0].active = true
    await flushMicrotasks()
    assert.equal(button()?.getAttribute('data-state'), 'on')

    component.items[0].active = false
    await flushMicrotasks()
    assert.equal(button()?.hasAttribute('data-state'), false)

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('mapped transition style attributes update and remove without replacing rows', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-mapped-transition-style`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const AnimatedList = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class AnimatedList extends Component {
          items = [{ id: 1, label: 'toast', visible: false }]

          template() {
            return (
              <div class="items">
                {this.items.map(item => (
                  <div
                    key={item.id}
                    class="toast"
                    style={
                      item.visible
                        ? 'opacity: 1; transform: translateY(0); transition: opacity 150ms ease, transform 150ms ease;'
                        : null
                    }
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )
          }
        }
      `,
      '/virtual/AnimatedList.jsx',
      'AnimatedList',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new AnimatedList()
    component.render(root)
    await flushMicrotasks()

    const rowBefore = component.el.querySelector('.toast') as HTMLElement
    assert.equal(rowBefore.getAttribute('style'), null)

    component.items[0].visible = true
    await flushMicrotasks()

    const rowVisible = component.el.querySelector('.toast') as HTMLElement
    assert.equal(rowVisible, rowBefore)
    assert.match(rowVisible.getAttribute('style') || '', /transition:\s*opacity 150ms ease, transform 150ms ease;/)
    assert.match(rowVisible.getAttribute('style') || '', /opacity:\s*1/)
    assert.match(rowVisible.getAttribute('style') || '', /transform:\s*translateY\(0\)/)

    component.items[0].visible = false
    await flushMicrotasks()

    const rowAfter = component.el.querySelector('.toast') as HTMLElement
    assert.equal(rowAfter, rowBefore)
    assert.equal(rowAfter.getAttribute('style'), null)

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('conditional branches swap rendered elements when state flips', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-conditional-branches`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const ConditionalBranchComponent = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class ConditionalBranchComponent extends Component {
          expanded = false

          template() {
            return (
              <section class="card">
                {this.expanded ? (
                  <p class="details">Details</p>
                ) : (
                  <button class="summary">Open</button>
                )}
              </section>
            )
          }
        }
      `,
      '/virtual/ConditionalBranchComponent.jsx',
      'ConditionalBranchComponent',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new ConditionalBranchComponent()
    component.render(root)

    assert.equal(component.el.querySelector('.summary')?.textContent?.trim(), 'Open')
    assert.equal(component.el.querySelector('.details'), null)

    component.expanded = true
    await flushMicrotasks()
    assert.equal(component.el.querySelector('.details')?.textContent?.trim(), 'Details')
    assert.equal(component.el.querySelector('.summary'), null)

    component.expanded = false
    await flushMicrotasks()
    assert.equal(component.el.querySelector('.summary')?.textContent?.trim(), 'Open')
    assert.equal(component.el.querySelector('.details'), null)

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('conditional branches preserve surrounding siblings across repeated flips', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-conditional-sibling-stability`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const SiblingStableConditional = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class SiblingStableConditional extends Component {
          open = false

          template() {
            return (
              <section class="panel">
                <header class="title">Title</header>
                {this.open ? (
                  <div class="details">
                    <span class="details-copy">Details</span>
                  </div>
                ) : (
                  <button class="trigger">Open</button>
                )}
                <footer class="footer">Footer</footer>
              </section>
            )
          }
        }
      `,
      '/virtual/SiblingStableConditional.jsx',
      'SiblingStableConditional',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new SiblingStableConditional()
    component.render(root)

    assert.equal(component.el.children.length, 3)
    assert.equal(component.el.querySelector('.trigger')?.textContent?.trim(), 'Open')
    assert.equal(component.el.querySelector('.details'), null)
    assert.deepEqual(
      Array.from(component.el.children).map((node) => (node as HTMLElement).className),
      ['title', 'trigger', 'footer'],
    )

    component.open = true
    await flushMicrotasks()
    assert.equal(component.el.children.length, 3)
    assert.equal(component.el.querySelectorAll('.title').length, 1)
    assert.equal(component.el.querySelectorAll('.footer').length, 1)
    assert.equal(component.el.querySelector('.trigger'), null)
    assert.equal(component.el.querySelector('.details-copy')?.textContent?.trim(), 'Details')
    assert.deepEqual(
      Array.from(component.el.children).map((node) => (node as HTMLElement).className),
      ['title', 'details', 'footer'],
    )

    component.open = false
    await flushMicrotasks()
    assert.equal(component.el.children.length, 3)
    assert.equal(component.el.querySelectorAll('.title').length, 1)
    assert.equal(component.el.querySelectorAll('.footer').length, 1)
    assert.equal(component.el.querySelector('.trigger')?.textContent?.trim(), 'Open')
    assert.equal(component.el.querySelector('.details'), null)
    assert.deepEqual(
      Array.from(component.el.children).map((node) => (node as HTMLElement).className),
      ['title', 'trigger', 'footer'],
    )

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('conditional branches do not leave stale transitioning nodes behind', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-conditional-stale-node-cleanup`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const TransitionBranchComponent = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TransitionBranchComponent extends Component {
          showToast = false

          template() {
            return (
              <div class="shell">
                {this.showToast ? (
                  <div class="toast" style="opacity: 1; transition: opacity 120ms ease;">Saved</div>
                ) : (
                  <span class="idle">Idle</span>
                )}
              </div>
            )
          }
        }
      `,
      '/virtual/TransitionBranchComponent.jsx',
      'TransitionBranchComponent',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new TransitionBranchComponent()
    component.render(root)

    assert.equal(component.el.querySelectorAll('.toast').length, 0)
    assert.equal(component.el.querySelectorAll('.idle').length, 1)

    component.showToast = true
    await flushMicrotasks()
    assert.equal(component.el.querySelectorAll('.toast').length, 1)
    assert.equal(component.el.querySelectorAll('.idle').length, 0)
    assert.match(component.el.querySelector('.toast')?.getAttribute('style') || '', /transition:\s*opacity 120ms ease;/)

    component.showToast = false
    await flushMicrotasks()
    assert.equal(component.el.querySelectorAll('.toast').length, 0)
    assert.equal(component.el.querySelectorAll('.idle').length, 1)

    component.showToast = true
    await flushMicrotasks()
    assert.equal(component.el.querySelectorAll('.toast').length, 1)
    assert.equal(component.el.querySelectorAll('.idle').length, 0)

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('mapped list mutations add and remove DOM rows in order', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-mapped-list-mutations`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const SimpleList = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class SimpleList extends Component {
          nextId = 2
          items = [{ id: 1, label: 'one' }]

          add(label) {
            this.items.push({ id: this.nextId++, label })
          }

          removeFirst() {
            this.items.splice(0, 1)
          }

          template() {
            return (
              <ul class="items">
                {this.items.map(item => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            )
          }
        }
      `,
      '/virtual/SimpleList.jsx',
      'SimpleList',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const component = new SimpleList()
    component.render(root)

    const rowTexts = () =>
      Array.from(component.el.querySelectorAll('li')).map((node: Element) => node.textContent?.trim())

    assert.deepEqual(rowTexts(), ['one'])

    component.add('two')
    await flushMicrotasks()
    assert.deepEqual(rowTexts(), ['one', 'two'])

    component.removeFirst()
    await flushMicrotasks()
    assert.deepEqual(rowTexts(), ['two'])

    component.add('three')
    await flushMicrotasks()
    assert.deepEqual(rowTexts(), ['two', 'three'])

    component.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('compiled child props stay reactive for imported store state', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-imported-child`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ count: 1 })

    const CounterChild = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class CounterChild extends Component {
          template({ count }) {
            return <div class="counter-value">{count}</div>
          }
        }
      `,
      '/virtual/CounterChild.jsx',
      'CounterChild',
      { Component },
    )

    const ParentView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'
        import CounterChild from './CounterChild.jsx'

        export default class ParentView extends Component {
          template() {
            return (
              <div class="parent-view">
                <CounterChild count={store.count} />
              </div>
            )
          }
        }
      `,
      '/virtual/ParentView.jsx',
      'ParentView',
      { Component, store, CounterChild },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new ParentView()
    view.render(root)
    assert.equal(view.el.textContent?.trim(), '1')

    store.count = 2
    await flushMicrotasks()

    assert.equal(view.el.textContent?.trim(), '2')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('array slot list does not clear when selecting option (imported store)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-array-slot-select`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const OPTIONS = [
      { id: 'a', label: 'Option A', price: 0 },
      { id: 'b', label: 'Option B', price: 10 },
      { id: 'c', label: 'Option C', price: 20 },
    ]

    const optionsStore = new Store({ selected: 'a' }) as {
      selected: string
      setSelected: (id: string) => void
    }
    optionsStore.setSelected = (id: string) => {
      optionsStore.selected = id
    }

    const OptionStepWithInlineItems = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class OptionStepWithInlineItems extends Component {
          template({ options, selectedId, onSelect }) {
            return (
              <div class="option-step">
                {options.map(opt => (
                  <div
                    key={opt.id}
                    class={\`option-item \${selectedId === opt.id ? 'selected' : ''}\`}
                    click={() => onSelect(opt.id)}
                  >
                    <span class="label">{opt.label}</span>
                  </div>
                ))}
              </div>
            )
          }
        }
      `,
      '/virtual/OptionStepWithInlineItems.jsx',
      'OptionStepWithInlineItems',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new OptionStepWithInlineItems({
      options: OPTIONS,
      selectedId: optionsStore.selected,
      onSelect: (id: string) => optionsStore.setSelected(id),
    })
    view.render(root)
    await flushMicrotasks()

    const optionItems = root.querySelectorAll('.option-item')
    assert.equal(optionItems.length, 3, 'initial render: should have 3 options')
    assert.ok(root.querySelector('.option-item.selected'), 'option A should be selected initially')

    const optionB = Array.from(optionItems).find((el) => el.querySelector('.label')?.textContent?.trim() === 'Option B')
    assert.ok(optionB, 'should find Option B')
    optionB?.dispatchEvent(new window.Event('click', { bubbles: true }))

    await flushMicrotasks()

    const optionItemsAfter = root.querySelectorAll('.option-item')
    assert.equal(optionItemsAfter.length, 3, 'after select: list must not clear, should still have 3 options')
    assert.ok(root.querySelector('.option-item.selected'), 'one option should be selected after click')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('compiled child option select updates in place without leaked click attrs or section rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-compiled-child-option-select`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const OPTIONS = [
      { id: 'a', label: 'Option A', price: 0 },
      { id: 'b', label: 'Option B', price: 10 },
      { id: 'c', label: 'Option C', price: 20 },
    ]

    const OptionItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class OptionItem extends Component {
          template({ label, price, selected, onSelect }) {
            return (
              <div class={\`option-item \${selected ? 'selected' : ''}\`} click={onSelect}>
                <span class="label">{label}</span>
                <span class="price">{price === 0 ? 'Included' : \`+$\${price}\`}</span>
              </div>
            )
          }
        }
      `,
      '/virtual/OptionItem.jsx',
      'OptionItem',
      { Component },
    )

    const OptionStep = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import OptionItem from './OptionItem.jsx'

        export default class OptionStep extends Component {
          template({ options, selectedId, onSelect }) {
            return (
              <section class="section-card">
                <div class="option-grid">
                  {options.map(opt => (
                    <OptionItem
                      key={opt.id}
                      label={opt.label}
                      price={opt.price}
                      selected={selectedId === opt.id}
                      onSelect={() => onSelect(opt.id)}
                    />
                  ))}
                </div>
              </section>
            )
          }
        }
      `,
      '/virtual/OptionStep.jsx',
      'OptionStep',
      { Component, OptionItem },
    )

    const optionsStore = new Store({ selected: 'a' }) as {
      selected: string
      setSelected: (id: string) => void
    }
    optionsStore.setSelected = (id: string) => {
      optionsStore.selected = id
    }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new OptionStep({
      options: OPTIONS,
      selectedId: optionsStore.selected,
      onSelect: (id: string) => optionsStore.setSelected(id),
    })
    view.render(root)
    await flushMicrotasks()

    const sectionBefore = root.querySelector('.section-card')
    assert.ok(sectionBefore, 'section should render')
    assert.equal(root.querySelectorAll('.option-item[click]').length, 0, 'no click attrs should leak initially')

    const optionB = Array.from(root.querySelectorAll('.option-item')).find(
      (el) => el.querySelector('.label')?.textContent?.trim() === 'Option B',
    )
    assert.ok(optionB, 'should find Option B')

    optionB?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()

    view.props.selectedId = optionsStore.selected
    await flushMicrotasks()

    const sectionAfter = root.querySelector('.section-card')
    assert.equal(sectionAfter, sectionBefore, 'section root should not be replaced on option select')
    assert.equal(root.querySelectorAll('.option-item[click]').length, 0, 'no click attrs should leak after select')

    const selected = root.querySelector('.option-item.selected .label')?.textContent?.trim()
    assert.equal(selected, 'Option B')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('option select patches in place without full rerender (showBack + arrow function props)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-parent-conditional-option-select`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const OPTIONS = [
      { id: 'economy', label: 'Economy', description: 'Standard legroom', price: 0 },
      { id: 'premium', label: 'Premium Economy', description: 'Extra legroom', price: 120 },
      { id: 'business', label: 'Business Class', description: 'Lie-flat seat', price: 350 },
    ]

    const OptionItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default function OptionItem({ label, description, price, selected, onSelect }) {
          return (
            <div class={\`option-item \${selected ? 'selected' : ''}\`} click={onSelect}>
              <div>
                <div class="label">{label}</div>
                {description && <div class="description">{description}</div>}
              </div>
              <span class={\`price \${price === 0 ? 'free' : ''}\`}>
                {price === 0 ? 'Included' : \`+$\${price}\`}
              </span>
            </div>
          )
        }
      `,
      '/virtual/OptionItem.jsx',
      'OptionItem',
      { Component },
    )

    const OptionStep = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import OptionItem from './OptionItem.jsx'

        export default function OptionStep({
          stepNumber, title, options, selectedId,
          showBack, nextLabel = 'Continue',
          onSelect, onBack, onContinue
        }) {
          return (
            <section class="section-card">
              <div class="option-grid">
                {options.map(opt => (
                  <OptionItem
                    key={opt.id}
                    label={opt.label}
                    description={opt.description}
                    price={opt.price}
                    selected={selectedId === opt.id}
                    onSelect={() => onSelect(opt.id)}
                  />
                ))}
              </div>
              <div class="nav-buttons">
                {showBack && (
                  <button class="btn btn-secondary" click={onBack}>
                    Back
                  </button>
                )}
                <button class="btn btn-primary" click={onContinue}>
                  {nextLabel}
                </button>
              </div>
            </section>
          )
        }
      `,
      '/virtual/OptionStep.jsx',
      'OptionStep',
      { Component, OptionItem },
    )

    const stepStore = new Store({ step: 2 }) as { step: number; setStep: (n: number) => void }
    stepStore.setStep = (n: number) => {
      stepStore.step = n
    }

    const optionsStore = new Store({ seat: 'economy' }) as { seat: string; setSeat: (id: string) => void }
    optionsStore.setSeat = (id: string) => {
      optionsStore.seat = id
    }

    const ParentView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import OptionStep from './OptionStep.jsx'
        import stepStore from './step-store'
        import optionsStore from './options-store'

        export default class ParentView extends Component {
          template() {
            const { step } = stepStore
            const { seat } = optionsStore
            return (
              <div class="parent-view">
                <h1>Select Seat</h1>
                {step === 2 && (
                  <OptionStep
                    stepNumber={2}
                    title="Select Seat"
                    options={OPTIONS}
                    selectedId={seat}
                    showBack={true}
                    nextLabel="Continue"
                    onSelect={id => optionsStore.setSeat(id)}
                    onBack={() => stepStore.setStep(1)}
                    onContinue={() => stepStore.setStep(3)}
                  />
                )}
              </div>
            )
          }
        }
      `,
      '/virtual/ParentView.jsx',
      'ParentView',
      { Component, OptionStep, stepStore, optionsStore, OPTIONS },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new ParentView()
    view.render(root)
    await flushMicrotasks()

    // --- spy on __geaRequestRender at every level ---
    let parentRerenders = 0
    const origParentRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return origParentRender()
    }

    const optionStepChild = view._optionStep2 ?? view._optionStep
    assert.ok(optionStepChild, 'OptionStep child must exist after render')
    let childRerenders = 0
    const origChildRender = optionStepChild.__geaRequestRender.bind(optionStepChild)
    optionStepChild.__geaRequestRender = () => {
      childRerenders++
      return origChildRender()
    }

    const optionItems = optionStepChild._optionsItems
    assert.ok(optionItems?.length > 0, 'OptionItem array should be populated')
    let itemRerenders = 0
    for (const item of optionItems) {
      if (!item.__geaRequestRender) continue
      const origItemRender = item.__geaRequestRender.bind(item)
      item.__geaRequestRender = () => {
        itemRerenders++
        return origItemRender()
      }
    }

    // --- capture DOM references before click ---
    const sectionBefore = root.querySelector('.section-card')
    assert.ok(sectionBefore, 'section should render')
    const optionDivsBefore = Array.from(root.querySelectorAll('.option-item'))
    assert.equal(optionDivsBefore.length, 3, 'should render 3 options')
    assert.ok(root.querySelector('.option-item.selected'), 'economy should be selected initially')
    assert.ok(root.querySelector('.btn.btn-secondary'), 'Back button should render (showBack=true)')

    // --- click Premium Economy ---
    const premiumOption = optionDivsBefore.find(
      (el) => el.querySelector('.label')?.textContent?.trim() === 'Premium Economy',
    )
    assert.ok(premiumOption, 'should find Premium Economy option')
    premiumOption?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()

    // --- assert zero full rerenders at all levels ---
    assert.equal(parentRerenders, 0, `ParentView must NOT call __geaRequestRender (got ${parentRerenders})`)
    assert.equal(childRerenders, 0, `OptionStep must NOT call __geaRequestRender (got ${childRerenders})`)
    assert.equal(itemRerenders, 0, `OptionItem must NOT call __geaRequestRender (got ${itemRerenders})`)

    // --- assert DOM identity preserved (no replace, just patch) ---
    const sectionAfter = root.querySelector('.section-card')
    assert.equal(sectionAfter, sectionBefore, 'section DOM element must be the same object (not replaced)')
    const optionDivsAfter = Array.from(root.querySelectorAll('.option-item'))
    assert.equal(optionDivsAfter.length, 3, 'should still have 3 options')
    for (let i = 0; i < optionDivsBefore.length; i++) {
      assert.equal(optionDivsAfter[i], optionDivsBefore[i], `option-item[${i}] DOM element must be the same object`)
    }

    // --- assert selection actually changed ---
    assert.equal(
      root.querySelector('.option-item.selected .label')?.textContent?.trim(),
      'Premium Economy',
      'Premium Economy should be selected after click',
    )
    const selectedCount = root.querySelectorAll('.option-item.selected').length
    assert.equal(selectedCount, 1, 'exactly one option should be selected')

    // --- click Business Class (second selection change) ---
    parentRerenders = 0
    childRerenders = 0
    itemRerenders = 0
    const businessOption = Array.from(root.querySelectorAll('.option-item')).find(
      (el) => el.querySelector('.label')?.textContent?.trim() === 'Business Class',
    )
    businessOption?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()

    assert.equal(parentRerenders, 0, `ParentView must NOT rerender on second click (got ${parentRerenders})`)
    assert.equal(childRerenders, 0, `OptionStep must NOT rerender on second click (got ${childRerenders})`)
    assert.equal(itemRerenders, 0, `OptionItem must NOT rerender on second click (got ${itemRerenders})`)
    assert.equal(
      root.querySelector('.option-item.selected .label')?.textContent?.trim(),
      'Business Class',
      'Business Class should be selected after second click',
    )

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('compiled child props can use template-local variables', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-child-locals`
    const [{ default: Component }] = await Promise.all([import(`../../gea/src/lib/base/component.tsx?${seed}`)])

    const ChildBadge = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class ChildBadge extends Component {
          template({ activeClass }) {
            return <div class={activeClass}>Counter</div>
          }
        }
      `,
      '/virtual/ChildBadge.jsx',
      'ChildBadge',
      { Component },
    )

    const ParentView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import ChildBadge from './ChildBadge.jsx'

        export default class ParentView extends Component {
          constructor() {
            super()
            this.currentPage = 'counter'
          }

          template() {
            const activeClass = this.currentPage === 'counter' ? 'active' : ''
            return (
              <div class="parent-view">
                <ChildBadge activeClass={activeClass} />
              </div>
            )
          }
        }
      `,
      '/virtual/ParentViewWithLocals.jsx',
      'ParentView',
      { Component, ChildBadge },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new ParentView()
    view.render(root)
    await flushMicrotasks()

    const badge = root.querySelector('div.active')
    assert.ok(badge)
    assert.equal(badge.textContent?.trim(), 'Counter')

    view.dispose()
    await flushMicrotasks()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('View renders passed children', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-view-children`
    const [{ default: Component }] = await Promise.all([import(`../../gea/src/lib/base/component.tsx?${seed}`)])

    class View extends Component {
      index = 0

      render(opt_rootEl = document.body, opt_index = 0) {
        this.index = opt_index
        return super.render(opt_rootEl)
      }

      onAfterRender() {
        super.onAfterRender()
        this.el.style.zIndex = String(this.index)
        this.el.style.transform = `translate3d(0, 0, ${this.index}px)`
      }

      constructor(props: any = {}) {
        super(props)
      }

      template(props: Record<string, any> = {}) {
        const children = props.children == null ? '' : props.children
        return `<view>${children}</view>`
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new View({
      children: '<button class="inner-button">Counter</button>',
    })
    view.render(root)
    await flushMicrotasks()

    const button = root.querySelector('button.inner-button')
    assert.ok(button, root.innerHTML)
    assert.equal(button.textContent?.trim(), 'Counter')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('store push emits one semantic append change', async () => {
  const seed = `runtime-${Date.now()}-append`
  const [, { Store }] = await loadRuntimeModules(seed)
  const store = new Store({ data: [] as Array<{ id: number }> })
  const seen: Array<{ value: Array<{ id: number }>; changes: Array<Record<string, unknown>> }> = []

  store.observe('data', (value, changes) => {
    seen.push({
      value: value as Array<{ id: number }>,
      changes: changes as Array<Record<string, unknown>>,
    })
  })

  store.data.push({ id: 1 }, { id: 2 })
  await flushMicrotasks()

  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.value.length, 2)
  assert.equal(seen[0]?.changes.length, 1)
  assert.equal(seen[0]?.changes[0]?.type, 'append')
  assert.deepEqual(seen[0]?.changes[0]?.pathParts, ['data'])
  assert.equal(seen[0]?.changes[0]?.start, 0)
  assert.equal(seen[0]?.changes[0]?.count, 2)
})

test('store annotates reciprocal array index updates as swaps', async () => {
  const seed = `runtime-${Date.now()}-swap-meta`
  const [, { Store }] = await loadRuntimeModules(seed)
  const store = new Store({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  const seen: Array<Record<string, unknown>[]> = []

  store.observe('data', (_value, changes) => {
    seen.push(changes as Array<Record<string, unknown>>)
  })

  const rows = store.data
  const tmp = rows[0]
  rows[0] = rows[2]
  rows[2] = tmp
  await flushMicrotasks()

  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.length, 2)
  assert.equal(seen[0]?.[0]?.arrayOp, 'swap')
  assert.equal(seen[0]?.[1]?.arrayOp, 'swap')
  assert.deepEqual(seen[0]?.[0]?.arrayPathParts, ['data'])
  assert.deepEqual(seen[0]?.[1]?.arrayPathParts, ['data'])
  assert.equal(seen[0]?.[0]?.otherIndex, 2)
  assert.equal(seen[0]?.[1]?.otherIndex, 0)
  assert.equal(typeof seen[0]?.[0]?.opId, 'string')
  assert.equal(seen[0]?.[0]?.opId, seen[0]?.[1]?.opId)
})

test('store leaves unrelated array index updates unclassified', async () => {
  const seed = `runtime-${Date.now()}-no-swap-meta`
  const [, { Store }] = await loadRuntimeModules(seed)
  const store = new Store({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  const seen: Array<Record<string, unknown>[]> = []

  store.observe('data', (_value, changes) => {
    seen.push(changes as Array<Record<string, unknown>>)
  })

  store.data[0] = { id: 4 }
  store.data[2] = { id: 5 }
  await flushMicrotasks()

  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.length, 2)
  assert.equal(seen[0]?.[0]?.arrayOp, undefined)
  assert.equal(seen[0]?.[1]?.arrayOp, undefined)
})

test('single array item property updates refresh mapped class bindings', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-todo-completed-class`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoList extends Component {
          todos = [{ id: 1, text: 'First todo', completed: false }]

          toggle(todo) {
            todo.completed = !todo.completed
          }

          template() {
            return (
              <div class="todo-list">
                <div class="todo-items">
                  {this.todos.map(todo => (
                    <div class={\`todo-item\${todo.completed ? ' completed' : ''}\`} key={todo.id}>
                      <input type="checkbox" checked={todo.completed} change={() => this.toggle(todo)} />
                      <span>{todo.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/TodoListCompletedClass.jsx',
      'TodoList',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    const rowBefore = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxBefore = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null

    assert.ok(rowBefore)
    assert.ok(checkboxBefore)
    assert.equal(rowBefore?.className, 'todo-item')
    assert.equal(checkboxBefore?.checked, false)

    view.todos[0].completed = true
    await flushMicrotasks()

    const rowAfter = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxAfter = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null

    assert.ok(rowAfter)
    assert.ok(checkboxAfter)
    assert.equal(rowAfter?.className, 'todo-item completed')
    assert.equal(checkboxAfter?.checked, true)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('mapped checkbox events resolve live proxy items and refresh completed class', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-todo-checkbox-class`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoList extends Component {
          todos = [{ id: 1, text: 'First todo', completed: false }]

          toggle(todo) {
            todo.completed = !todo.completed
          }

          template() {
            return (
              <div class="todo-list">
                <div class="todo-items">
                  {this.todos.map(todo => (
                    <div class={\`todo-item\${todo.completed ? ' completed' : ''}\`} key={todo.id}>
                      <input type="checkbox" checked={todo.completed} change={() => this.toggle(todo)} />
                      <span>{todo.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/TodoListCheckboxClass.jsx',
      'TodoList',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    const rowBefore = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxBefore = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null

    assert.ok(rowBefore)
    assert.ok(checkboxBefore)
    assert.equal(rowBefore?.className, 'todo-item')
    assert.equal(checkboxBefore?.checked, false)

    checkboxBefore?.dispatchEvent(new window.Event('change', { bubbles: true }))
    await flushMicrotasks()

    const rowAfter = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxAfter = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null

    assert.ok(rowAfter)
    assert.ok(checkboxAfter)
    assert.equal(rowAfter?.className, 'todo-item completed')
    assert.equal(checkboxAfter?.checked, true)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('imported todo store checkbox events refresh completed class and stats', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-imported-todo-checkbox-class`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      todos: [{ id: 1, text: 'First todo', completed: false }],
      inputValue: '',
      editingId: null,
      editingValue: '',
      nextTodoId: 2,
    })
    ;(store as typeof store & { toggleTodo: (todo: { completed: boolean }) => void }).toggleTodo = (todo) => {
      todo.completed = !todo.completed
    }

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './todo-store.ts'

        export default class TodoList extends Component {
          template() {
            return (
              <div class="todo-list">
                <div class="todo-items">
                  {store.todos.map(todo => (
                    <div class={\`todo-item\${todo.completed ? ' completed' : ''}\`} key={todo.id}>
                      <input type="checkbox" checked={todo.completed} change={() => store.toggleTodo(todo)} />
                      <span>{todo.text}</span>
                    </div>
                  ))}
                </div>
                <div class="todo-stats">
                  Total: {store.todos.length} | Completed: {store.todos.filter(todo => todo.completed).length}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/ImportedTodoListCheckboxClass.jsx',
      'TodoList',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    const rowBefore = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxBefore = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const statsBefore = view.el.querySelector('.todo-stats') as HTMLElement | null
    assert.ok(rowBefore)
    assert.ok(checkboxBefore)
    assert.ok(statsBefore)
    assert.equal(rowBefore?.className, 'todo-item')
    assert.equal(checkboxBefore?.checked, false)
    assert.match(statsBefore?.textContent || '', /Completed:\s*0/)

    checkboxBefore?.dispatchEvent(new window.Event('change', { bubbles: true }))
    await flushMicrotasks()

    const rowAfter = view.el.querySelector('.todo-item') as HTMLElement | null
    const checkboxAfter = view.el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const statsAfter = view.el.querySelector('.todo-stats') as HTMLElement | null
    assert.ok(rowAfter)
    assert.ok(checkboxAfter)
    assert.ok(statsAfter)
    assert.equal(rowAfter?.className, 'todo-item completed')
    assert.equal(checkboxAfter?.checked, true)
    assert.match(statsAfter?.textContent || '', /Completed:\s*1/)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('imported todo store add flow renders first todo and updates stats', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-imported-todo-add`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      todos: [] as Array<{ id: number; text: string; completed: boolean }>,
      inputValue: '',
      editingId: null,
      editingValue: '',
      nextTodoId: 1,
    })
    Object.assign(store as Record<string, unknown>, {
      setInputValue(event: { target: { value: string } }) {
        store.inputValue = event.target.value
      },
      addTodo() {
        const inputValue = String(store.inputValue || '')
        if (inputValue.trim()) {
          store.todos.push({
            id: store.nextTodoId++,
            text: inputValue,
            completed: false,
          })
          store.inputValue = ''
        }
      },
      toggleTodo(todo: { completed: boolean }) {
        todo.completed = !todo.completed
      },
      deleteTodo(todo: { id: number }) {
        const index = store.todos.findIndex((item) => item.id === todo.id)
        if (index !== -1) store.todos.splice(index, 1)
      },
      startEditing(todo: { id: number; text: string }) {
        store.editingId = todo.id
        store.editingValue = todo.text
      },
      setEditingValue(event: { target: { value: string } }) {
        store.editingValue = event.target.value
      },
      updateTodo(todo: { text: string }) {
        if (store.editingValue.trim() && store.editingValue !== todo.text) {
          todo.text = store.editingValue
        }
        store.editingId = null
        store.editingValue = ''
      },
      cancelEditing() {
        store.editingId = null
        store.editingValue = ''
      },
    })

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './todo-store.ts'

        export default class TodoList extends Component {
          addTodoOnEnter(event) {
            if (event.key === 'Enter') {
              store.addTodo()
            }
          }

          template() {
            const _ = store.editingId
            return (
              <div class="todo-list">
                <div class="todo-input">
                  <input
                    type="text"
                    value={store.inputValue}
                    input={store.setInputValue}
                    keydown={this.addTodoOnEnter}
                    placeholder="Add a todo..."
                  />
                  <button click={store.addTodo}>Add</button>
                </div>
                <div class="todo-items">
                  {store.todos.map(todo => (
                    <div class={\`todo-item\${todo.completed ? ' completed' : ''}\`} key={todo.id}>
                      <input type="checkbox" checked={todo.completed} change={() => store.toggleTodo(todo)} />
                      {store.editingId === todo.id ? (
                        <>
                          <input
                            type="text"
                            value={todo.text}
                            input={store.setEditingValue}
                            class="todo-edit-input"
                          />
                          <button click={() => store.updateTodo(todo)}>Save</button>
                          <button click={() => store.cancelEditing()}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <span dblclick={() => store.startEditing(todo)}>{todo.text}</span>
                          <button click={() => store.startEditing(todo)}>Edit</button>
                          <button click={() => store.deleteTodo(todo)}>Delete</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div class="todo-stats">
                  Total: {store.todos.length} | Completed: {store.todos.filter(todo => todo.completed).length}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/ImportedTodoListAddFlow.jsx',
      'TodoList',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    store.inputValue = 'hello'
    store.addTodo()
    await flushMicrotasks()

    assert.equal(view.el.querySelectorAll('.todo-item').length, 1)
    assert.match(view.el.querySelector('.todo-items')?.textContent || '', /hello/)
    assert.match(view.el.querySelector('.todo-stats')?.textContent || '', /Total:\s*1/)
    assert.equal((view.el.querySelector('.todo-input input[type="text"]') as HTMLInputElement | null)?.value, '')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('getter-derived imported child list renders items after add', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-getter-derived-child-list`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      todos: [] as Array<{ id: number; text: string; done: boolean }>,
      draft: '',
      filter: 'all' as 'all' | 'active' | 'completed',
      nextId: 1,
    }) as InstanceType<typeof Store> & {
      addTodo: (text: string) => void
      filteredTodos: Array<{ id: number; text: string; done: boolean }>
    }

    Object.defineProperty(store, 'filteredTodos', {
      get() {
        const { todos, filter } = store
        if (filter === 'active') return todos.filter((todo) => !todo.done)
        if (filter === 'completed') return todos.filter((todo) => todo.done)
        return todos
      },
    })

    store.addTodo = (text: string) => {
      store.todos = [...store.todos, { id: store.nextId++, text, done: false }]
    }

    const TodoRow = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoRow extends Component {
          template({ todo }) {
            return <li class="todo-row">{todo.text}</li>
          }
        }
      `,
      '/virtual/TodoRow.jsx',
      'TodoRow',
      { Component },
    )

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './todo-store.ts'
        import TodoRow from './TodoRow.jsx'

        export default class TodoList extends Component {
          template() {
            const { filteredTodos } = store
            return (
              <ul class="todo-list">
                {filteredTodos.map(todo => (
                  <TodoRow key={todo.id} todo={todo} />
                ))}
              </ul>
            )
          }
        }
      `,
      '/virtual/GetterDerivedTodoList.jsx',
      'TodoList',
      { Component, store, TodoRow },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    let parentRerenders = 0
    const originalRerender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return originalRerender()
    }

    const listBefore = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.equal(view.el.querySelectorAll('.todo-row').length, 0)

    store.addTodo('first')
    await flushMicrotasks()

    const listAfterFirst = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'first add should not call parent __geaRequestRender')
    assert.equal(listAfterFirst, listBefore, 'todo list container should be preserved on first add')
    assert.equal(view.el.querySelectorAll('.todo-row').length, 1)
    assert.match(view.el.textContent || '', /first/)

    store.addTodo('second')
    await flushMicrotasks()

    const listAfterSecond = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'subsequent adds should not call parent __geaRequestRender')
    assert.equal(listAfterSecond, listBefore, 'todo list container should be preserved on subsequent adds')
    assert.equal(view.el.querySelectorAll('.todo-row').length, 2)
    assert.match(view.el.textContent || '', /second/)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('conditional imported empty-state list updates without parent rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-conditional-imported-empty-list`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      logs: [] as Array<{ id: number; label: string; gesture: string }>,
      nextId: 1,
    }) as {
      logs: Array<{ id: number; label: string; gesture: string }>
      nextId: number
      addLog: (label: string) => void
    }

    store.addLog = (label: string) => {
      const entry = { id: store.nextId++, label, gesture: label }
      store.logs = [entry, ...store.logs]
    }

    const GestureLikeView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './gesture-store.ts'

        export default class GestureLikeView extends Component {
          template() {
            return (
              <div class="gesture-view">
                <button class="tap-target" click={() => store.addLog('tap')}>Touch here</button>
                <div class="log-wrap">
                  {store.logs.length === 0 ? (
                    <div class="empty-state">No gestures detected yet</div>
                  ) : (
                    store.logs.map(entry => (
                      <div key={entry.id} class={\`gesture-log-entry gesture-\${entry.gesture}\`}>
                        {entry.label}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/GestureLikeView.jsx',
      'GestureLikeView',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new GestureLikeView()
    view.render(root)
    await flushMicrotasks()

    let parentRerenders = 0
    const originalRerender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return originalRerender()
    }

    const wrapBefore = view.el.querySelector('.log-wrap') as HTMLElement | null
    const buttonBefore = view.el.querySelector('.tap-target') as HTMLElement | null
    assert.ok(wrapBefore)
    assert.ok(buttonBefore)
    assert.equal(view.el.querySelectorAll('.log-entry').length, 0)
    assert.match(view.el.querySelector('.empty-state')?.textContent || '', /No gestures/)

    buttonBefore?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()

    const wrapAfterFirst = view.el.querySelector('.log-wrap') as HTMLElement | null
    const buttonAfterFirst = view.el.querySelector('.tap-target') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'first log insert should not call parent __geaRequestRender')
    assert.equal(wrapAfterFirst, wrapBefore, 'log wrapper should be preserved on first insert')
    assert.equal(buttonAfterFirst, buttonBefore, 'tap target should be preserved on first insert')
    assert.equal(view.el.querySelector('.empty-state'), null)
    assert.equal(view.el.querySelectorAll('.gesture-log-entry').length, 1)
    assert.equal(
      (view.el.querySelector('.gesture-log-entry') as HTMLElement | null)?.className,
      'gesture-log-entry gesture-tap',
    )

    buttonAfterFirst?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()

    const wrapAfterSecond = view.el.querySelector('.log-wrap') as HTMLElement | null
    const buttonAfterSecond = view.el.querySelector('.tap-target') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'subsequent log inserts should not call parent __geaRequestRender')
    assert.equal(wrapAfterSecond, wrapBefore, 'log wrapper should be preserved on subsequent inserts')
    assert.equal(buttonAfterSecond, buttonBefore, 'tap target should be preserved on subsequent inserts')
    const rows = Array.from(view.el.querySelectorAll('.gesture-log-entry')) as HTMLElement[]
    assert.equal(rows.length, 2)
    assert.deepEqual(
      rows.map((row) => row.className),
      ['gesture-log-entry gesture-tap', 'gesture-log-entry gesture-tap'],
    )

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('mapped edit input submits todo changes on Enter', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-todo-enter`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      todos: [{ id: 1, text: 'original', completed: false }],
      editingId: 1,
      editingValue: 'original',
    })
    Object.assign(store, {
      setEditingValue(event: { target: { value: string } }) {
        store.editingValue = event.target.value
      },
      updateTodo(todo: { text: string }) {
        todo.text = String(store.editingValue)
        store.editingId = null
      },
    })

    const TodoList = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './todo-store.ts'

        export default class TodoList extends Component {
          template() {
            return (
              <div class="todo-items">
                {store.todos.map(todo => (
                  <div class="todo-item" key={todo.id}>
                    {store.editingId === todo.id ? (
                      <input
                        type="text"
                        value={todo.text}
                        input={store.setEditingValue}
                        keydown={e => {
                          if (e.key === 'Enter') {
                            store.updateTodo(todo)
                          }
                        }}
                        class="todo-edit-input"
                      />
                    ) : (
                      <span>{todo.text}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        }
      `,
      '/virtual/TodoEnterEdit.jsx',
      'TodoList',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoList()
    view.render(root)
    await flushMicrotasks()

    const input = view.el.querySelector('.todo-edit-input') as HTMLInputElement | null
    assert.ok(input)

    input.value = 'updated via enter'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushMicrotasks()

    assert.equal(view.el.querySelector('.todo-item span')?.textContent, 'updated via enter')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('inline event handlers can use template-local validation state', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-local-click-state`
    const [{ default: Component }] = await loadRuntimeModules(seed)
    let payCount = 0

    const PaymentForm = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class PaymentForm extends Component {
          template(props) {
            const { value, onPay } = props
            const isValid = value.trim().length > 0
            return (
              <div class="payment-form">
                <button class="pay-btn" click={() => isValid && onPay()}>Pay</button>
              </div>
            )
          }
        }
      `,
      '/virtual/LocalStatePaymentForm.jsx',
      'PaymentForm',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new PaymentForm({
      value: 'ok',
      onPay: () => {
        payCount++
      },
    })
    view.render(root)
    await flushMicrotasks()

    view.el.querySelector('.pay-btn')?.dispatchEvent(new window.Event('click', { bubbles: true }))
    await flushMicrotasks()
    assert.equal(payCount, 1)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('prop-driven conditional jsx children rerender to show validation messages while preserving focus', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-prop-jsx-rerender`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const PaymentForm = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class PaymentForm extends Component {
          template(props) {
            const {
              passengerName,
              cardNumber,
              expiry,
              onPassengerNameChange,
              onCardNumberChange,
              onExpiryChange
            } = props

            const passengerNameValid = passengerName.trim().length >= 2
            const cardNumberValid = cardNumber.replace(/\\D/g, '').length === 16
            const expiryValid = /^\\d{2}\\/\\d{2}$/.test(expiry)
            const showErrors = passengerName !== '' || cardNumber !== '' || expiry !== ''

            return (
              <div class="payment-form">
                <div class="form-group">
                  <input
                    value={passengerName}
                    input={onPassengerNameChange}
                    type="text"
                    placeholder="Passenger name"
                    class={showErrors && !passengerNameValid ? 'error' : ''}
                  />
                  {showErrors && !passengerNameValid && <span class="error-msg">At least 2 characters</span>}
                </div>
                <div class="form-group">
                  <input
                    value={cardNumber}
                    input={onCardNumberChange}
                    type="text"
                    placeholder="Card number"
                    class={showErrors && !cardNumberValid ? 'error' : ''}
                  />
                </div>
                <div class="form-group">
                  <input
                    value={expiry}
                    input={onExpiryChange}
                    type="text"
                    placeholder="MM/YY"
                    class={showErrors && !expiryValid ? 'error' : ''}
                  />
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/PaymentFormConditionalErrors.jsx',
      'PaymentForm',
      { Component },
    )

    const paymentStore = new Store({
      passengerName: '',
      cardNumber: '',
      expiry: '',
    }) as {
      passengerName: string
      cardNumber: string
      expiry: string
      setPassengerName: (e: Event) => void
      setCardNumber: (e: Event) => void
      setExpiry: (e: Event) => void
    }
    paymentStore.setPassengerName = (e: Event) => {
      const target = e.target as HTMLInputElement
      paymentStore.passengerName = target.value
    }
    paymentStore.setCardNumber = (e: Event) => {
      const target = e.target as HTMLInputElement
      paymentStore.cardNumber = target.value
    }
    paymentStore.setExpiry = (e: Event) => {
      const target = e.target as HTMLInputElement
      paymentStore.expiry = target.value
    }

    const ParentView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import paymentStore from './payment-store.ts'
        import PaymentForm from './PaymentFormConditionalErrors.jsx'

        export default class ParentView extends Component {
          template() {
            return (
              <div class="parent-view">
                <PaymentForm
                  passengerName={paymentStore.passengerName}
                  cardNumber={paymentStore.cardNumber}
                  expiry={paymentStore.expiry}
                  onPassengerNameChange={paymentStore.setPassengerName}
                  onCardNumberChange={paymentStore.setCardNumber}
                  onExpiryChange={paymentStore.setExpiry}
                />
              </div>
            )
          }
        }
      `,
      '/virtual/ParentPaymentFormConditionalErrors.jsx',
      'ParentView',
      { Component, PaymentForm, paymentStore },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new ParentView()
    view.render(root)
    await flushMicrotasks()

    const input = root.querySelector('input[placeholder="Passenger name"]') as HTMLInputElement | null
    assert.ok(input)

    input.focus()
    input.value = 'A'
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    await flushMicrotasks()

    assert.equal(document.activeElement, root.querySelector('input[placeholder="Passenger name"]'))
    assert.equal(root.querySelector('.error-msg')?.textContent?.trim(), 'At least 2 characters')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('rerender preserves focused input and selection', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-preserve-focus`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    class FocusComponent extends Component {
      constructor(props: any = {}) {
        super(props)
      }

      template(props: { value: string }) {
        return `<div id="${this.id}" class="focus-wrap"><input id="${this.id}-field" value="${props.value}" /></div>`
      }

      __onPropChange() {
        if (this.rendered_) this.__geaRequestRender()
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new FocusComponent({ value: 'abc' })
    view.render(root)
    await flushMicrotasks()

    const input = view.el.querySelector('input') as HTMLInputElement | null
    assert.ok(input)
    input!.focus()
    input!.setSelectionRange(1, 2)

    view.props.value = 'abcd'
    await flushMicrotasks()

    const rerendered = view.el.querySelector('input') as HTMLInputElement | null
    assert.ok(rerendered)
    assert.equal((document.activeElement as HTMLElement | null)?.id, `${view.id}-field`)
    assert.equal(rerendered!.selectionStart, 1)
    assert.equal(rerendered!.selectionEnd, 2)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('rerender adjusts caret when formatted value grows before cursor', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-preserve-formatted-caret`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    class FocusComponent extends Component {
      constructor(props: any = {}) {
        super(props)
      }

      template(props: { value: string }) {
        return `<div id="${this.id}" class="focus-wrap"><input id="${this.id}-field" value="${props.value}" /></div>`
      }

      __onPropChange() {
        if (this.rendered_) this.__geaRequestRender()
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new FocusComponent({ value: '42424' })
    view.render(root)
    await flushMicrotasks()

    const input = view.el.querySelector('input') as HTMLInputElement | null
    assert.ok(input)
    input!.focus()
    input!.setSelectionRange(5, 5)

    view.props.value = '4242 4'
    await flushMicrotasks()

    const rerendered = view.el.querySelector('input') as HTMLInputElement | null
    assert.ok(rerendered)
    assert.equal(rerendered!.selectionStart, 6)
    assert.equal(rerendered!.selectionEnd, 6)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('imported mapped table rows rerender selected class in place', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-mapped-table-selection`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ data: [], selected: 0 })

    const actions = {
      run() {
        store.data = [
          { id: 1, label: 'one' },
          { id: 2, label: 'two' },
          { id: 3, label: 'three' },
          { id: 4, label: 'four' },
          { id: 5, label: 'five' },
          { id: 6, label: 'six' },
        ]
        store.selected = 0
      },
      select(id: number) {
        store.selected = id
      },
    }

    const BenchmarkTable = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class BenchmarkTable extends Component {
          template() {
            return (
              <table>
                <tbody id="tbody">
                  {store.data.map(item => (
                    <tr key={item.id} class={store.selected === item.id ? 'danger' : ''}>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        }
      `,
      '/virtual/BenchmarkTable.jsx',
      'BenchmarkTable',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BenchmarkTable()
    view.render(root)

    actions.run()
    await flushMicrotasks()

    const rowBefore = view.el.querySelector('tbody > tr:nth-of-type(5)')

    assert.equal((rowBefore as any)?.__geaItem?.id, 5)
    assert.equal(view.el.querySelectorAll('tbody > tr.danger').length, 0)

    actions.select(5)
    await flushMicrotasks()

    const rowAfter = view.el.querySelector('tbody > tr:nth-of-type(5)')

    assert.equal((rowAfter as any)?.__geaItem?.id, 5)
    assert.equal(rowAfter?.className, 'danger')
    assert.equal(rowAfter, rowBefore)
    assert.equal(view.el.querySelectorAll('tbody > tr.danger').length, 1)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('keyed mapped tables replace rows by identity on full array updates', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-keyed-reconcile`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ data: [] as Array<{ id: number; label: string }> })

    const BenchmarkTable = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class BenchmarkTable extends Component {
          template() {
            return (
              <table>
                <tbody id="tbody">
                  {store.data.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        }
      `,
      '/virtual/BenchmarkTable.jsx',
      'BenchmarkTable',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BenchmarkTable()
    view.render(root)

    store.data = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ]
    await flushMicrotasks()

    const firstRowBefore = view.el.querySelector('tbody > tr:first-of-type')
    assert.equal((firstRowBefore as any)?.__geaItem?.id, 1)

    store.data = [
      { id: 3, label: 'three' },
      { id: 4, label: 'four' },
    ]
    await flushMicrotasks()

    const firstRowAfter = view.el.querySelector('tbody > tr:first-of-type')
    assert.equal((firstRowAfter as any)?.__geaItem?.id, 3)
    assert.notEqual(firstRowAfter, firstRowBefore)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('keyed mapped tables move existing rows on swaps', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-keyed-swap`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ data: [] as Array<{ id: number; label: string }> })

    const BenchmarkTable = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class BenchmarkTable extends Component {
          template() {
            return (
              <table>
                <tbody id="tbody">
                  {store.data.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        }
      `,
      '/virtual/BenchmarkTable.jsx',
      'BenchmarkTable',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BenchmarkTable()
    view.render(root)

    store.data = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
      { id: 3, label: 'three' },
    ]
    await flushMicrotasks()

    const firstRowBefore = view.el.querySelector('tbody > tr:nth-of-type(1)')
    const thirdRowBefore = view.el.querySelector('tbody > tr:nth-of-type(3)')
    assert.equal((firstRowBefore as any)?.__geaItem?.id, 1)
    assert.equal((thirdRowBefore as any)?.__geaItem?.id, 3)

    const rows = store.data
    const tmp = rows[0]
    rows[0] = rows[2]
    rows[2] = tmp
    await flushMicrotasks()

    const tbodyAfter = view.el.querySelector('tbody')!
    const firstRowAfter = tbodyAfter.children[0] as Element
    const thirdRowAfter = tbodyAfter.children[2] as Element
    assert.equal((firstRowAfter as any)?.__geaItem?.id, 3)
    assert.equal((thirdRowAfter as any)?.__geaItem?.id, 1)
    assert.equal(firstRowAfter, thirdRowBefore)
    assert.equal(thirdRowAfter, firstRowBefore)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('keyed mapped tables clear all rows on full array resets', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-keyed-clear`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ data: [] as Array<{ id: number; label: string }> })

    const BenchmarkTable = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class BenchmarkTable extends Component {
          template() {
            return (
              <table>
                <tbody id="tbody">
                  {store.data.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        }
      `,
      '/virtual/BenchmarkTable.jsx',
      'BenchmarkTable',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BenchmarkTable()
    view.render(root)

    store.data = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
      { id: 3, label: 'three' },
    ]
    await flushMicrotasks()

    assert.equal(view.el.querySelectorAll('tbody > tr').length, 3)

    store.data = []
    await flushMicrotasks()

    assert.equal(view.el.querySelectorAll('tbody > tr').length, 0)
    assert.equal(view.el.querySelector('tbody')?.textContent, '')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('unkeyed mapped tables do not emit key attributes', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-unkeyed-attrs`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ data: [] as Array<{ id: number; label: string }> })

    const BenchmarkTable = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class BenchmarkTable extends Component {
          template() {
            return (
              <table>
                <tbody id="tbody">
                  {store.data.map(item => (
                    <tr>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        }
      `,
      '/virtual/UnkeyedTable.jsx',
      'BenchmarkTable',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BenchmarkTable()
    view.render(root)

    store.data = [{ id: 1, label: 'one' }]
    await flushMicrotasks()

    const row = view.el.querySelector('tbody > tr')
    assert.equal(row?.hasAttribute('key'), false)
    assert.equal(row?.hasAttribute('data-gea-item-id'), true)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

for (const keyed of [true, false]) {
  test(`local state mapped benchmark table renders rows after array assignment (${keyed ? 'keyed' : 'non-keyed'})`, async () => {
    const restoreDom = installDom()

    try {
      const seed = `runtime-${Date.now()}-local-table-${keyed ? 'keyed' : 'non-keyed'}`
      const [{ default: Component }] = await loadRuntimeModules(seed)

      const BenchmarkTable = await compileJsxComponent(
        `
          import { Component } from 'gea'

          export default class BenchmarkTable extends Component {
            data = []
            selected = 0

            run() {
              this.data = Array.from({ length: 1000 }, (_, index) => ({
                id: index + 1,
                label: \`row-\${index + 1}\`
              }))
            }

            template() {
              return (
                <table>
                  <tbody id="tbody">
                    {this.data.map(item => (
                      <tr${keyed ? ' key={item.id}' : ''} class={this.selected === item.id ? 'danger' : ''}>
                        <td class="col-md-1">{item.id}</td>
                        <td class="col-md-4">
                          <a>{item.label}</a>
                        </td>
                        <td class="col-md-1">
                          <a>
                            <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
                          </a>
                        </td>
                        <td class="col-md-6"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          }
        `,
        `/virtual/LocalBenchmarkTable-${keyed ? 'keyed' : 'non-keyed'}.jsx`,
        'BenchmarkTable',
        { Component },
      )

      const root = document.createElement('div')
      document.body.appendChild(root)

      const view = new BenchmarkTable()
      view.render(root)
      view.run()
      await flushMicrotasks()

      assert.equal(view.el.querySelectorAll('tbody > tr').length, 1000)
      assert.equal(view.el.querySelector('tbody > tr:nth-of-type(1) > td:nth-of-type(1)')?.textContent?.trim(), '1')
      assert.equal(
        view.el.querySelector('tbody > tr:nth-of-type(1000) > td:nth-of-type(2) > a')?.textContent?.trim(),
        'row-1000',
      )

      view.dispose()
      await flushMicrotasks()
    } finally {
      restoreDom()
    }
  })
}

for (const keyed of [true, false]) {
  test(`local state mapped rows update selected class in place (${keyed ? 'keyed' : 'non-keyed'})`, async () => {
    const restoreDom = installDom()

    try {
      const seed = `runtime-${Date.now()}-local-select-${keyed ? 'keyed' : 'non-keyed'}`
      const [{ default: Component }] = await loadRuntimeModules(seed)

      const BenchmarkTable = await compileJsxComponent(
        `
          import { Component } from 'gea'

          export default class BenchmarkTable extends Component {
            data = [
              { id: 1, label: 'one' },
              { id: 2, label: 'two' },
              { id: 3, label: 'three' },
              { id: 4, label: 'four' },
              { id: 5, label: 'five' }
            ]
            selected = 0

            select(id) {
              this.selected = id
            }

            template() {
              return (
                <table>
                  <tbody id="tbody">
                    {this.data.map(item => (
                      <tr${keyed ? ' key={item.id}' : ''} class={this.selected === item.id ? 'danger' : ''}>
                        <td>{item.id}</td>
                        <td>{item.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          }
        `,
        `/virtual/LocalSelectTable-${keyed ? 'keyed' : 'non-keyed'}.jsx`,
        'BenchmarkTable',
        { Component },
      )

      const root = document.createElement('div')
      document.body.appendChild(root)

      const view = new BenchmarkTable()
      view.render(root)

      const rowBefore = view.el.querySelector('tbody > tr:nth-of-type(5)')
      assert.equal(rowBefore?.className, '')

      view.select(5)
      await flushMicrotasks()

      const rowAfter = view.el.querySelector('tbody > tr:nth-of-type(5)')
      assert.equal(rowAfter?.className, 'danger')
      assert.equal(rowAfter, rowBefore)

      view.dispose()
      await flushMicrotasks()
    } finally {
      restoreDom()
    }
  })
}

for (const keyed of [true, false]) {
  test(`local state mapped rows keep event item refs after full replacement (${keyed ? 'keyed' : 'non-keyed'})`, async () => {
    const restoreDom = installDom()

    try {
      const seed = `runtime-${Date.now()}-local-${keyed ? 'keyed' : 'non-keyed'}-events`
      const [{ default: Component }] = await loadRuntimeModules(seed)

      const BenchmarkTable = await compileJsxComponent(
        `
          import { Component } from 'gea'

          export default class BenchmarkTable extends Component {
            data = []
            selected = 0

            run() {
              this.data = Array.from({ length: 10 }, (_, index) => ({
                id: index + 1,
                label: \`row-\${index + 1}\`
              }))
            }

            select(id) {
              this.selected = id
            }

            remove(id) {
              const index = this.data.findIndex(item => item.id === id)
              if (index >= 0) this.data.splice(index, 1)
            }

            template() {
              return (
                <table>
                  <tbody id="tbody">
                    {this.data.map(item => (
                      <tr${keyed ? ' key={item.id}' : ''} class={this.selected === item.id ? 'danger' : ''}>
                        <td>{item.id}</td>
                        <td>
                          <a class="select-link" click={() => this.select(item.id)}>{item.label}</a>
                        </td>
                        <td>
                          <a class="remove-link" click={() => this.remove(item.id)}>
                            <span>x</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          }
        `,
        `/virtual/Local${keyed ? 'Keyed' : 'NonKeyed'}Events.jsx`,
        'BenchmarkTable',
        { Component },
      )

      const root = document.createElement('div')
      document.body.appendChild(root)

      const view = new BenchmarkTable()
      view.render(root)
      view.run()
      await flushMicrotasks()

      const selectLink = view.el.querySelector('tbody > tr:nth-of-type(5) .select-link') as HTMLElement
      const selectedRowBefore = view.el.querySelector('tbody > tr:nth-of-type(5)')
      assert.equal(selectedRowBefore?.getAttribute('data-gea-item-id'), '5')
      selectLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await flushMicrotasks()

      assert.equal(view.el.querySelector('tbody > tr:nth-of-type(5)')?.className, 'danger')
      assert.equal(view.el.querySelector('tbody > tr:nth-of-type(5)')?.getAttribute('data-gea-item-id'), '5')

      const removeLink = view.el.querySelector('tbody > tr:nth-of-type(9) .remove-link') as HTMLElement
      removeLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await flushMicrotasks()

      assert.equal(view.el.querySelector('tbody > tr:nth-of-type(9) > td:nth-of-type(1)')?.textContent?.trim(), '10')
      assert.equal(view.el.querySelector('tbody > tr:nth-of-type(9)')?.getAttribute('data-gea-item-id'), '10')

      view.dispose()
      await flushMicrotasks()
    } finally {
      restoreDom()
    }
  })
}

test('input in form with conditional error spans does not rerender when condition is stable', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-stable-conditional-input`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const PaymentForm = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default function PaymentForm({
          passengerName, cardNumber, expiry,
          onPassengerNameChange, onCardNumberChange, onExpiryChange
        }) {
          const passengerNameValid = passengerName.trim().length >= 2
          const cardNumberValid = cardNumber.replace(/\\D/g, '').length === 16
          const expiryValid = /^\\d{2}\\/\\d{2}$/.test(expiry)
          const showErrors = passengerName !== '' || cardNumber !== '' || expiry !== ''

          return (
            <div class="payment-form">
              <div class="form-group">
                <input
                  value={passengerName}
                  input={onPassengerNameChange}
                  type="text"
                  placeholder="Passenger name"
                  class={showErrors && !passengerNameValid ? 'error' : ''}
                />
                {showErrors && !passengerNameValid && <span class="error-msg name-error">At least 2 characters</span>}
              </div>
              <div class="form-group">
                <input
                  value={cardNumber}
                  input={onCardNumberChange}
                  type="text"
                  placeholder="Card number"
                  class={showErrors && !cardNumberValid ? 'error' : ''}
                />
                {showErrors && !cardNumberValid && <span class="error-msg card-error">16 digits required</span>}
              </div>
              <div class="form-group">
                <input
                  value={expiry}
                  input={onExpiryChange}
                  type="text"
                  placeholder="MM/YY"
                  class={showErrors && !expiryValid ? 'error' : ''}
                />
                {showErrors && !expiryValid && <span class="error-msg expiry-error">Format: MM/YY</span>}
              </div>
            </div>
          )
        }
      `,
      '/virtual/StableCondPaymentForm.jsx',
      'PaymentForm',
      { Component },
    )

    const paymentStore = new Store({
      passengerName: '',
      cardNumber: '',
      expiry: '',
    }) as {
      passengerName: string
      cardNumber: string
      expiry: string
    }

    const ParentView = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import paymentStore from './payment-store.ts'
        import PaymentForm from './PaymentForm.jsx'

        export default class ParentView extends Component {
          template() {
            return (
              <div class="parent-view">
                <PaymentForm
                  passengerName={paymentStore.passengerName}
                  cardNumber={paymentStore.cardNumber}
                  expiry={paymentStore.expiry}
                  onPassengerNameChange={e => { paymentStore.passengerName = e.target.value }}
                  onCardNumberChange={e => { paymentStore.cardNumber = e.target.value }}
                  onExpiryChange={e => { paymentStore.expiry = e.target.value }}
                />
              </div>
            )
          }
        }
      `,
      '/virtual/StableCondParentView.jsx',
      'ParentView',
      { Component, PaymentForm, paymentStore },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new ParentView()
    view.render(root)
    await flushMicrotasks()

    const paymentFormChild = (view as any)._paymentForm
    assert.ok(paymentFormChild, 'PaymentForm child must exist')

    // Type "A" — showErrors flips false→true, passengerNameValid is false
    // All three error conditions flip: [false,false,false] → [true,true,true]
    // A rerender is expected here (first condition change)
    paymentStore.passengerName = 'A'
    await flushMicrotasks()

    assert.ok(root.querySelector('.name-error'), 'name error should appear')
    assert.ok(root.querySelector('.card-error'), 'card error should appear')
    assert.ok(root.querySelector('.expiry-error'), 'expiry error should appear')

    // Now install spies AFTER the initial condition flip
    let formRerenders = 0
    const origRender = paymentFormChild.__geaRequestRender.bind(paymentFormChild)
    paymentFormChild.__geaRequestRender = () => {
      formRerenders++
      return origRender()
    }

    let parentRerenders = 0
    const origParentRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return origParentRender()
    }

    const formElBefore = paymentFormChild.el

    // Type "A" → "B" (single char, still invalid, conditions remain [true,true,true])
    paymentStore.passengerName = 'B'
    await flushMicrotasks()

    assert.equal(formRerenders, 0, `PaymentForm must NOT rerender when conditions are stable (got ${formRerenders})`)
    assert.equal(parentRerenders, 0, `ParentView must NOT rerender (got ${parentRerenders})`)
    assert.equal(paymentFormChild.el, formElBefore, 'PaymentForm DOM element must be the same object')
    assert.ok(root.querySelector('.name-error'), 'name error should persist')
    assert.equal((root.querySelector('input[placeholder="Passenger name"]') as HTMLInputElement)?.value, 'B')

    // Type "B" → "C" (another single char, still invalid, same stable conditions)
    formRerenders = 0
    paymentStore.passengerName = 'C'
    await flushMicrotasks()

    assert.equal(formRerenders, 0, `PaymentForm must NOT rerender on third stable keystroke (got ${formRerenders})`)
    assert.equal(paymentFormChild.el, formElBefore, 'PaymentForm DOM element must remain the same')

    // Now type a valid name "CD" — passengerNameValid flips to true
    // Condition 0 flips: true→false. DOM patching removes the error span without a full rerender.
    formRerenders = 0
    paymentStore.passengerName = 'CD'
    await flushMicrotasks()

    assert.equal(
      formRerenders,
      0,
      `PaymentForm should NOT rerender — conditional DOM patching handles the flip (got ${formRerenders})`,
    )
    assert.equal(root.querySelector('.name-error'), null, 'name error should disappear when name becomes valid')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('getter-derived child component list preserves container on add (todo-app pattern)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-getter-child-component-list`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      todos: [] as Array<{ id: number; text: string; done: boolean }>,
      draft: '',
      filter: 'all' as 'all' | 'active' | 'completed',
      nextId: 1,
    }) as InstanceType<typeof Store> & {
      add: (text: string) => void
      filteredTodos: Array<{ id: number; text: string; done: boolean }>
      activeCount: number
    }

    Object.defineProperty(store, 'filteredTodos', {
      get() {
        const { todos, filter } = store
        if (filter === 'active') return todos.filter((t) => !t.done)
        if (filter === 'completed') return todos.filter((t) => t.done)
        return todos
      },
    })

    Object.defineProperty(store, 'activeCount', {
      get() {
        return store.todos.filter((t) => !t.done).length
      },
    })

    store.add = (text: string) => {
      store.todos = [...store.todos, { id: store.nextId++, text, done: false }]
    }

    const TodoItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoItem extends Component {
          template({ todo, onToggle, onRemove }) {
            return (
              <li class={\`todo-item \${todo.done ? 'done' : ''}\`}>
                <input type="checkbox" checked={todo.done} change={onToggle} />
                <span class="todo-text">{todo.text}</span>
                <button class="todo-remove" click={onRemove}>x</button>
              </li>
            )
          }
        }
      `,
      '/virtual/TodoItem.jsx',
      'TodoItem',
      { Component },
    )

    const TodoFilters = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoFilters extends Component {
          template({ activeCount }) {
            return <div class="todo-filters"><span class="count">{activeCount} items left</span></div>
          }
        }
      `,
      '/virtual/TodoFilters.jsx',
      'TodoFilters',
      { Component },
    )

    const TodoApp = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './todo-store.ts'
        import TodoItem from './TodoItem.jsx'
        import TodoFilters from './TodoFilters.jsx'

        export default class TodoApp extends Component {
          template() {
            const { filteredTodos, activeCount } = store
            return (
              <div class="todo-app">
                <h1>Todo</h1>
                <ul class="todo-list">
                  {filteredTodos.map(todo => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => {}}
                      onRemove={() => {}}
                    />
                  ))}
                </ul>
                {store.todos.length > 0 && (
                  <TodoFilters activeCount={activeCount} />
                )}
              </div>
            )
          }
        }
      `,
      '/virtual/TodoApp.jsx',
      'TodoApp',
      { Component, store, TodoItem, TodoFilters },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoApp()
    view.render(root)
    await flushMicrotasks()

    let parentRerenders = 0
    const originalRerender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return originalRerender()
    }

    const listBefore = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.ok(listBefore, 'todo-list should exist')
    assert.equal(view.el.querySelectorAll('.todo-item').length, 0)
    assert.equal(view.el.querySelector('.todo-filters'), null, 'filters hidden when empty')

    store.add('first')
    await flushMicrotasks()

    const listAfterFirst = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'first add must NOT call parent __geaRequestRender')
    assert.equal(listAfterFirst, listBefore, 'todo-list container must be preserved on first add')
    assert.equal(view.el.querySelectorAll('.todo-item').length, 1)
    assert.match(view.el.textContent || '', /first/)

    const firstItemEl = view.el.querySelector('.todo-item') as HTMLElement | null
    assert.ok(firstItemEl, 'first todo-item should exist')

    store.add('second')
    await flushMicrotasks()

    const listAfterSecond = view.el.querySelector('.todo-list') as HTMLElement | null
    assert.equal(parentRerenders, 0, 'second add must NOT call parent __geaRequestRender')
    assert.equal(listAfterSecond, listBefore, 'todo-list container must be preserved on second add')
    assert.equal(view.el.querySelectorAll('.todo-item').length, 2)
    assert.match(view.el.textContent || '', /second/)

    const firstItemElAfter = view.el.querySelector('.todo-item') as HTMLElement | null
    assert.equal(
      firstItemElAfter,
      firstItemEl,
      'first todo-item DOM must be preserved when adding second (no full list redraw)',
    )

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('store-dependent class binding on root element patches without full rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-store-class-no-rerender`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ highlightedId: null as string | null })

    const MyColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class MyColumn extends Component {
          template({ id, title }) {
            const isHighlighted = store.highlightedId === id
            return (
              <div class={\`column \${isHighlighted ? 'highlighted' : ''}\`}>
                <h2>{title}</h2>
                <p>Static content</p>
              </div>
            )
          }
        }
      `,
      '/virtual/MyColumn.jsx',
      'MyColumn',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new MyColumn({ id: 'col1', title: 'Column One' })
    view.render(root)

    const elBefore = view.el
    const h2Before = view.el.querySelector('h2')
    assert.ok(elBefore)
    assert.ok(h2Before)
    assert.match(elBefore.className, /column/)
    assert.doesNotMatch(elBefore.className, /highlighted/)

    store.highlightedId = 'col1'
    await flushMicrotasks()

    assert.match(view.el.className, /highlighted/)
    assert.equal(view.el, elBefore, 'root element must be preserved (no full rerender)')
    assert.equal(view.el.querySelector('h2'), h2Before, 'child h2 must be preserved')

    store.highlightedId = 'col2'
    await flushMicrotasks()

    assert.doesNotMatch(view.el.className, /highlighted/)
    assert.equal(view.el, elBefore, 'root element must still be preserved after un-highlighting')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('store-dependent class in unresolved map patches items without full list rebuild', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-unresolved-map-class-patch`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({ activeId: null as string | null })

    const MyColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class MyColumn extends Component {
          template({ items }) {
            return (
              <div class="column">
                <div class="body">
                  {items.map(item => (
                    <div class={\`card \${store.activeId === item ? 'active' : ''}\`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/MyColumn.jsx',
      'MyColumn',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new MyColumn({ items: ['a', 'b', 'c'] })
    view.render(root)

    const cards = view.el.querySelectorAll('.body > div')
    assert.equal(cards.length, 3)

    const cardA = cards[0]
    const cardB = cards[1]
    const cardC = cards[2]
    assert.ok(cardA)
    assert.ok(cardB)
    assert.ok(cardC)

    store.activeId = 'b'
    await flushMicrotasks()

    const cardsAfter = view.el.querySelectorAll('.body > div')
    assert.equal(cardsAfter.length, 3)
    assert.equal(cardsAfter[0], cardA, 'first card DOM should be preserved')
    assert.equal(cardsAfter[1], cardB, 'second card DOM should be preserved')
    assert.equal(cardsAfter[2], cardC, 'third card DOM should be preserved')
    assert.match(cardsAfter[1].className, /active/)

    store.activeId = null
    await flushMicrotasks()

    const cardsAfter2 = view.el.querySelectorAll('.body > div')
    assert.equal(cardsAfter2.length, 3)
    assert.equal(cardsAfter2[0], cardA, 'first card DOM still preserved after deactivation')
    assert.doesNotMatch(cardsAfter2[1].className, /active/)

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('unresolved map rebuilds when parent mutates prop array in-place and calls __geaUpdateProps (drop scenario)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-drop-inplace-mutation`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      tasks: { t1: { id: 't1', title: 'A' }, t2: { id: 't2', title: 'B' }, t3: { id: 't3', title: 'C' } } as Record<
        string,
        any
      >,
    })

    const MyColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class MyColumn extends Component {
          template({ column }) {
            const taskIds = column.taskIds
            return (
              <div class="column">
                <div class="body">
                  {taskIds.map(taskId =>
                    store.tasks[taskId] ? (
                      <div class="card">{store.tasks[taskId].title}</div>
                    ) : null
                  )}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/MyColumn.jsx',
      'MyColumn',
      { Component, store },
    )

    const colA = { id: 'col-a', title: 'From', taskIds: ['t1', 't2'] }
    const colB = { id: 'col-b', title: 'To', taskIds: ['t3'] }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const viewA = new MyColumn({ column: colA })
    viewA.render(root)
    const viewB = new MyColumn({ column: colB })
    viewB.render(root)

    await flushMicrotasks()

    const cardsA1 = viewA.el.querySelectorAll('.body .card')
    const cardsB1 = viewB.el.querySelectorAll('.body .card')
    assert.equal(cardsA1.length, 2, 'column A starts with 2 cards')
    assert.equal(cardsB1.length, 1, 'column B starts with 1 card')

    const idx = colA.taskIds.indexOf('t2')
    colA.taskIds.splice(idx, 1)
    colB.taskIds.push('t2')

    viewA.__geaUpdateProps({ column: colA })
    viewB.__geaUpdateProps({ column: colB })
    await flushMicrotasks()

    const cardsA2 = viewA.el.querySelectorAll('.body .card')
    const cardsB2 = viewB.el.querySelectorAll('.body .card')
    assert.equal(cardsA2.length, 1, 'column A should have 1 card after move')
    assert.equal(cardsB2.length, 2, 'column B should have 2 cards after move')
    assert.equal(cardsA2[0].textContent, 'A', 'remaining card in A is t1')
    assert.equal(cardsB2[1].textContent, 'B', 'moved card in B is t2')

    viewA.dispose()
    viewB.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('store-controlled conditional slot patches without full rerender; branch-only store keys skip rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-cond-slot-store`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const formStore = new Store({
      activeColumnId: null as string | null,
      draftTitle: '',
    }) as {
      activeColumnId: string | null
      draftTitle: string
    }

    const KanbanColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import formStore from './form-store'

        export default class KanbanColumn extends Component {
          template({ column }) {
            const isAdding = formStore.activeColumnId === column.id
            return (
              <div class="col">
                <div class="header">{column.title}</div>
                {isAdding ? (
                  <div class="add-form">
                    <input type="text" value={formStore.draftTitle} />
                  </div>
                ) : (
                  <button class="add-btn">Add task</button>
                )}
              </div>
            )
          }
        }
      `,
      '/virtual/KanbanColumn.jsx',
      'KanbanColumn',
      { Component, formStore },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new KanbanColumn({ column: { id: 'col-1', title: 'Backlog' } })
    view.render(root)
    await flushMicrotasks()

    assert.ok(view.el.querySelector('.add-btn'), 'initially shows add button')
    assert.ok(!view.el.querySelector('.add-form'), 'initially no add form')

    let rerenderCount = 0
    const origRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      rerenderCount++
      return origRender()
    }

    // Toggle conditional slot by changing activeColumnId
    formStore.activeColumnId = 'col-1'
    await flushMicrotasks()

    assert.ok(view.el.querySelector('.add-form'), 'add form should appear after store change')
    assert.ok(!view.el.querySelector('.add-btn'), 'add button should be gone')
    assert.equal(rerenderCount, 0, 'toggling conditional slot via store should NOT trigger full rerender')

    // Type into draft — branch-only store key should not cause rerender
    formStore.draftTitle = 'New task'
    await flushMicrotasks()
    assert.equal(rerenderCount, 0, 'changing draftTitle (branch-only store key) should NOT trigger full rerender')

    // Toggle back
    formStore.activeColumnId = null
    await flushMicrotasks()
    assert.ok(view.el.querySelector('.add-btn'), 'add button should reappear')
    assert.ok(!view.el.querySelector('.add-form'), 'add form should be gone')
    assert.equal(rerenderCount, 0, 'toggling slot back should NOT trigger full rerender')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('map item event handler resolves item on initial render before any list rebuild', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-map-event-initial-render`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      tasks: {
        t1: { id: 't1', title: 'Task A' },
        t2: { id: 't2', title: 'Task B' },
      } as Record<string, any>,
    })

    const MyColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class MyColumn extends Component {
          template({ column }) {
            const taskIds = column.taskIds
            return (
              <div class="column">
                <div class="body">
                  {taskIds.map(taskId =>
                    store.tasks[taskId] ? (
                      <div
                        key={taskId}
                        class="card"
                        draggable="true"
                        dragstart={(e) => {
                          if (e.dataTransfer) {
                            e.dataTransfer.setData('text/plain', taskId)
                          }
                        }}
                        click={() => store.__clicked = taskId}
                      >
                        {store.tasks[taskId].title}
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/MyColumn.jsx',
      'MyColumn',
      { Component, store },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new MyColumn({ column: { id: 'col-1', title: 'Backlog', taskIds: ['t1', 't2'] } })
    view.render(root)
    await flushMicrotasks()

    const cards = view.el.querySelectorAll('.card')
    assert.equal(cards.length, 2, 'should render 2 cards')

    assert.ok(!(cards[0] as any).__geaItem, 'initial render DOM elements should NOT have __geaItem set')

    const helperName = Object.getOwnPropertyNames(Object.getPrototypeOf(view)).find((n: string) =>
      n.startsWith('__getMapItemFromEvent'),
    )
    assert.ok(helperName, 'compiled component should have a __getMapItemFromEvent helper')
    const fakeEvent = { target: cards[0] }
    const resolved = (view as any)[helperName!](fakeEvent)
    assert.ok(resolved, 'helper should resolve a non-null value on initial render')
    assert.equal(String(resolved), 't1', 'helper should resolve to the item ID string')

    const fakeEvent2 = { target: cards[1] }
    const resolved2 = (view as any)[helperName!](fakeEvent2)
    assert.ok(resolved2, 'helper should resolve second item')
    assert.equal(String(resolved2), 't2', 'helper should resolve to t2')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('drop scenario: move task between columns uses incremental DOM updates with zero full rebuilds', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-drop-zero-rerender`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)
    const store = new Store({
      tasks: {
        t1: { id: 't1', title: 'Task A' },
        t2: { id: 't2', title: 'Task B' },
        t3: { id: 't3', title: 'Task C' },
        t4: { id: 't4', title: 'Task D' },
      } as Record<string, any>,
    })

    const MyColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import store from './store.ts'

        export default class MyColumn extends Component {
          template({ column }) {
            const taskIds = column.taskIds
            return (
              <div class="column">
                <div class="header">{column.title}</div>
                <div class="body">
                  {taskIds.map(taskId =>
                    store.tasks[taskId] ? (
                      <div key={taskId} class="card">{store.tasks[taskId].title}</div>
                    ) : null
                  )}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/MyColumn.jsx',
      'MyColumn',
      { Component, store },
    )

    const colA = { id: 'col-a', title: 'Backlog', taskIds: ['t1', 't2', 't3'] }
    const colB = { id: 'col-b', title: 'In Progress', taskIds: ['t4'] }
    const colC = { id: 'col-c', title: 'Done', taskIds: [] as string[] }

    const root = document.createElement('div')
    document.body.appendChild(root)

    const viewA = new MyColumn({ column: colA })
    viewA.render(root)
    const viewB = new MyColumn({ column: colB })
    viewB.render(root)
    const viewC = new MyColumn({ column: colC })
    viewC.render(root)

    await flushMicrotasks()

    const bodyA = viewA.el.querySelector('.body')!
    const bodyB = viewB.el.querySelector('.body')!
    const bodyC = viewC.el.querySelector('.body')!

    assert.equal(bodyA.querySelectorAll('.card').length, 3, 'column A starts with 3 cards')
    assert.equal(bodyB.querySelectorAll('.card').length, 1, 'column B starts with 1 card')
    assert.equal(bodyC.querySelectorAll('.card').length, 0, 'column C starts empty')

    const origCardA0 = bodyA.querySelector('.card')!
    const origCardA2 = bodyA.querySelectorAll('.card')[2]!
    const origCardB0 = bodyB.querySelector('.card')!

    assert.equal(origCardA0.textContent, 'Task A')
    assert.equal(origCardA2.textContent, 'Task C')
    assert.equal(origCardB0.textContent, 'Task D')

    // --- Move t2 from A to B (splice from middle, push to end) ---
    const idx = colA.taskIds.indexOf('t2')
    colA.taskIds.splice(idx, 1)
    colB.taskIds.push('t2')

    viewA.__geaUpdateProps({ column: colA })
    viewB.__geaUpdateProps({ column: colB })
    viewC.__geaUpdateProps({ column: colC })
    await flushMicrotasks()

    const cardsA = bodyA.querySelectorAll('.card')
    const cardsB = bodyB.querySelectorAll('.card')
    assert.equal(cardsA.length, 2, 'column A has 2 cards after move')
    assert.equal(cardsB.length, 2, 'column B has 2 cards after move')
    assert.equal(cardsA[0].textContent, 'Task A', 'A: first card is t1')
    assert.equal(cardsA[1].textContent, 'Task C', 'A: second card is t3')
    assert.equal(cardsB[0].textContent, 'Task D', 'B: first card is t4')
    assert.equal(cardsB[1].textContent, 'Task B', 'B: second card is t2 (moved)')

    assert.equal(cardsA[0], origCardA0, 'A: t1 card is the SAME DOM node (not recreated)')
    assert.equal(cardsA[1], origCardA2, 'A: t3 card is the SAME DOM node (not recreated)')
    assert.equal(cardsB[0], origCardB0, 'B: t4 card is the SAME DOM node (not recreated)')

    assert.equal(bodyC.querySelectorAll('.card').length, 0, 'C: still empty, unaffected')

    // --- Move t3 from A to C (first move into empty column) ---
    const idx2 = colA.taskIds.indexOf('t3')
    colA.taskIds.splice(idx2, 1)
    colC.taskIds.push('t3')

    viewA.__geaUpdateProps({ column: colA })
    viewB.__geaUpdateProps({ column: colB })
    viewC.__geaUpdateProps({ column: colC })
    await flushMicrotasks()

    const cardsA2 = bodyA.querySelectorAll('.card')
    const cardsC2 = bodyC.querySelectorAll('.card')
    assert.equal(cardsA2.length, 1, 'column A has 1 card')
    assert.equal(cardsC2.length, 1, 'column C has 1 card')
    assert.equal(cardsA2[0].textContent, 'Task A')
    assert.equal(cardsC2[0].textContent, 'Task C')

    assert.equal(cardsA2[0], origCardA0, 'A: t1 card still the SAME DOM node after second move')

    const cardsB2 = bodyB.querySelectorAll('.card')
    assert.equal(cardsB2[0], origCardB0, 'B: t4 card still the SAME DOM node after second move')

    // --- Move t4 from B to A (moves card back, column B loses its only card) ---
    const idx3 = colB.taskIds.indexOf('t4')
    colB.taskIds.splice(idx3, 1)
    colA.taskIds.push('t4')

    viewA.__geaUpdateProps({ column: colA })
    viewB.__geaUpdateProps({ column: colB })
    viewC.__geaUpdateProps({ column: colC })
    await flushMicrotasks()

    const cardsA3 = bodyA.querySelectorAll('.card')
    const cardsB3 = bodyB.querySelectorAll('.card')
    const cardsC3 = bodyC.querySelectorAll('.card')
    assert.equal(cardsA3.length, 2, 'A has 2 cards after receiving t4')
    assert.equal(cardsB3.length, 1, 'B has 1 card (only t2 remains)')
    assert.equal(cardsC3.length, 1, 'C still has 1 card')

    assert.equal(cardsA3[0].textContent, 'Task A')
    assert.equal(cardsA3[1].textContent, 'Task D')
    assert.equal(cardsB3[0].textContent, 'Task B')

    assert.equal(cardsA3[0], origCardA0, 'A: t1 card STILL the same DOM node through all moves')

    // --- No-op: update props without any array change ---
    const headerA = viewA.el.querySelector('.header')!
    const headerTextBefore = headerA.textContent
    viewA.__geaUpdateProps({ column: colA })
    await flushMicrotasks()

    const cardsA4 = bodyA.querySelectorAll('.card')
    assert.equal(cardsA4.length, 2, 'A still has 2 cards after no-op update')
    assert.equal(cardsA4[0], origCardA0, 'A: t1 card unchanged after no-op')
    assert.equal(headerA.textContent, headerTextBefore, 'header text unchanged')

    viewA.dispose()
    viewB.dispose()
    viewC.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('local state attribute bindings and conditional slot patch without full rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `local-state-attrs-${Date.now()}`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const CopyButton = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class CopyButton extends Component {
          copied = false

          doCopy() {
            this.copied = true
          }

          resetCopy() {
            this.copied = false
          }

          template() {
            const copied = this.copied
            return (
              <div class="wrapper">
                <button
                  class={\`copy-btn\${copied ? ' copied' : ''}\`}
                  title={copied ? 'Copied!' : 'Copy'}
                  click={() => this.doCopy()}
                >
                  <svg viewBox="0 0 24 24">
                    {copied ? (
                      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="green" />
                    ) : (
                      <path d="M16 1H6v12h2V3h8zm3 4H10v14h9V5z" fill="gray" />
                    )}
                  </svg>
                </button>
              </div>
            )
          }
        }
      `,
      '/virtual/CopyButton.jsx',
      'CopyButton',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new CopyButton()
    view.render(root)
    await flushMicrotasks()

    let rerenders = 0
    const origRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      rerenders++
      return origRender()
    }

    const btn = root.querySelector('button') as HTMLElement
    assert.ok(btn, 'button exists')
    assert.equal(btn.className, 'copy-btn', 'initial class has no "copied"')
    assert.equal(btn.getAttribute('title'), 'Copy', 'initial title is "Copy"')

    const svgPath = root.querySelector('svg path') as SVGPathElement
    assert.ok(svgPath, 'svg path exists')
    assert.equal(svgPath.getAttribute('fill'), 'gray', 'initial icon is gray')

    const btnRef = btn
    const wrapperRef = root.querySelector('.wrapper') as HTMLElement

    view.doCopy()
    await flushMicrotasks()

    assert.equal(rerenders, 0, 'no full rerender after state change')
    assert.equal(btn.className, 'copy-btn copied', 'class updated to include "copied"')
    assert.equal(btn.getAttribute('title'), 'Copied!', 'title updated to "Copied!"')

    const svgPathAfter = root.querySelector('svg path') as SVGPathElement
    assert.ok(svgPathAfter, 'svg path still exists after state change')
    assert.equal(svgPathAfter.getAttribute('fill'), 'green', 'icon switched to green checkmark')

    assert.equal(root.querySelector('button'), btnRef, 'button DOM node preserved')
    assert.equal(root.querySelector('.wrapper'), wrapperRef, 'wrapper DOM node preserved')

    view.resetCopy()
    await flushMicrotasks()

    assert.equal(rerenders, 0, 'no full rerender after resetting state')
    assert.equal(btn.className, 'copy-btn', 'class back to no "copied"')
    assert.equal(btn.getAttribute('title'), 'Copy', 'title back to "Copy"')

    const svgPathReset = root.querySelector('svg path') as SVGPathElement
    assert.equal(svgPathReset.getAttribute('fill'), 'gray', 'icon back to gray')
    assert.equal(root.querySelector('button'), btnRef, 'button still same DOM node')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('__onPropChange does not crash when an object prop becomes null', async () => {
  const restoreDom = installDom()

  try {
    const seed = `null-prop-${Date.now()}`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const BoardingCard = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class BoardingCard extends Component {
          copied = false

          doCopy() { this.copied = true }
          resetCopy() { this.copied = false }

          template({ pass }) {
            const copied = this.copied
            return (
              <div class="card">
                <span class="route">{pass.departure} → {pass.arrival}</span>
                <span class="code">{pass.confirmationCode}</span>
                <span class="pax">{pass.passengerName}</span>
                <button class={copied ? 'btn copied' : 'btn'}>
                  <svg viewBox="0 0 24 24">
                    {copied ? (
                      <path d="M9 16L5 12l-1 1L9 19 21 7l-1-1z" fill="green" />
                    ) : (
                      <path d="M16 1H6v12h2V3h8zm3 4H10v14h9V5z" fill="gray" />
                    )}
                  </svg>
                </button>
              </div>
            )
          }
        }
      `,
      '/virtual/BoardingCard.jsx',
      'BoardingCard',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new BoardingCard()
    view.props = { pass: { departure: 'IST', arrival: 'JFK', confirmationCode: 'ABC123', passengerName: 'Jane' } }
    view.render(root)
    await flushMicrotasks()

    assert.equal(root.querySelector('.route')!.textContent!.trim(), 'IST → JFK')
    assert.equal(root.querySelector('.code')!.textContent, 'ABC123')
    assert.equal(root.querySelector('.pax')!.textContent, 'Jane')

    assert.doesNotThrow(() => {
      view.__geaUpdateProps({ pass: null })
    }, 'setting object prop to null must not throw')

    assert.equal(
      root.querySelector('.route')!.textContent!.trim(),
      'IST → JFK',
      'DOM stays unchanged when prop becomes null',
    )

    assert.doesNotThrow(() => {
      view.__geaUpdateProps({
        pass: { departure: 'LAX', arrival: 'ORD', confirmationCode: 'XYZ', passengerName: 'Bob' },
      })
    }, 'restoring prop must not throw')
    assert.equal(root.querySelector('.route')!.textContent!.trim(), 'LAX → ORD', 'DOM updates when prop is restored')
    assert.equal(root.querySelector('.pax')!.textContent, 'Bob')

    view.dispose()
    await flushMicrotasks()
  } finally {
    restoreDom()
  }
})

test('store getter props produce surgical DOM patches without full rerender', async () => {
  const restoreDom = installDom()
  const dir = await mkdtemp(join(tmpdir(), 'gea-getter-surgical-'))

  try {
    const seed = `runtime-${Date.now()}-getter-surgical`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    await writeFile(
      join(dir, 'todo-store.ts'),
      `import { Store } from 'gea'
export default class TodoStore extends Store {
  todos = [] as Array<{ id: number; text: string; done: boolean }>
  draft = ''
  get activeCount(): number {
    return this.todos.filter(t => !t.done).length
  }
  get completedCount(): number {
    return this.todos.filter(t => t.done).length
  }
}`,
    )

    const store = new Store({
      todos: [] as Array<{ id: number; text: string; done: boolean }>,
      draft: '',
    }) as any

    Object.defineProperty(store, 'activeCount', {
      get() {
        return store.todos.filter((t: any) => !t.done).length
      },
    })
    Object.defineProperty(store, 'completedCount', {
      get() {
        return store.todos.filter((t: any) => t.done).length
      },
    })

    const TodoFilters = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoFilters extends Component {
          template({ activeCount, completedCount }) {
            return (
              <div class="todo-filters">
                <span class="active-count">{activeCount} items left</span>
                <span class="completed-count">{completedCount} completed</span>
              </div>
            )
          }
        }
      `,
      join(dir, 'TodoFilters.jsx'),
      'TodoFilters',
      { Component },
    )

    const TodoApp = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import todoStore from './todo-store'
        import TodoFilters from './TodoFilters'

        export default class TodoApp extends Component {
          template() {
            const { activeCount, completedCount } = todoStore
            return (
              <div class="todo-app">
                <TodoFilters activeCount={activeCount} completedCount={completedCount} />
              </div>
            )
          }
        }
      `,
      join(dir, 'TodoApp.jsx'),
      'TodoApp',
      { Component, todoStore: store, TodoFilters },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new TodoApp()
    view.render(root)
    await flushMicrotasks()

    assert.match(root.querySelector('.active-count')?.textContent || '', /0 items left/)
    assert.match(root.querySelector('.completed-count')?.textContent || '', /0 completed/)

    let parentRerenders = 0
    const origParentRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      parentRerenders++
      return origParentRender()
    }

    const filtersChild = view._todoFilters
    assert.ok(filtersChild, 'TodoFilters child must exist after render')
    let childRerenders = 0
    const origChildRender = filtersChild.__geaRequestRender.bind(filtersChild)
    filtersChild.__geaRequestRender = () => {
      childRerenders++
      return origChildRender()
    }

    const filtersElBefore = root.querySelector('.todo-filters')
    assert.ok(filtersElBefore, 'todo-filters element should exist')

    store.todos = [
      { id: 1, text: 'buy milk', done: false },
      { id: 2, text: 'walk dog', done: true },
    ]
    await flushMicrotasks()

    assert.match(root.querySelector('.active-count')?.textContent || '', /1 items left/)
    assert.match(root.querySelector('.completed-count')?.textContent || '', /1 completed/)

    assert.equal(parentRerenders, 0, 'parent must NOT call __geaRequestRender')
    assert.equal(childRerenders, 0, 'child must NOT call __geaRequestRender (should use surgical prop patches)')

    const filtersElAfter = root.querySelector('.todo-filters')
    assert.equal(filtersElAfter, filtersElBefore, 'TodoFilters DOM element must be the same object (not replaced)')

    parentRerenders = 0
    childRerenders = 0
    store.todos = store.todos.map((t: any) => (t.id === 1 ? { ...t, done: true } : t))
    await flushMicrotasks()

    assert.match(root.querySelector('.active-count')?.textContent || '', /0 items left/)
    assert.match(root.querySelector('.completed-count')?.textContent || '', /2 completed/)
    assert.equal(parentRerenders, 0, 'parent must NOT rerender on toggle')
    assert.equal(childRerenders, 0, 'child must NOT rerender on toggle (should use surgical prop patches)')

    parentRerenders = 0
    childRerenders = 0
    let childRefreshCalled = false
    const refreshMethodName = Object.keys(view).find((k) => k.startsWith('__refreshChildProps_'))
    if (refreshMethodName) {
      const origRefresh = (view as any)[refreshMethodName].bind(view)
      ;(view as any)[refreshMethodName] = () => {
        childRefreshCalled = true
        return origRefresh()
      }
    }

    store.draft = 'some text'
    await flushMicrotasks()

    assert.equal(
      childRefreshCalled,
      false,
      'draft mutation must NOT trigger __refreshChildProps (observer targets ["todos"], not root [])',
    )
    assert.equal(parentRerenders, 0, 'draft mutation must NOT rerender parent')
    assert.equal(childRerenders, 0, 'draft mutation must NOT rerender child')

    view.dispose()
    await flushMicrotasks()
  } finally {
    await rm(dir, { recursive: true, force: true })
    restoreDom()
  }
})

// ---------------------------------------------------------------------------
// Real-file store tests: exercise the OPTIMIZED observer path
// (analyzeStoreGetters + analyzeStoreReactiveFields succeed because the
// store file exists on disk, unlike virtual-file tests that always fall
// back to root observers)
// ---------------------------------------------------------------------------

test('real-file store: conditional child renders when getter-source array grows (todo-app pattern)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-realfile-todo`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const store = new Store({
      todos: [] as Array<{ id: number; text: string; done: boolean }>,
      filter: 'all' as 'all' | 'active' | 'completed',
      draft: '',
      nextId: 1,
    }) as any

    Object.defineProperty(store, 'filteredTodos', {
      get() {
        const { todos, filter } = store
        if (filter === 'active') return todos.filter((t: any) => !t.done)
        if (filter === 'completed') return todos.filter((t: any) => t.done)
        return todos
      },
    })
    Object.defineProperty(store, 'activeCount', {
      get() {
        return store.todos.filter((t: any) => !t.done).length
      },
    })
    Object.defineProperty(store, 'completedCount', {
      get() {
        return store.todos.filter((t: any) => t.done).length
      },
    })

    store.add = (text: string) => {
      store.todos = [...store.todos, { id: store.nextId++, text, done: false }]
    }
    store.toggle = (id: number) => {
      const todo = store.todos.find((t: any) => t.id === id)
      if (todo) todo.done = !todo.done
    }
    store.remove = (id: number) => {
      store.todos = store.todos.filter((t: any) => t.id !== id)
    }
    store.setFilter = (f: string) => {
      store.filter = f
    }

    const fixtureDir = join(__dirname, 'fixtures')

    const TodoItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoItem extends Component {
          template({ todo, onToggle, onRemove }) {
            return (
              <li class={\`todo-item \${todo.done ? 'done' : ''}\`}>
                <span class="todo-text">{todo.text}</span>
                <button class="todo-remove" click={onRemove}>x</button>
              </li>
            )
          }
        }
      `,
      join(fixtureDir, 'TodoItem.jsx'),
      'TodoItem',
      { Component },
    )

    const TodoFilters = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class TodoFilters extends Component {
          template({ activeCount, completedCount, filter }) {
            return (
              <div class="todo-filters">
                <span class="count">{activeCount} left</span>
                <span class="completed">{completedCount} done</span>
              </div>
            )
          }
        }
      `,
      join(fixtureDir, 'TodoFilters.jsx'),
      'TodoFilters',
      { Component },
    )

    const TodoApp = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import todoStore from './todo-store.ts'
        import TodoItem from './TodoItem.jsx'
        import TodoFilters from './TodoFilters.jsx'

        export default class TodoApp extends Component {
          template() {
            const { filteredTodos, activeCount, completedCount } = todoStore
            return (
              <div class="todo-app">
                <h1>Todo</h1>
                <ul class="todo-list">
                  {filteredTodos.map(todo => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => todoStore.toggle(todo.id)}
                      onRemove={() => todoStore.remove(todo.id)}
                    />
                  ))}
                </ul>
                {todoStore.todos.length > 0 && (
                  <TodoFilters
                    activeCount={activeCount}
                    completedCount={completedCount}
                    filter={todoStore.filter}
                  />
                )}
              </div>
            )
          }
        }
      `,
      join(fixtureDir, 'TodoApp.jsx'),
      'TodoApp',
      { Component, todoStore: store, TodoItem, TodoFilters },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)
    const view = new TodoApp()
    view.render(root)
    await flushMicrotasks()

    assert.equal(view.el.querySelector('.todo-filters'), null, 'filters hidden when no todos')

    store.add('Buy groceries')
    await flushMicrotasks()

    assert.equal(view.el.querySelectorAll('.todo-item').length, 1, 'one todo rendered')
    assert.ok(view.el.querySelector('.todo-filters'), 'filters MUST appear after adding a todo')
    assert.match(view.el.querySelector('.count')?.textContent || '', /1 left/)

    store.add('Walk the dog')
    await flushMicrotasks()

    assert.equal(view.el.querySelectorAll('.todo-item').length, 2, 'two todos rendered')
    assert.match(view.el.querySelector('.count')?.textContent || '', /2 left/)

    view.dispose()
  } finally {
    restoreDom()
  }
})

test('local state change patches DOM without full rerender (editing toggle)', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-local-state-patch`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const EditableItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class EditableItem extends Component {
          editing = false
          editText = ''

          startEditing() {
            if (this.editing) return
            this.editing = true
            this.editText = this.props.label
          }

          handleInput(e) {
            this.editText = e.target.value
          }

          template({ label }) {
            const { editing, editText } = this
            return (
              <li class={\`item \${editing ? 'editing' : ''}\`}>
                <span class="label">{label}</span>
                <input class="edit-input" type="text" value={editText} input={this.handleInput} />
              </li>
            )
          }
        }
      `,
      '/virtual/EditableItem.jsx',
      'EditableItem',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)
    const item = new EditableItem({ label: 'Buy groceries' })
    item.render(root)
    await flushMicrotasks()

    assert.ok(item.el, 'item rendered')
    assert.ok(!item.el.className.includes('editing'), 'not editing initially')

    let rerenders = 0
    const origRerender = item.__geaRequestRender.bind(item)
    item.__geaRequestRender = () => {
      rerenders++
      return origRerender()
    }

    item.startEditing()
    await flushMicrotasks()

    assert.ok(item.el.className.includes('editing'), 'editing class added')
    assert.equal(rerenders, 0, 'editing toggle must patch class without full rerender')

    item.dispose()
  } finally {
    restoreDom()
  }
})

test('conditional slot with local-state destructured guard renders without ReferenceError', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-cond-local-destr`
    const [{ default: Component }] = await loadRuntimeModules(seed)

    const EditableItem = await compileJsxComponent(
      `
        import { Component } from 'gea'

        export default class EditableItem extends Component {
          editing = false
          editText = ''

          startEditing() {
            this.editing = true
            this.editText = this.props.label
          }

          handleInput(e) {
            this.editText = e.target.value
          }

          template({ label }) {
            const { editing, editText } = this
            return (
              <li class={\`item \${editing ? 'editing' : ''}\`}>
                <span class="label">{label}</span>
                {editing && <input class="edit-input" type="text" value={editText} input={this.handleInput} />}
              </li>
            )
          }
        }
      `,
      '/virtual/EditableItemCond.jsx',
      'EditableItem',
      { Component },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)
    const item = new EditableItem({ label: 'Buy groceries' })
    item.render(root)
    await flushMicrotasks()

    assert.ok(item.el, 'item rendered without constructor ReferenceError')
    assert.ok(!item.el.querySelector('.edit-input'), 'edit input absent when not editing')

    item.startEditing()
    await flushMicrotasks()

    assert.ok(item.el.className.includes('editing'), 'editing class added')
    const editInput = item.el.querySelector('.edit-input') as any
    assert.ok(editInput, 'edit input appears after startEditing')
    assert.equal(
      editInput.getAttribute('value'),
      'Buy groceries',
      'edit input value must reflect the label set in startEditing',
    )

    item.editText = 'Buy milk'
    await flushMicrotasks()

    const updatedInput = item.el.querySelector('.edit-input') as any
    assert.ok(updatedInput, 'edit input still present after editText change')
    assert.equal(
      updatedInput.getAttribute('value'),
      'Buy milk',
      'edit input value must update when editText changes while slot is visible',
    )

    item.dispose()
  } finally {
    restoreDom()
  }
})

test('kanban add-form: typing in draftTitle input must NOT trigger full rerender', async () => {
  const restoreDom = installDom()

  try {
    const seed = `runtime-${Date.now()}-kanban-draft-rerender`
    const [{ default: Component }, { Store }] = await loadRuntimeModules(seed)

    const kanbanStore = new Store({
      addingToColumnId: null as string | null,
      draftTitle: '',
      draggingTaskId: null as string | null,
      dragOverColumnId: null as string | null,
    }) as {
      addingToColumnId: string | null
      draftTitle: string
      draggingTaskId: string | null
      dragOverColumnId: string | null
      setDraftTitle: (e: { target: { value: string } }) => void
    }
    kanbanStore.setDraftTitle = function (e: { target: { value: string } }) {
      ;(this as any).draftTitle = e.target.value
    }

    const KanbanColumn = await compileJsxComponent(
      `
        import { Component } from 'gea'
        import kanbanStore from './kanban-store'

        export default class KanbanColumn extends Component {
          template({ column }) {
            const isDragOver = kanbanStore.dragOverColumnId === column.id
            const isAdding = kanbanStore.addingToColumnId === column.id
            return (
              <div class={\`col \${isDragOver ? 'drag-over' : ''}\`}>
                <div class="header">{column.title}</div>
                <div class="body">
                  {isAdding ? (
                    <div class="kanban-add-form">
                      <input
                        type="text"
                        placeholder="Task title"
                        value={kanbanStore.draftTitle}
                        input={kanbanStore.setDraftTitle}
                      />
                      <div class="kanban-add-form-actions">
                        <button class="add-btn">Add</button>
                        <button class="cancel-btn">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button class="add-task">+ Add task</button>
                  )}
                </div>
              </div>
            )
          }
        }
      `,
      '/virtual/KanbanColumnDraft.jsx',
      'KanbanColumn',
      { Component, kanbanStore },
    )

    const root = document.createElement('div')
    document.body.appendChild(root)

    const view = new KanbanColumn({ column: { id: 'col-1', title: 'Backlog' } })
    view.render(root)
    await flushMicrotasks()

    assert.ok(view.el.querySelector('.add-task'), 'initially shows add-task button')
    assert.ok(!view.el.querySelector('.kanban-add-form'), 'initially no add form')

    // Open the add form
    kanbanStore.addingToColumnId = 'col-1'
    await flushMicrotasks()

    assert.ok(view.el.querySelector('.kanban-add-form'), 'add form should appear')
    assert.ok(!view.el.querySelector('.add-task'), 'add-task button should be gone')

    const inputBefore = view.el.querySelector('input[type="text"]') as HTMLElement | null
    assert.ok(inputBefore, 'input must be present in add form')

    // Spy on full rerenders AFTER the form is open
    let rerenderCount = 0
    const origRender = view.__geaRequestRender.bind(view)
    view.__geaRequestRender = () => {
      rerenderCount++
      return origRender()
    }

    // Simulate typing — change draftTitle in the store
    kanbanStore.draftTitle = 'N'
    await flushMicrotasks()
    assert.equal(rerenderCount, 0, 'typing first char must NOT trigger full rerender')

    kanbanStore.draftTitle = 'Ne'
    await flushMicrotasks()
    assert.equal(rerenderCount, 0, 'typing second char must NOT trigger full rerender')

    kanbanStore.draftTitle = 'New task'
    await flushMicrotasks()
    assert.equal(rerenderCount, 0, 'typing full title must NOT trigger full rerender')

    // The input element should be the same DOM node (not replaced)
    const inputAfter = view.el.querySelector('input[type="text"]') as HTMLElement | null
    assert.ok(inputAfter, 'input must still be present')
    assert.equal(inputAfter, inputBefore, 'input DOM node must be preserved (not replaced by rerender)')

    view.dispose()
  } finally {
    restoreDom()
  }
})

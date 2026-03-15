import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'

import babelGenerator from '@babel/generator'
import * as t from '@babel/types'
import { JSDOM } from 'jsdom'

import { generateArrayHandlers, generateEnsureArrayConfigsMethod } from '../generate-array'
import { generateObserveHandler } from '../generate-observe'
import type { ArrayMapBinding } from '../ir'
import { geaPlugin } from '../index'
import { parseSource } from '../parse'
import { transformComponentFile } from '../transform-component'
import { generatePatchItemMethod, generateCreateItemMethod } from '../generate-array-patch'
import { getObserveMethodName } from '../utils'
import { applyListChanges } from '../../gea/src/lib/base/list'

const generate = 'default' in babelGenerator ? babelGenerator.default : babelGenerator

function withDom<T>(run: (dom: JSDOM) => T): T {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    NodeFilter: globalThis.NodeFilter,
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
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  })

  try {
    return run(dom)
  } finally {
    Object.assign(globalThis, previous)
    dom.window.close()
  }
}

function createArrayObserverHarness(arrayMap: ArrayMapBinding) {
  const arrayPath = arrayMap.arrayPathParts.join('.')
  const methodName = `render${arrayPath.charAt(0).toUpperCase() + arrayPath.slice(1)}Item`
  const observeMethodName = getObserveMethodName(arrayMap.arrayPathParts, arrayMap.storeVar)
  const methods = generateArrayHandlers(arrayMap, observeMethodName)
  const capName = arrayPath.charAt(0).toUpperCase() + arrayPath.slice(1).replace(/\./g, '')
  const patchName = `patch${capName}Item`
  const createName = `create${capName}Item`
  const extraMethods: t.ClassMethod[] = []
  const patchMethod = generatePatchItemMethod(arrayMap)
  if (patchMethod) {
    extraMethods.push(patchMethod)
  } else {
    extraMethods.push(
      t.classMethod(
        'method',
        t.identifier(patchName),
        [t.identifier('el'), t.identifier('item')],
        t.blockStatement([
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(t.identifier('el'), t.identifier('__geaItem')),
              t.identifier('item'),
            ),
          ),
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(t.identifier('el'), t.identifier('textContent')),
              t.memberExpression(t.identifier('item'), t.identifier('label')),
            ),
          ),
        ]),
      ),
    )
  }
  const createMethod = generateCreateItemMethod(arrayMap)
  if (createMethod) {
    extraMethods.push(createMethod)
  } else {
    extraMethods.push(
      t.classMethod(
        'method',
        t.identifier(createName),
        [t.identifier('item')],
        t.blockStatement([
          t.variableDeclaration('var', [
            t.variableDeclarator(
              t.identifier('__tw'),
              t.callExpression(
                t.memberExpression(
                  t.memberExpression(t.thisExpression(), t.identifier(`__${arrayPath.replace(/\./g, '_')}_container`)),
                  t.identifier('cloneNode'),
                ),
                [t.booleanLiteral(false)],
              ),
            ),
          ]),
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(t.identifier('__tw'), t.identifier('innerHTML')),
              t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(methodName)), [
                t.identifier('item'),
              ]),
            ),
          ),
          t.variableDeclaration('var', [
            t.variableDeclarator(
              t.identifier('el'),
              t.memberExpression(t.identifier('__tw'), t.identifier('firstElementChild')),
            ),
          ]),
          t.returnStatement(t.identifier('el')),
        ]),
      ),
    )
  }
  const classAst = t.program([
    t.classDeclaration(
      t.identifier('Harness'),
      null,
      t.classBody([
        t.classMethod(
          'method',
          t.identifier('__applyListChanges'),
          [t.identifier('container'), t.identifier('array'), t.identifier('changes'), t.identifier('config')],
          t.blockStatement([
            t.returnStatement(
              t.callExpression(t.identifier('applyListChanges'), [
                t.identifier('container'),
                t.identifier('array'),
                t.identifier('changes'),
                t.identifier('config'),
              ]),
            ),
          ]),
        ),
        t.classMethod(
          'method',
          t.identifier('$'),
          [t.identifier('selector')],
          t.blockStatement([
            t.returnStatement(
              t.callExpression(
                t.memberExpression(
                  t.memberExpression(t.thisExpression(), t.identifier('root')),
                  t.identifier('querySelector'),
                ),
                [t.identifier('selector')],
              ),
            ),
          ]),
        ),
        t.classMethod(
          'method',
          t.identifier(methodName),
          [t.identifier('item')],
          t.blockStatement([
            t.returnStatement(
              t.templateLiteral(
                [
                  t.templateElement({
                    raw: '<li data-gea-item-id="',
                    cooked: '<li data-gea-item-id="',
                  }),
                  t.templateElement({ raw: '">', cooked: '">' }),
                  t.templateElement({ raw: '</li>', cooked: '</li>' }, true),
                ],
                [
                  t.memberExpression(t.identifier('item'), t.identifier(arrayMap.itemIdProperty || 'id')),
                  t.memberExpression(t.identifier('item'), t.identifier('label')),
                ],
              ),
            ),
          ]),
        ),
        ...extraMethods,
        ...(generateEnsureArrayConfigsMethod([arrayMap]) ? [generateEnsureArrayConfigsMethod([arrayMap])!] : []),
        ...methods,
      ]),
    ),
  ])

  const source = generate(classAst).code
  const Harness = new Function('applyListChanges', `${source}; return Harness;`)(applyListChanges) as new () => {
    root: HTMLElement
  } & Record<string, any>

  return new Harness()
}

function renderInitialList(
  harness: ReturnType<typeof createArrayObserverHarness>,
  items: Array<{ [key: string]: unknown }>,
) {
  harness.root = document.createElement('div')
  harness.root.innerHTML = '<ul></ul>'
  harness[getObserveMethodName('todos')](items, [
    {
      type: 'update',
      pathParts: ['todos'],
      newValue: items,
    },
  ])
}

function transformComponentSource(source: string): string {
  const parsed = parseSource(source)
  assert.ok(parsed)
  assert.ok(parsed.componentClassName)

  const original = parseSource(source)
  assert.ok(original)
  const storeImports = new Map<string, string>()

  parsed.imports.forEach((importSource, localName) => {
    if (parsed.importKinds.get(localName) !== 'default') return
    if (!/store/i.test(importSource)) return
    storeImports.set(localName, importSource)
  })

  const transformed = transformComponentFile(
    parsed.ast,
    parsed.imports,
    storeImports,
    parsed.componentClassName,
    '/virtual/test-component.jsx',
    original.ast,
    new Set(),
  )

  assert.equal(transformed, true)
  return generate(parsed.ast).code
}

async function transformWithPlugin(source: string, id: string): Promise<string | null> {
  const plugin = geaPlugin()
  const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform?.handler
  const result = await transform?.call({} as never, source, id)
  if (!result) return null
  return typeof result === 'string' ? result : result.code
}

function createObserveHarness(methodSource: string, setupSource = '') {
  const source = `
    class Harness {
      constructor() {
        ${setupSource}
      }
      $(selector) {
        return this.root.querySelector(selector)
      }
      ${methodSource}
    }
    return Harness;
  `
  const Harness = new Function(source)() as new () => {
    root: HTMLElement
    props?: Record<string, unknown>
  } & Record<string, any>
  return new Harness()
}

test('array observer preserves DOM order for unshift insertions', () => {
  withDom(() => {
    const harness = createArrayObserverHarness({
      arrayPathParts: ['todos'],
      itemVariable: 'todo',
      itemBindings: [],
      containerSelector: 'ul',
      isImportedState: false,
      itemIdProperty: 'id',
    })

    const todos = [
      { id: 1, label: 'first' },
      { id: 2, label: 'second' },
    ]

    renderInitialList(harness, todos)

    todos.unshift({ id: 3, label: 'zero' })
    harness[getObserveMethodName('todos')](todos, [
      {
        type: 'add',
        property: '0',
        pathParts: ['todos', '0'],
        newValue: todos[0],
      },
    ])

    const order = Array.from(harness.root.querySelectorAll('li')).map((node) => node.textContent)
    assert.deepEqual(order, ['zero', 'first', 'second'])
  })
})

test('array observer removes nodes when keyed by a non-id property', () => {
  withDom(() => {
    const harness = createArrayObserverHarness({
      arrayPathParts: ['todos'],
      itemVariable: 'todo',
      itemBindings: [],
      containerSelector: 'ul',
      isImportedState: false,
      itemIdProperty: 'key',
    })

    const todos = [
      { key: 'alpha', label: 'first' },
      { key: 'beta', label: 'second' },
    ]

    renderInitialList(harness, todos)

    const removed = todos.splice(0, 1)[0]
    harness[getObserveMethodName('todos')](todos, [
      {
        type: 'delete',
        property: '0',
        pathParts: ['todos', '0'],
        previousValue: removed,
      },
    ])

    const labels = Array.from(harness.root.querySelectorAll('li')).map((node) => node.textContent)
    assert.deepEqual(labels, ['second'])
  })
})

test('array observer batches contiguous tail appends into one DOM append', () => {
  withDom(() => {
    const harness = createArrayObserverHarness({
      arrayPathParts: ['todos'],
      itemVariable: 'todo',
      itemBindings: [],
      containerSelector: 'ul',
      isImportedState: false,
      itemIdProperty: 'id',
    })

    const todos = [
      { id: 1, label: 'first' },
      { id: 2, label: 'second' },
    ]

    renderInitialList(harness, todos)

    const list = harness.root.querySelector('ul')
    assert.ok(list)

    let appendChildCalls = 0
    let insertBeforeCalls = 0
    const originalAppendChild = list.appendChild.bind(list)
    const originalInsertBefore = list.insertBefore.bind(list)

    list.appendChild = ((node: Node) => {
      appendChildCalls++
      return originalAppendChild(node)
    }) as typeof list.appendChild
    list.insertBefore = ((node: Node, child: Node | null) => {
      insertBeforeCalls++
      return originalInsertBefore(node, child)
    }) as typeof list.insertBefore

    todos.push({ id: 3, label: 'third' }, { id: 4, label: 'fourth' })
    harness[getObserveMethodName('todos')](todos, [
      {
        type: 'append',
        property: '2',
        pathParts: ['todos'],
        start: 2,
        count: 2,
        newValue: todos.slice(2),
      },
    ])

    const labels = Array.from(harness.root.querySelectorAll('li')).map((node) => node.textContent)
    assert.deepEqual(labels, ['first', 'second', 'third', 'fourth'])
    assert.equal(appendChildCalls, 1)
    assert.equal(insertBeforeCalls, 0)
  })
})

test('transform creates a distinct child instance for each self-closing component use', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import Counter from './counter'

    export default class ParentView extends Component {
      template() {
        return (
          <div>
            <Counter count={1} />
            <Counter count={2} />
          </div>
        )
      }
    }
  `)

  assert.match(output, /this\._counter = new Counter\(/)
  assert.match(output, /this\._counter2 = new Counter\(/)
})

test('static reactivity wires subscriptions for every imported store used by a component', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import counterStore from './counter-store'
    import filterStore from './filter-store'

    export default class DashboardView extends Component {
      template() {
        return (
          <div>
            <span>{counterStore.count}</span>
            <span>{filterStore.query}</span>
          </div>
        )
      }
    }
  `)

  assert.match(output, /this\.__stores\.counterStore = counterStore\.__store/)
  assert.match(output, /this\.__stores\.filterStore = filterStore\.__store/)
})

test('static reactivity detects default Store imports across files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gea-store-import-'))

  try {
    const componentPath = join(dir, 'DashboardView.jsx')
    const storePath = join(dir, 'dashboard-store.ts')

    await writeFile(
      storePath,
      `import { Store } from 'gea'
export default class DashboardStore extends Store {
  count = 1
}`,
    )

    const output = await transformWithPlugin(
      `
        import { Component } from 'gea'
        import store from './dashboard-store'

        export default class DashboardView extends Component {
          template() {
            return <div>{store.count}</div>
          }
        }
      `,
      componentPath,
    )

    assert.ok(output)
    assert.match(output, /this\.__stores\.store = store/)
    assert.match(output, /observe\(\["count"\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('functional component compiles to class component', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gea-func-comp-'))
  try {
    const componentPath = join(dir, 'OptionStep.jsx')
    const output = await transformWithPlugin(
      `
import StepHeader from './StepHeader'
import OptionItem from './OptionItem'

export default function OptionStep({ stepNumber, title, options, selectedId, showBack, nextLabel, onSelect, onBack, onContinue }) {
  const handleOptionClick = e => {
    const el = e.target.closest('[data-item-id]')
    if (el) onSelect(el.getAttribute('data-item-id'))
  }
  return (
    <section class="section-card">
      <StepHeader stepNumber={stepNumber} title={title} />
      <div class="option-grid" click={handleOptionClick}>
        {options.map(opt => (
          <OptionItem
            key={opt.id}
            itemId={opt.id}
            label={opt.label}
            selected={selectedId === opt.id}
          />
        ))}
      </div>
      <div class="nav-buttons">
        {showBack && <button click={onBack}>Back</button>}
        <button click={onContinue}>{nextLabel}</button>
      </div>
    </section>
  )
}
      `,
      componentPath,
    )
    assert.ok(output)
    assert.match(output, /export default class OptionStep extends Component/)
    assert.match(output, /template\(/)
    assert.match(output, /import.*Component.*from ['"]gea['"]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('component inside .map() compiles to component array instances', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gea-func-prop-'))
  try {
    const componentPath = join(dir, 'OptionStep.jsx')
    const output = await transformWithPlugin(
      `
import OptionItem from './OptionItem'

export default function OptionStep({ options, onSelect }) {
  return (
    <div>
      {options.map(opt => (
        <OptionItem onSelect={() => onSelect(opt.id)} />
      ))}
    </div>
  )
}
      `,
      componentPath,
    )
    assert.ok(output)
    assert.match(output, /_buildOptionsItems/)
    assert.match(output, /this\._optionsItems\.join/)
    assert.match(output, /this\.props\.onSelect/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('root prop callback events do not leak as html attributes', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class OptionItem extends Component {
      template({ label, onSelect }) {
        return <div class="option-item" click={onSelect}>{label}</div>
      }
    }
  `)

  assert.match(output, /get events\(\)/)
  assert.match(output, /this\.props\["onSelect"\]|this\.props\.onSelect/)
  assert.doesNotMatch(output, /setAttribute\("click"/)
  assert.doesNotMatch(output, /removeAttribute\("click"/)
  assert.doesNotMatch(output, / click="\$\{/)
})

test('transform recognizes aliased named component imports', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import { Counter as FancyCounter } from './counter'

    export default class ParentView extends Component {
      template() {
        return (
          <section>
            <FancyCounter count={1} />
            <FancyCounter count={2} />
          </section>
        )
      }
    }
  `)

  assert.match(output, /this\._fancyCounter = new FancyCounter\(/)
  assert.match(output, /this\._fancyCounter2 = new FancyCounter\(/)
})

test('prop patch methods use getElementById for element lookup', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class Counter extends Component {
      constructor({ count }) {
        super({ count })
      }
      template({ count }) {
        return (
          <div class="counter-card">
            <p class="counter-value">{count}</p>
          </div>
        )
      }
    }
  `)

  assert.match(output, /counter-value.*id=.*this\.id.*-b\d|id=.*this\.id.*-b\d.*counter-value/)
  assert.ok(
    /getElementById\([^)]*this\.id[^)]*\+[^)]*"-b\d"\)/.test(output),
    'prop patch must use getElementById, not this.$(selector)',
  )
})

test('prop text patch preserves surrounding template text', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class CheckoutButton extends Component {
      template({ totalPrice }) {
        return (
          <button class="btn">
            Pay $\${totalPrice}
          </button>
        )
      }
    }
  `)

  assert.match(output, /const __boundValue = `[\s\S]*Pay \$\$\$\{this\.props\.totalPrice\}[\s\S]*`;/)
  assert.match(output, /textContent = __boundValue/)
  assert.doesNotMatch(output, /__geaPatchProp_totalPrice\(value\)[\s\S]*textContent = value/)
})

test('generated selectors distinguish repeated sibling bindings', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class CounterPair extends Component {
      constructor() {
        super()
        this.left = 'L'
        this.right = 'R'
      }

      template() {
        return (
          <div>
            <span>{this.left}</span>
            <span>{this.right}</span>
          </div>
        )
      }
    }
  `)

  const selectors = Array.from(output.matchAll(/this\.\$\("([^"]+)"\)/g)).map((match) => match[1])
  const bindingIds = Array.from(output.matchAll(/getElementById\([^+]*\+\s*["']-([^"']+)["']\)/g)).map(
    (match) => match[1],
  )
  assert.equal(new Set(selectors).size >= 2 || new Set(bindingIds).size >= 2, true)
})

test('generated selectors distinguish repeated typed inputs', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class InputPair extends Component {
      constructor() {
        super()
        this.first = 'one'
        this.second = 'two'
      }

      template() {
        return (
          <form>
            <input type="text" value={this.first} />
            <input type="text" value={this.second} />
          </form>
        )
      }
    }
  `)

  const selectors = Array.from(output.matchAll(/this\.\$\("([^"]+)"\)/g)).map((match) => match[1])
  const bindingIds = Array.from(output.matchAll(/getElementById\([^+]*\+\s*["']-([^"']+)["']\)/g)).map(
    (match) => match[1],
  )
  assert.equal(new Set(selectors).size >= 2 || new Set(bindingIds).size >= 2, true)
})

test('multiple handlers on one element reuse a single generated selector id', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './store.ts'

    export default class TodoList extends Component {
      template() {
        return (
          <div>
            {store.todos.map(todo => (
              <input
                type="text"
                value={todo.text}
                input={store.setEditingValue}
                keydown={e => {
                  if (e.key === 'Enter') store.updateTodo(todo)
                }}
              />
            ))}
          </div>
        )
      }
    }
  `)

  const selectorIds = output.match(/input:\s*\{[\s\S]*?ev(\d+)[\s\S]*?keydown:\s*\{[\s\S]*?ev(\d+)/)
  assert.ok(selectorIds, 'expected both event handlers to be emitted')
  assert.equal(selectorIds[1], selectorIds[2], 'same element should reuse one generated selector across handlers')
  assert.doesNotMatch(output, /id="\$\{this\.id \+ "-ev\d+"\}"\s+id="\$\{this\.id \+ "-ev\d+"\}"/)
  assert.doesNotMatch(output, /data-gea-event="ev\d+"\s+data-gea-event="ev\d+"/)
})

test('conditional child components are instantiated lazily', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './store.ts'
    import ChildView from './ChildView.jsx'

    export default class ParentView extends Component {
      template() {
        return (
          <div>
            {store.show && store.payload && <ChildView payload={store.payload} />}
          </div>
        )
      }
    }
  `)

  assert.match(output, /__ensureChild_childView\(\)/)
  assert.match(output, /store\.show && store\.payload && `\$\{this\.__ensureChild_childView\(\)\}`/)
  assert.match(output, /this\._childView = null/)
  assert.match(output, /__ensureChild_childView\(\)\s*\{[\s\S]*this\._childView = new ChildView/)
  const constructorBlock = output.match(/constructor\([\s\S]*?\n {2}\}/)?.[0] || ''
  assert.doesNotMatch(constructorBlock, /this\._childView = new ChildView/)
})

test('conditional root html event handlers are preserved inside logical branches', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class BackButtonView extends Component {
      template({ showBack, onBack }) {
        return (
          <div>
            {showBack && <button class="btn btn-secondary" click={onBack}>Back</button>}
          </div>
        )
      }
    }
  `)

  assert.match(output, /showBack && `<button class="btn btn-secondary" id="\$\{this\.id \+ "-ev\d+"\}">/)
  assert.match(output, /get events\(\)\s*\{[\s\S]*click:\s*\{/)
})

test('inline event handlers capture template-local setup statements', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'

    export default class PaymentForm extends Component {
      template(props) {
        const { value, onPay } = props
        const isValid = value.trim().length > 0
        return <button click={() => isValid && onPay()}>Pay</button>
      }
    }
  `)

  assert.match(output, /template\(props\) \{[\s\S]*return `<button/)
  assert.doesNotMatch(
    output,
    /template\(props\) \{[\s\S]*onPay[\s\S]*return `<button/,
    'onPay should be pruned from template',
  )
  assert.match(
    output,
    /__event_click_0\(e, targetComponent\) \{[\s\S]*const \{\s*value,\s*onPay\s*\} = this\.props;[\s\S]*const isValid = value\.trim\(\)\.length > 0;[\s\S]*isValid && onPay\(\);/,
  )
})

test('imported store array text bindings inject id on stats element for getElementById', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoList extends Component {
      template() {
        return (
          <div class="todo-list">
            <div class="todo-items">
              {store.todos.map(todo => (
                <div class={\`todo-item\${todo.completed ? ' completed' : ''}\`} key={todo.id}>
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
  `)

  assert.ok(
    /id=.*this\.id.*-b\d.*todo-stats|todo-stats.*id=.*this\.id.*-b\d/.test(output),
    'todo-stats div must have id attribute for getElementById lookup',
  )
  assert.ok(
    /getElementById\([^)]*this\.id[^)]*\+[^)]*"-b\d"\)/.test(output),
    'stats binding must use getElementById, not this.$(selector) fallback',
  )
})

test('imported store input value binding injects id for getElementById', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoList extends Component {
      template() {
        return (
          <div class="todo-list">
            <input
              type="text"
              value={store.inputValue}
              input={store.setInputValue}
            />
          </div>
        )
      }
    }
  `)

  assert.ok(
    /input[^>]*id=.*this\.id.*-b\d|id=.*this\.id.*-b\d[^>]*input/.test(output),
    'input must have id for getElementById so value updates (e.g. clear after add) work',
  )
  assert.ok(
    /getElementById\([^)]*this\.id[^)]*\+[^)]*"-b\d"\)/.test(output),
    'input value binding must use getElementById',
  )
})

test('wildcard observers update index zero items', () => {
  withDom(() => {
    const binding = {
      pathParts: ['todos', '*', 'label'],
      type: 'text' as const,
      selector: '.label',
      elementPath: [],
      itemIdProperty: 'id',
      childPath: [0],
    }
    const method = generateObserveHandler(binding, new Map())
    const methodSource = generate(method).code
    const harness = createObserveHarness(
      methodSource,
      `
      this.todos = [{ id: 1, label: 'before' }];
      `,
    )
    harness.root = document.createElement('div')
    harness.root.innerHTML = '<div class="item" data-gea-item-id="0"><span class="label">before</span></div>'
    harness.__todos_container = harness.root

    harness[getObserveMethodName(['todos', '*', 'label'])]('after', {
      pathParts: ['todos', '0', 'label'],
      arrayPathParts: ['todos'],
      arrayIndex: 0,
      leafPathParts: ['label'],
      isArrayItemPropUpdate: true,
      newValue: 'after',
    })

    assert.equal(harness.root.querySelector('.label')?.textContent, 'after')
  })
})

test('wildcard observers resolve imported array paths correctly', () => {
  withDom(() => {
    const binding = {
      pathParts: ['todos', '*', 'label'],
      isImportedState: true,
      storeVar: 'storeState',
      type: 'text' as const,
      selector: '.label',
      elementPath: [],
      itemIdProperty: 'id',
      childPath: [0],
    }
    const method = generateObserveHandler(binding, new Map([['storeState', './store']]))
    const methodSource = generate(method).code
    const harness = createObserveHarness(
      methodSource,
      `
      this.__stores = { storeState: { todos: [{ id: 1, label: 'before' }] } };
      `,
    )
    harness.root = document.createElement('div')
    harness.root.innerHTML = '<div class="item" data-gea-item-id="0"><span class="label">before</span></div>'
    harness.__todos_container = harness.root

    harness[getObserveMethodName(['todos', '*', 'label'], 'storeState')]('after', {
      pathParts: ['todos', '0', 'label'],
      arrayPathParts: ['todos'],
      arrayIndex: 0,
      leafPathParts: ['label'],
      isArrayItemPropUpdate: true,
      newValue: 'after',
    })

    assert.equal(harness.root.querySelector('.label')?.textContent, 'after')
  })
})

test('plugin transforms jsx entry files', async () => {
  const code = await transformWithPlugin(
    `
      import { Component } from 'gea'
      export default class JsxCounter extends Component {
        template() {
          return <div>Hello</div>
        }
      }
    `,
    '/virtual/JsxCounter.jsx',
  )

  assert.ok(code)
  assert.doesNotMatch(code, /return <div>/)
})

test('plugin transforms tsx entry files', async () => {
  const code = await transformWithPlugin(
    `
      import { Component } from 'gea'
      type Props = {}
      export default class TsxCounter extends Component {
        template(_props: Props) {
          return <div>Hello</div>
        }
      }
    `,
    '/virtual/TsxCounter.tsx',
  )

  assert.ok(code)
  assert.doesNotMatch(code, /return <div>/)
})

test('static reactivity subscribes imported array maps without plain text bindings', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoItems extends Component {
      template() {
        return (
          <ul>
            {store.todos.map(todo => (
              <li key={todo.id}>{todo.label}</li>
            ))}
          </ul>
        )
      }
    }
  `)

  assert.match(output, /render(?:__unresolved_0|Todos)Item/)
  assert.match(output, /store\.todos\.map/)
})

test('computed imported array maps subscribe to helper dependencies', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './grid-store'

    export default class FilteredItems extends Component {
      getVisibleItems() {
        return store.items.filter(item => item.visible)
      }

      template() {
        const visibleItems = this.getVisibleItems()
        return (
          <ul>
            {visibleItems.map(item => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        )
      }
    }
  `)

  assert.match(output, /const visibleItems = this\.getVisibleItems\(\)/)
  assert.match(output, /visibleItems\.map/)
})

test('conditional imported map state subscriptions include edit-mode flags', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoList extends Component {
      template() {
        return (
          <div>
            {store.todos.map(todo => (
              <div key={todo.id}>
                {store.editingId === todo.id ? (
                  <input value={store.editingValue} />
                ) : (
                  <span>{todo.text}</span>
                )}
              </div>
            ))}
          </div>
        )
      }
    }
  `)

  assert.match(output, /store\.editingId/)
  assert.match(output, /store\.editingValue/)
})

test('jsx map conditionals rerender rows instead of emitting raw jsx in observers', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoList extends Component {
      template() {
        return (
          <div>
            {store.todos.map(todo => (
              <div key={todo.id}>
                {store.editingId === todo.id ? (
                  <>
                    <input value={store.editingValue} />
                    <button click={() => store.updateTodo(todo)}>Save</button>
                  </>
                ) : (
                  <>
                    <span>{todo.text}</span>
                    <button click={() => store.startEditing(todo)}>Edit</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )
      }
    }
  `)

  assert.match(output, /render(?:__unresolved_0|Todos)Item/)
  assert.match(output, /store\.editingId/)
  assert.doesNotMatch(output, /render(?:__unresolved_0|Todos)Item[\s\S]*<>/)
})

test('identity-based imported map conditionals patch rows without rerender methods', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

    export default class TodoList extends Component {
      template() {
        return (
          <table>
            <tbody id="tbody">
              {store.todos.map(todo => (
                <tr key={todo.id} class={store.selectedId === todo.id ? 'danger' : ''}>
                  <td>{todo.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    }
  `)

  assert.match(output, /store\.selectedId === todo\.id/)
  assert.match(output, /data-gea-item-id/)
  assert.match(output, /class="\$\{\(store\.selectedId === todo\.id \? 'danger' : ''\)\.trim\(\)\}"/)
  assert.doesNotMatch(output, /render(?:__unresolved_0|Todos)Item[\s\S]*replaceWith/)
  assert.doesNotMatch(output, /__idMap/)
})

test('compiled output does not contain querySelector', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './todo-store'

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
          </div>
        )
      }
    }
  `)
  assert.doesNotMatch(output, /\.querySelector\s*\(/, 'compiled output must not use querySelector')
})

test('unresolved map container uses getElementById for tbody lookup', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './data-grid-store'

    export default class DataGrid extends Component {
      getDisplayData() {
        return store.data.filter(() => true)
      }
      template() {
        const displayData = this.getDisplayData()
        return (
          <div class="data-grid">
            <table>
              <tbody>
                {displayData.map(item => (
                  <tr key={item.id}><td>{item.id}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    }
  `)

  assert.ok(
    /<tbody[^>]*id=.*this\.id.*-b\d/.test(output) || /id=.*this\.id.*-b\d[^>]*>[\s\S]*<tbody/.test(output),
    'tbody must have id for getElementById',
  )
  assert.ok(
    /____unresolved_0_container.*getElementById|getElementById.*____unresolved_0_container/.test(output),
    'unresolved map container must use getElementById, not this.$(selector)',
  )
  assert.match(
    output,
    /\.join\s*\(\s*['"]['"]\s*\)/,
    'unresolved map must have .join("") to prevent Array.toString commas',
  )
})

test('unresolved helper maps reconcile by calling the helper, not helper-local variables', () => {
  const output = transformComponentSource(`
    import { Component } from 'gea'
    import store from './grid-store'

    export default class DataGrid extends Component {
      getDisplayData() {
        const filtered = store.data.filter(item => item.visible)
        const sortBy = store.sortBy
        return [...filtered].sort((a, b) => sortBy === 'id' ? a.id - b.id : 0)
      }

      template() {
        const displayData = this.getDisplayData()
        return (
          <table>
            <tbody>
              {displayData.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    }
  `)

  assert.match(output, /const displayData = this\.getDisplayData\(\)/)
  assert.doesNotMatch(output, /const displayData = \[\.\.\.filtered\]/)
})

test('store getter destructuring observes getter state deps when passed as child component props', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gea-getter-deps-'))

  try {
    const componentPath = join(dir, 'TodoApp.jsx')
    const storePath = join(dir, 'todo-store.ts')

    await writeFile(
      storePath,
      `import { Store } from 'gea'
export default class TodoStore extends Store {
  todos = [] as Array<{ id: number; text: string; done: boolean }>
  draft = ''
  filter = 'all' as 'all' | 'active' | 'completed'
  get activeCount(): number {
    return this.todos.filter(t => !t.done).length
  }
  get completedCount(): number {
    return this.todos.filter(t => t.done).length
  }
}`,
    )

    const output = await transformWithPlugin(
      `
        import { Component } from 'gea'
        import todoStore from './todo-store'
        import TodoFilters from './TodoFilters'

        export default class TodoApp extends Component {
          template() {
            const { filter } = todoStore
            const { activeCount, completedCount } = todoStore
            return (
              <div>
                <TodoFilters filter={filter} activeCount={activeCount} completedCount={completedCount} />
              </div>
            )
          }
        }
      `,
      componentPath,
    )

    assert.ok(output)
    assert.match(output, /observe\(\["filter"\]/, 'state property should observe specific path')
    assert.match(output, /observe\(\["todos"\]/, 'store getter should observe its actual state dependency')
    assert.doesNotMatch(output, /observe\(\["activeCount"\]/, 'should not observe getter name as path')
    assert.doesNotMatch(output, /observe\(\["completedCount"\]/, 'should not observe getter name as path')
    assert.doesNotMatch(output, /observe\(\[\]/, 'should not use root observer when getter deps are known')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('store getter observer refreshes child props instead of re-rendering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gea-getter-guard-'))

  try {
    const componentPath = join(dir, 'TodoApp.jsx')
    const storePath = join(dir, 'todo-store.ts')

    await writeFile(
      storePath,
      `import { Store } from 'gea'
export default class TodoStore extends Store {
  todos = [] as Array<{ id: number; done: boolean }>
  get activeCount(): number {
    return this.todos.filter(t => !t.done).length
  }
}`,
    )

    const output = await transformWithPlugin(
      `
        import { Component } from 'gea'
        import todoStore from './todo-store'
        import TodoFilters from './TodoFilters'

        export default class TodoApp extends Component {
          template() {
            const { activeCount } = todoStore
            return <div><TodoFilters count={activeCount} /></div>
          }
        }
      `,
      componentPath,
    )

    assert.ok(output)
    assert.match(output, /__observe_todoStore_todos/, 'todos observer method should be generated')
    const methodStart = output.indexOf('__observe_todoStore_todos')
    const methodSlice = output.slice(methodStart, methodStart + 300)
    assert.match(
      methodSlice,
      /__refreshChildProps_todoFilters/,
      'observer should call child prop refresh, not __geaRequestRender',
    )
    assert.doesNotMatch(methodSlice, /__geaRequestRender/, 'observer must not trigger a full re-render')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

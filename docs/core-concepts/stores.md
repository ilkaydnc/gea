# Stores

Stores are the state management layer of Gea. A store holds shared application state, exposes methods to mutate it, and notifies the framework when anything changes — all through a deep `Proxy` that intercepts every property access and mutation.

## Creating a Store

Extend `Store`, declare reactive properties as class fields, add mutation methods, and export a singleton instance.

```ts
import { Store } from 'gea'

class TodoStore extends Store {
  todos: Todo[] = []
  filter: 'all' | 'active' | 'completed' = 'all'
  draft = ''

  add(text?: string) {
    const t = (text ?? this.draft).trim()
    if (!t) return
    this.draft = ''
    this.todos.push({ id: uid(), text: t, done: false })
  }

  toggle(id: string) {
    const todo = this.todos.find(t => t.id === id)
    if (todo) todo.done = !todo.done
  }

  remove(id: string) {
    this.todos = this.todos.filter(t => t.id !== id)
  }

  setFilter(filter: 'all' | 'active' | 'completed') {
    this.filter = filter
  }
}

export default new TodoStore()
```

Always export a **singleton instance** (`export default new MyStore()`), not the class.

## Reactivity

The store instance is wrapped in a deep `Proxy`. Any mutation — direct assignment, nested property change, or array method call — is automatically tracked.

```ts
// All of these trigger reactive updates:
this.count++
this.user.name = 'Alice'
this.todos.push({ id: '1', text: 'New', done: false })
this.items.splice(2, 1)
this.items.sort((a, b) => a.order - b.order)
this.todos = this.todos.filter(t => !t.done)
```

Changes are batched via `queueMicrotask` — multiple synchronous mutations in the same method produce a single notification cycle. This means you can update several properties in one method and the DOM will be patched only once.

## Array Methods

These array methods on store properties are intercepted to produce fine-grained change events:

| Method | Change type |
| --- | --- |
| `push(...items)` | `append` |
| `pop()` | `delete` |
| `shift()` | `delete` |
| `unshift(...items)` | `add` (per item) |
| `splice(start, deleteCount, ...items)` | `delete` + `add` (or `append` when appending) |
| `sort(compareFn?)` | `reorder` with permutation |
| `reverse()` | `reorder` with permutation |

Replacing an array with a superset (same prefix + new items) is automatically detected as an efficient `append` operation.

Iterator methods (`map`, `filter`, `find`, `findIndex`, `forEach`, `some`, `every`, `reduce`, `indexOf`, `includes`) are also intercepted to provide proxied items with correct state paths.

## StoreChange

Each mutation produces a `StoreChange` object describing what happened:

```ts
interface StoreChange {
  type: 'add' | 'update' | 'delete' | 'append' | 'reorder' | 'swap'
  property: string
  target: any
  pathParts: string[]
  newValue?: any
  previousValue?: any
  start?: number        // for append
  count?: number        // for append
  permutation?: number[] // for reorder (sort/reverse)
  arrayIndex?: number   // for array item property updates
  otherIndex?: number   // for swap
}
```

## observe(path, handler)

Low-level observation API. The Vite plugin generates these calls automatically, but you can use them manually when needed.

```ts
const store = new CounterStore()

// Observe all changes
const unsubscribe = store.observe([], (value, changes) => {
  console.log('Store changed:', changes)
})

// Observe a specific path
store.observe('todos', (value, changes) => {
  console.log('Todos array changed:', value)
})

// Observe a nested path
store.observe('user.profile.name', (value, changes) => {
  console.log('User name changed to:', value)
})

// Stop observing
unsubscribe()
```

**Parameters:**

| Param | Type | Description |
| --- | --- | --- |
| `path` | `string \| string[]` | Dot-separated path or array of path parts. Empty string/array observes all changes. |
| `handler` | `(value, changes) => void` | Called with the current value at the path and the batch of changes. |

**Returns:** `() => void` — call to unsubscribe.

## Multiple Stores

Split state into domain-specific stores when different concerns are independent:

```
flight-store.ts    → navigation step, boarding pass
options-store.ts   → luggage, seat, meal selections
payment-store.ts   → payment form, completion status
```

Each store is an independent singleton. Stores can import and call each other:

```ts
import { Store } from 'gea'
import optionsStore from './options-store'
import paymentStore from './payment-store'

class FlightStore extends Store {
  step = 1
  boardingPass = null

  startOver() {
    this.step = 1
    this.boardingPass = null
    optionsStore.reset()
    paymentStore.reset()
  }
}

export default new FlightStore()
```

Keep a single store when the state is small and cohesive — like a simple counter or todo list.

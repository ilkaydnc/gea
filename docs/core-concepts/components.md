# Components

Gea has two component styles — class components and function components. Both compile to the same internal representation. The Vite plugin converts function components to class components at build time.

## Class Components

Extend `Component` and implement a `template()` method that returns JSX.

```jsx
import { Component } from 'gea'
import counterStore from './counter-store'

export default class Counter extends Component {
  template() {
    const { count } = counterStore
    return (
      <div class="counter">
        <span>{count}</span>
        <button click={counterStore.increment}>+</button>
        <button click={counterStore.decrement}>-</button>
      </div>
    )
  }
}
```

Use class components when you need:

- Local component state (reactive class fields)
- Lifecycle hooks (`created`, `onAfterRender`, `dispose`)
- Root/container components that read from stores

## Function Components

Export a default function that receives props and returns JSX.

```jsx
export default function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>
}
```

Use function components for:

- Stateless, presentational UI
- Components that receive all data and callbacks via props
- Leaf nodes in the component tree

## Component State

Class components inherit from `Store`, so they have their own reactive properties. This is separate from external stores and is used for transient UI concerns.

```jsx
export default class TodoItem extends Component {
  editing = false
  editText = ''

  startEditing() {
    if (this.editing) return
    this.editing = true
    this.editText = this.props.todo.text
  }

  commit() {
    this.editing = false
    const val = this.editText.trim()
    if (val && val !== this.props.todo.text) this.props.onRename(val)
  }

  template({ todo, onToggle, onRemove }) {
    const { editing, editText } = this
    return (
      <li class={`todo-item ${todo.done ? 'done' : ''} ${editing ? 'editing' : ''}`}>
        <input type="checkbox" checked={todo.done} change={onToggle} />
        <span dblclick={this.startEditing}>{todo.text}</span>
        <input
          class="todo-edit"
          type="text"
          value={editText}
          input={e => (this.editText = e.target.value)}
          blur={this.commit}
          keydown={e => { if (e.key === 'Enter') this.commit() }}
        />
        <button click={onRemove}>x</button>
      </li>
    )
  }
}
```

### When to Use Component State vs Store State

```
Is this state shared across components?
├── YES → Put it in a Store
└── NO
    Is it derived from other state?
    ├── YES → Use a getter on the Store
    └── NO
        Is it purely local UI feedback (editing, hover, animation)?
        ├── YES → Put it in component state
        └── NO → Probably a Store
```

**Store state examples:** todo items, user session, cart contents, form data that persists across views.

**Component state examples:** whether an item is in edit mode, tooltip visibility, text in an edit field before committing.

## Lifecycle

| Method | When called |
| --- | --- |
| `created(props)` | After constructor, before render. Override for initialization logic. |
| `onAfterRender()` | After the component's DOM element is inserted and child components are mounted. |
| `onAfterRenderAsync()` | Called in the next `requestAnimationFrame` after render. |
| `dispose()` | Removes the component from the DOM, cleans up observers and child components. |

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique component identifier (auto-generated) |
| `el` | `HTMLElement` | The root DOM element. Created lazily from `template()`. |
| `props` | `any` | Properties passed to the component |
| (reactive properties) | `any` | Reactive properties live directly on the instance (inherited from `Store`) |
| `rendered` | `boolean` | Whether the component has been rendered to the DOM |

## DOM Helpers

| Method | Description |
| --- | --- |
| `$(selector)` | First matching descendant element (scoped `querySelector`) |
| `$$(selector)` | All matching descendants as an array (scoped `querySelectorAll`) |

## Rendering

```ts
const app = new App()
app.render(document.getElementById('app'))
```

The `render(rootEl, index?)` method inserts the component's DOM element into the given parent. Components render once — subsequent state changes trigger surgical DOM patches, not full re-renders.

## Composing Components

A root component reads from stores and passes data down as props to children:

```jsx
import { Component } from 'gea'
import todoStore from './todo-store'

export default class App extends Component {
  template() {
    const { draft } = todoStore
    const todos = todoStore.filteredTodos

    return (
      <div class="todo-app">
        <TodoInput
          draft={draft}
          onDraftChange={e => (todoStore.draft = e.target.value)}
          onAdd={() => todoStore.add()}
        />
        <ul>
          {todos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => todoStore.toggle(todo.id)}
              onRemove={() => todoStore.remove(todo.id)}
            />
          ))}
        </ul>
      </div>
    )
  }
}
```

Pass callbacks as props from root components down to children rather than importing stores in every component.

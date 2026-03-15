<img src="https://raw.githubusercontent.com/dashersw/gea/master/docs/public/logo.jpg" height="180" alt="Gea" />

[![npm version](https://badge.fury.io/js/gea.svg)](https://www.npmjs.com/package/gea)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/dashersw/gea/blob/master/LICENSE)

# Gea

A lightweight, reactive JavaScript UI framework with compile-time JSX and proxy-based stores. No virtual DOM — the Vite plugin analyzes your JSX at build time and generates surgical DOM patches that update only what changed. ~10 kb gzipped, zero runtime dependencies.

## Philosophy

Gea's guiding principle is that JavaScript code should be simple and understandable. A framework should not invent new programming concepts or expect you to conform to arbitrary rules. You write regular, idiomatic JavaScript — classes with state and methods, functions that return markup, getters for derived values — and Gea makes it reactive under the hood.

There are no signals, no hooks, no dependency arrays, no compiler directives, and no framework-specific primitives. The only concept Gea introduces is the `Store` class, which is just an ordinary class whose properties happen to be observed by a proxy. Everything else — class inheritance, method calls, property access, `Array.map`, ternary expressions — is standard JavaScript you already know.

The "magic" lives entirely in the build step. The Vite plugin analyzes your code at compile time, figures out which DOM nodes depend on which state, and generates the wiring. At runtime, you get clean, readable, object-oriented code that just works.

## Performance

Gea is benchmarked with the [js-framework-benchmark](https://github.com/nicosommi/js-framework-benchmark) suite — the standard stress test for UI frameworks covering row creation, updates, swaps, selection, and deletion on large tables.

| Framework | Weighted geometric mean |
| --- | --- |
| vanillajs | 1.00 |
| Solid 1.9 | 1.10 |
| Svelte 5 | 1.12 |
| **Gea 1.0** | **1.17** |
| Vue 3.6 | 1.27 |
| React 19.2 | 1.48 |

Lower is better (1.00 = fastest). Gea delivers near-vanilla performance while requiring zero framework-specific concepts — no signals, no hooks, no compiler directives. It's the DX, not just the speed.

## Quick Start

```bash
npm create gea@latest my-app
cd my-app
npm install
npm run dev
```

Or add Gea to an existing Vite project:

```bash
npm install gea vite-plugin-gea
```

```js
// vite.config.ts
import { defineConfig } from 'vite'
import { geaPlugin } from 'vite-plugin-gea'

export default defineConfig({
  plugins: [geaPlugin()]
})
```

## Core Concepts

### Stores

A Store holds shared application state. Extend `Store`, declare reactive properties as class fields, add methods that mutate them, and export a singleton instance. The store instance is wrapped in a deep `Proxy` that tracks every mutation and batches notifications via `queueMicrotask`.

```ts
import { Store } from 'gea'

class CounterStore extends Store {
  count = 0

  increment() { this.count++ }
  decrement() { this.count-- }
}

export default new CounterStore()
```

Mutate state directly — the proxy handles reactivity automatically. Array methods (`push`, `pop`, `splice`, `sort`, `reverse`, `shift`, `unshift`) are intercepted to produce fine-grained change events like `append`, `reorder`, and `swap`.

### Class Components

Extend `Component` and implement a `template()` method that returns JSX. Class components inherit from `Store`, so they have their own reactive properties — use them when you need local, transient UI state that no other component cares about.

```jsx
import { Component } from 'gea'

export default class Counter extends Component {
  count = 0

  increment() { this.count++ }
  decrement() { this.count-- }

  template() {
    return (
      <div class="counter">
        <span>{this.count}</span>
        <button click={this.increment}>+</button>
        <button click={this.decrement}>-</button>
      </div>
    )
  }
}
```

Event handlers accept both method references (`click={this.increment}`) and arrow functions (`click={() => this.increment()}`). The compiler wires both forms to the component's event delegation system. Use method references for simple forwarding; use arrow functions when you need to pass arguments or compose logic.

Use class components when you need local state or lifecycle hooks.

### Function Components

Export a default function that receives props and returns JSX. The Vite plugin converts it to a class component at build time.

```jsx
export default function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>
}
```

Use function components for stateless, presentational UI.

### Computed Values

Use getters on stores for derived state. They re-evaluate on every access — the Vite plugin tracks which state paths the template reads and triggers updates when those paths change.

```ts
class TodoStore extends Store {
  todos = []
  filter = 'all'

  get filteredTodos() {
    const { todos, filter } = this
    if (filter === 'active') return todos.filter(t => !t.done)
    if (filter === 'completed') return todos.filter(t => t.done)
    return todos
  }

  get activeCount() {
    return this.todos.filter(t => !t.done).length
  }
}
```

## JSX Syntax

Gea JSX is close to HTML. Key differences from React:

| Feature | Gea | React |
| --- | --- | --- |
| CSS classes | `class="foo"` | `className="foo"` |
| Event handlers | `click={fn}` or `onClick={fn}` | `onClick={fn}` |
| Input events | `input={fn}` or `onInput={fn}` | `onChange={fn}` |
| Keyboard events | `keydown={fn}` or `onKeyDown={fn}` | `onKeyDown={fn}` |

Both native-style (`click`, `change`) and React-style (`onClick`, `onChange`) event attribute names are supported.

Supported event attributes: `click`, `dblclick`, `input`, `change`, `keydown`, `keyup`, `blur`, `focus`, `mousedown`, `mouseup`, `submit`, `dragstart`, `dragend`, `dragover`, `dragleave`, `drop`.

With `gea-mobile`: `tap`, `longTap`, `swipeRight`, `swipeUp`, `swipeLeft`, `swipeDown`.

### Conditional Rendering

```jsx
{step === 1 && <StepOne />}
{!done ? <Form /> : <Success />}
```

### List Rendering

```jsx
<ul>
  {todos.map(todo => (
    <TodoItem key={todo.id} todo={todo} onToggle={() => store.toggle(todo.id)} />
  ))}
</ul>
```

Always provide a `key` prop. Gea uses it for efficient list diffing — handling adds, deletes, reorders, and swaps without re-rendering the entire list.

## Lifecycle

| Method | When called |
| --- | --- |
| `created(props)` | After constructor, before render |
| `onAfterRender()` | After DOM insertion and child mounting |
| `onAfterRenderAsync()` | Next `requestAnimationFrame` after render |
| `dispose()` | Removes from DOM, cleans up observers and children |

## DOM Helpers

| Method | Description |
| --- | --- |
| `$(selector)` | First matching descendant (scoped `querySelector`) |
| `$$(selector)` | All matching descendants (scoped `querySelectorAll`) |

## Rendering

```ts
import App from './app'

const app = new App()
app.render(document.getElementById('app'))
```

Components render once. Subsequent state changes trigger surgical DOM patches — not full re-renders.

## Router

Gea includes a built-in client-side router for single-page applications.

### Quick Example

```jsx
import { Component, Link, RouterView } from 'gea'
import Home from './views/Home'
import About from './views/About'
import UserProfile from './views/UserProfile'

export default class App extends Component {
  template() {
    return (
      <div class="app">
        <nav>
          <Link to="/" label="Home" />
          <Link to="/about" label="About" />
          <Link to="/users/1" label="Alice" />
        </nav>
        <RouterView routes={[
          { path: '/', component: Home },
          { path: '/about', component: About },
          { path: '/users/:id', component: UserProfile },
        ]} />
      </div>
    )
  }
}
```

### Route Patterns

| Pattern | Example URL | Params |
| --- | --- | --- |
| `/about` | `/about` | `{}` |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/repo/:owner/*` | `/repo/dashersw/src/index.ts` | `{ owner: 'dashersw', '*': 'src/index.ts' }` |

### Components

- **`RouterView`** — renders the component matching the current URL. Accepts a `routes` array of `{ path, component }` objects. Supports both class and function components.
- **`Link`** — renders an `<a>` tag that navigates via `history.pushState` instead of a full page reload. Modifier keys (Cmd/Ctrl+click) open in a new tab as expected.

### Programmatic Navigation

```ts
import { router } from 'gea'

router.navigate('/about')          // push new entry
router.replace('/login')           // replace current entry
router.back()                      // history.back()
router.forward()                   // history.forward()

console.log(router.path)           // '/about'
console.log(router.query)          // { q: 'hello' } for ?q=hello
```

### Route Parameters in Components

Function components receive matched params as props:

```jsx
export default function UserProfile({ id }) {
  return <h1>User {id}</h1>
}
```

Class components receive them via `created(props)` and `template(props)`.

## Related Packages

- **[gea-mobile](https://www.npmjs.com/package/gea-mobile)** — Mobile UI primitives: views, navigation, gestures, sidebar, tabs, pull-to-refresh, infinite scroll.
- **[vite-plugin-gea](https://www.npmjs.com/package/vite-plugin-gea)** — Vite plugin that powers compile-time JSX transforms, reactivity wiring, and HMR.
- **[create-gea](https://www.npmjs.com/package/create-gea)** — Project scaffolder: `npm create gea@latest`.

## Documentation

Full documentation: [docs](https://github.com/dashersw/gea/tree/master/docs)

## AI-Assisted Development

This repository includes [agent skills](https://github.com/dashersw/gea/tree/master/.cursor/skills/gea-framework) that teach AI coding assistants how to work with Gea. If you use Cursor, Codex, or a similar AI-enabled editor, it will automatically pick up the skill files and understand Gea's stores, components, JSX conventions, and reactivity model — so you can scaffold and iterate on Gea apps with full AI assistance out of the box.

## License

[MIT](LICENSE) — Copyright (c) 2017-present Armagan Amcalar

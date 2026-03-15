---
name: gea-framework
description: Guide for building applications with Gea — a lightweight, reactive JavaScript UI framework with proxy-based stores, JSX components, and automatic DOM patching. Use when creating components, stores, or working with Gea's reactivity system.
---

# Gea Framework

Gea is a lightweight, reactive JavaScript UI framework built on the principle that JS code should be simple and understandable. It compiles JSX into efficient DOM operations at build time via a Vite plugin, uses proxy-based stores for state management, and employs event delegation for all user interactions. There is no virtual DOM — the Vite plugin analyzes your JSX templates and generates surgical DOM patches that update only the elements that depend on changed state.

Gea introduces no new programming concepts. There are no signals, no hooks, no dependency arrays, and no framework-specific primitives. Stores are classes with state and methods. Components are classes with a `template()` method or plain functions. Computed values are getters. The compile-time Vite plugin is the only "magic" — it analyzes ordinary JavaScript and wires up reactivity invisibly, so you write regular OOP/functional code that is fully reactive under the hood.

Read `reference.md` in this skill directory for the full API surface and detailed examples.

## Core Concepts

### Stores

A **Store** holds shared application state. Extend the `Store` class, declare reactive properties as class fields, and add methods that mutate them. The store instance is wrapped in a deep `Proxy` that tracks every property change and batches notifications via `queueMicrotask`.

```ts
import { Store } from 'gea'

class CounterStore extends Store {
  count = 0

  increment() {
    this.count++
  }
  decrement() {
    this.count--
  }
}

export default new CounterStore()
```

Key rules:

- Always export a **singleton instance** (`export default new MyStore()`), not the class.
- Mutate properties directly — `this.count++` triggers reactivity automatically.
- Use **getters** for derived/computed values — they re-evaluate on each access.
- Array mutations (`push`, `pop`, `splice`, `sort`, `reverse`, `shift`, `unshift`) are intercepted and produce fine-grained change events.
- Replacing an array with a superset (same prefix + new items) is detected as an efficient `append` operation.

### Components

Gea has two component styles. Both compile to the same internal representation.

#### Class Components

Extend `Component` and implement a `template(props)` method that returns JSX. Class components can hold their own reactive properties — use them when you need local, transient UI state.

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

Event handlers accept both method references (`click={this.increment}`) and arrow functions (`click={() => this.increment()}`). Use method references for simple forwarding; use arrow functions when passing arguments or composing logic.

Use class components when you need **local component state** or lifecycle hooks.

#### Function Components

Export a default function that receives props and returns JSX. The Vite plugin converts it to a class component internally.

```jsx
export default function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>
}
```

Use function components for **stateless, presentational UI**.

### Component State vs. Stores

| Concern                                         | Where it lives    | When to use                                                         |
| ----------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| Shared app data (todos, user, cart)             | Store             | Data accessed by multiple components or persisted across navigation |
| Derived / computed values                       | Store getters     | Values calculated from store state                                  |
| Local, transient UI state (editing mode, hover) | Component properties | Ephemeral state that no other component needs                       |

A class component can have **both** local state and read from external stores:

```jsx
export default class TodoItem extends Component {
  editing = false
  editText = ''

  template({ todo, onToggle, onRemove }) {
    const { editing, editText } = this
    return (
      <li class={`todo-item ${editing ? 'editing' : ''}`}>
        <span dblclick={this.startEditing}>{todo.text}</span>
        {/* ... */}
      </li>
    )
  }
}
```

### Multiple Stores

Split state into domain-specific stores. Each store is an independent singleton.

```
flight-store.ts    → step, boardingPass
options-store.ts   → luggage, seat, meal
payment-store.ts   → passengerName, cardNumber, paymentComplete
```

Stores can import and call each other:

```ts
class FlightStore extends Store {
  startOver(): void {
    this.step = 1
    optionsStore.reset()
    paymentStore.reset()
  }
}
```

A root component reads from all relevant stores and passes data down as props:

```jsx
export default class App extends Component {
  template() {
    const { step } = flightStore
    const { luggage } = optionsStore
    return <div>{step === 1 && <OptionStep selectedId={luggage} onSelect={id => optionsStore.setLuggage(id)} />}</div>
  }
}
```

## Router

Gea includes a built-in client-side router. The `router` singleton is a `Store` that tracks `path`, `hash`, and `search` from `window.location`. Use `RouterView` for declarative route rendering and `Link` for SPA navigation.

### RouterView

`RouterView` accepts a `routes` prop — an array of `{ path, component }` objects. It renders the first matching component. Both class and function components are supported.

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

- Static: `/about`
- Named params: `/users/:id` — extracted as `{ id: '42' }`
- Wildcard: `/files/*` — captures the rest as `{ '*': 'docs/readme.md' }`

### Link

Renders an `<a>` tag that navigates with `history.pushState`. Modifier keys (Cmd/Ctrl+click) open in a new tab.

```jsx
<Link to="/about" label="About" class="nav-link" />
```

### Programmatic Navigation

```ts
import { router } from 'gea'

router.navigate('/about')     // pushState
router.replace('/login')      // replaceState
router.back()
router.forward()
```

### Route Parameters

Function components receive matched params as props:

```jsx
export default function UserProfile({ id }) {
  return <h1>User {id}</h1>
}
```

Class components receive them via `created(props)` and `template(props)`.

### matchRoute Utility

Use `matchRoute` for manual route matching outside of `RouterView`:

```ts
import { matchRoute } from 'gea'

const result = matchRoute('/users/:id', '/users/42')
// { path: '/users/42', pattern: '/users/:id', params: { id: '42' } }
```

## JSX Rules

Gea JSX differs from React JSX in several ways:

| Feature            | Gea                                       | React                                           |
| ------------------ | ------------------------------------------- | ----------------------------------------------- |
| CSS classes        | `class="foo"`                               | `className="foo"`                               |
| Event handlers     | `click={fn}` or `onClick={fn}`               | `onClick={fn}`, `onInput={fn}`, `onChange={fn}` |
| Checked inputs     | `checked={bool}` + `change={fn}`            | `checked={bool}` + `onChange={fn}`              |
| Conditional render | `{cond && <Child />}`                       | Same                                            |
| Lists with keys    | `{arr.map(item => <Item key={item.id} />)}` | Same                                            |
| Dynamic classes    | ``class={`btn ${active ? 'on' : ''}`}``     | Same (with `className`)                         |

Both native-style (`click`, `change`) and React-style (`onClick`, `onChange`) event attribute names are supported. Native-style is preferred by convention.

Supported event attributes: `click`, `dblclick`, `input`, `change`, `keydown`, `keyup`, `blur`, `focus`, `mousedown`, `mouseup`, `submit`, `dragstart`, `dragend`, `dragover`, `dragleave`, `drop`.

With `gea-mobile`: `tap`, `longTap`, `swipeRight`, `swipeUp`, `swipeLeft`, `swipeDown`.

## Rendering

```js
import MyApp from './my-app.jsx'

const app = new MyApp()
app.render(document.getElementById('app'))
```

Components are instantiated with `new`, then `.render(parentEl)` inserts them into the DOM.

## Gea Mobile

The `gea-mobile` package extends Gea with mobile-oriented UI primitives:

- **View** — a full-screen `Component` that renders to `document.body` by default.
- **ViewManager** — manages a navigation stack with iOS-style transitions, back gestures, and sidebar support.
- **Sidebar**, **TabView**, **NavBar** — pre-built layout components.
- **PullToRefresh**, **InfiniteScroll** — scroll-driven UI patterns.
- **GestureHandler** — registers `tap`, `longTap`, `swipeRight`, `swipeLeft`, `swipeUp`, `swipeDown` events.

```js
import { View, ViewManager } from 'gea-mobile'

class HomeView extends View {
  template() {
    return (
      <view>
        <h1>Home</h1>
      </view>
    )
  }
  onActivation() {
    /* called when view enters viewport */
  }
}

const vm = new ViewManager()
const home = new HomeView()
vm.setCurrentView(home)
```

## Project Setup

### Scaffolding a New Project

```bash
npm create gea@latest my-app
cd my-app
npm install
npm run dev
```

The `create-gea` package scaffolds a Vite project with TypeScript, a sample store, class and function components, and the Vite plugin pre-configured.

### Manual Setup

```js
// vite.config.js
import { defineConfig } from 'vite'
import { geaPlugin } from 'vite-plugin-gea'

export default defineConfig({
  plugins: [geaPlugin()]
})
```

The `vite-plugin-gea` Vite plugin handles JSX transformation, reactivity wiring, event delegation generation, and HMR.

## npm Packages

| Package | npm | Description |
| --- | --- | --- |
| `gea` | [npm](https://www.npmjs.com/package/gea) | Core framework — stores, components, reactivity, DOM patching |
| `gea-mobile` | [npm](https://www.npmjs.com/package/gea-mobile) | Mobile UI primitives — views, navigation, gestures, layout |
| `vite-plugin-gea` | [npm](https://www.npmjs.com/package/vite-plugin-gea) | Vite plugin — JSX transform, reactivity wiring, HMR |
| `create-gea` | [npm](https://www.npmjs.com/package/create-gea) | Project scaffolder (`npm create gea@latest`) |
| `gea-syntax` | — | VS Code / Cursor extension for Gea JSX code intelligence |

## VS Code / Cursor Extension

The `gea-syntax` extension (in `packages/gea-vscode-extension`) provides:

- Component completion inside JSX tags
- Prop completion based on component signatures
- Event attribute completion (`click`, `input`, `change`, etc.)
- Hover details for components and props
- Unknown component warnings

## Documentation

Full documentation is in the `docs/` directory of the repository, structured for GitBook:

- Getting started, core concepts, Gea Mobile, tooling, and API reference
- Comparison pages: React vs Gea, Vue vs Gea

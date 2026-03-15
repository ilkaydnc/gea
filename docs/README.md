# Gea

A lightweight, reactive JavaScript UI framework.

Gea compiles JSX into efficient HTML string templates at build time, tracks state changes through deep proxies, and patches only the DOM nodes that depend on changed data. No virtual DOM, no diffing, no reconciliation overhead.

## Philosophy

JavaScript code should be simple and understandable. Gea doesn't introduce new programming concepts — no signals, no hooks, no dependency arrays, no compiler directives. You write regular, idiomatic JavaScript: classes with state and methods, functions that receive props and return markup, getters for computed values. The framework makes it reactive under the hood.

Gea strikes the right balance of object-oriented and functional style. Stores are classes. Components are classes or functions. Computed values are getters. Lists use `.map()`. Conditionals use `&&` and ternary. Everything is standard JavaScript that any developer can read and understand without learning a framework-specific vocabulary.

The "magic" is invisible and lives entirely in the build step. The Vite plugin analyzes your ordinary code at compile time, determines which DOM nodes depend on which state paths, and generates the reactive wiring. At runtime, there is nothing unfamiliar — just clean, readable code.

## Key Features

- **~10 kb gzipped** with zero runtime dependencies
- **Compile-time JSX** — the Vite plugin transforms JSX into HTML strings and generates targeted DOM patches
- **Proxy-based reactivity** — mutate state directly and the framework handles updates automatically
- **Class and function components** — use classes for stateful logic, functions for presentational UI
- **Event delegation** — a single global listener per event type, not per element
- **Mobile UI primitives** — optional `gea-mobile` package with views, navigation, gestures, and more

## Packages

| Package | Description |
| --- | --- |
| [`gea`](https://www.npmjs.com/package/gea) | Core framework — stores, components, reactivity, DOM patching |
| [`gea-mobile`](https://www.npmjs.com/package/gea-mobile) | Mobile UI primitives — views, navigation, gestures, layout |
| [`vite-plugin-gea`](https://www.npmjs.com/package/vite-plugin-gea) | Vite plugin — JSX transform, reactivity wiring, HMR |
| [`create-gea`](https://www.npmjs.com/package/create-gea) | Project scaffolder |
| [`gea-syntax`](https://github.com/dashersw/gea/tree/master/packages/gea-vscode-extension) | VS Code / Cursor extension |

## Quick Example

```jsx
import { Component } from 'gea'
import counterStore from './counter-store'

export default class Counter extends Component {
  template() {
    const { count } = counterStore
    return (
      <div>
        <span>{count}</span>
        <button click={counterStore.increment}>+</button>
      </div>
    )
  }
}
```

Read on to learn how to set up a project and build your first app.

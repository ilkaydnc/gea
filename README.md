<img src="https://raw.githubusercontent.com/dashersw/gea/master/docs/public/logo.jpg" height="180" alt="Gea" />

[![npm version](https://badge.fury.io/js/gea.svg)](https://www.npmjs.com/package/gea)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

# Gea

A lightweight, reactive JavaScript UI framework. No virtual DOM. Compile-time JSX transforms. Proxy-based stores. Surgical DOM patching. ~10 kb gzipped.

Gea compiles your JSX into efficient HTML string templates at build time, tracks state changes through deep proxies, and patches only the DOM nodes that actually depend on the changed data — no diffing, no reconciliation overhead.

```jsx
// counter-store.ts
import { Store } from 'gea'

class CounterStore extends Store {
  count = 0
  increment() { this.count++ }
  decrement() { this.count-- }
}

export default new CounterStore()
```

```jsx
// app.tsx
import { Component } from 'gea'
import counterStore from './counter-store'

export default class App extends Component {
  template() {
    return (
      <div>
        <h1>{counterStore.count}</h1>
        <button click={counterStore.increment}>+</button>
        <button click={counterStore.decrement}>-</button>
      </div>
    )
  }
}
```

```ts
// main.ts
import App from './app'

new App().render(document.getElementById('app'))
```

## Getting Started

```bash
npm create gea@latest my-app
cd my-app
npm install
npm run dev
```

This scaffolds a Vite-powered project with TypeScript, a sample store, class and function components, and hot module replacement — ready to build on.

## Packages

| Package | Description | Version |
| --- | --- | --- |
| [`gea`](packages/gea) | Core framework — stores, components, reactivity, DOM patching | [![npm](https://img.shields.io/npm/v/gea.svg)](https://www.npmjs.com/package/gea) |
| [`gea-mobile`](packages/gea-mobile) | Mobile UI primitives — views, navigation, gestures, layout | [![npm](https://img.shields.io/npm/v/gea-mobile.svg)](https://www.npmjs.com/package/gea-mobile) |
| [`vite-plugin-gea`](packages/vite-plugin-gea) | Vite plugin — JSX transform, reactivity wiring, HMR | [![npm](https://img.shields.io/npm/v/vite-plugin-gea.svg)](https://www.npmjs.com/package/vite-plugin-gea) |
| [`create-gea`](packages/create-gea) | Project scaffolder — `npm create gea@latest` | [![npm](https://img.shields.io/npm/v/create-gea.svg)](https://www.npmjs.com/package/create-gea) |
| [`gea-syntax`](packages/gea-vscode-extension) | VS Code / Cursor extension — completions, hover, diagnostics | — |

## Philosophy

JavaScript code should be simple and understandable. Gea is built on the belief that a framework should not force you to learn a new programming model. You shouldn't need signals, dependency arrays, compiler directives, or framework-specific primitives to build a reactive UI. You should write regular JavaScript — classes, functions, objects, getters — and it should just work.

Gea finds the right mix of object-oriented and functional style. Stores are classes with state and methods. Components are classes with a `template()` that returns JSX. Function components are true plain functions with **no side-effects**. Computed values are getters. There is nothing to learn that isn't already JavaScript.

The only "magic" is under the hood: the Vite plugin analyzes your ordinary code at compile time and wires up the reactivity for you. You write `this.count++` and the DOM updates. You don't call a setter, you don't wrap values in a signal, and you don't declare dependencies. The framework stays invisible.

Gea is built on the philosophy of the beautifully simple [erste.js](https://github.com/dashersw/erste) and [regie](https://github.com/dashersw/regie) libraries, carrying forward their core ideas — minimal abstraction, class-based components, and direct DOM ownership — while adding compile-time JSX transforms, deep proxy reactivity, and a modern build toolchain.

## Why Gea?

- **Just JavaScript.** No signals, no hooks, no dependency arrays, no new syntax. Classes, functions, objects, and getters — concepts you already know.
- **No virtual DOM.** The Vite plugin analyzes your JSX at build time and generates targeted DOM patches. Updates touch only the elements that changed.
- **Proxy-based reactivity.** Mutate state directly — `this.count++` — and the framework handles the rest. The compile-time analysis makes your regular JS fully reactive without you conforming to arbitrary rules.
- **Tiny footprint.** The core is ~10 kb gzipped with zero runtime dependencies.
- **Familiar JSX.** Write JSX with `class` instead of `className` and lowercase event attributes (`click`, `input`, `change`) instead of `onClick`.
- **Class and function components.** Use class components for stateful logic and lifecycle hooks, function components for presentational UI. The Vite plugin converts function components to classes at build time.
- **Built-in mobile UI.** The `gea-mobile` package provides view management, iOS-style navigation transitions, back gestures, sidebars, tabs, pull-to-refresh, and infinite scroll.

## How It Compares

Gea sits between hand-written vanilla JavaScript and full-featured frameworks like React and Vue. It gives you reactive state management, a component model, and JSX — without the weight of a virtual DOM or a large runtime.

| | Gea | React | Vue |
| --- | --- | --- | --- |
| Bundle size (min+gz) | ~10 kb | ~40 kb | ~33 kb |
| Virtual DOM | No | Yes | Yes |
| Reactivity | Proxy-based, automatic | Explicit (`setState`, hooks) | Proxy-based (`ref`/`reactive`) |
| JSX classes | `class` | `className` | `class` (templates) |
| Event syntax | `click={fn}` | `onClick={fn}` | `@click="fn"` (templates) |

See the full comparisons: [React vs Gea](docs/comparison/react-vs-gea.md) | [Vue vs Gea](docs/comparison/vue-vs-gea.md)

## Examples

| Example | Description |
| --- | --- |
| [flight-checkin](examples/flight-checkin) | Multi-step check-in flow with multiple stores, conditional views, and E2E tests |
| [todo](examples/todo) | Classic todo app demonstrating lists, filtering, and computed values |
| [router](examples/router) | Client-side routing with `RouterView`, `Link`, and dynamic params |
| [kanban](examples/kanban) | Kanban board with drag semantics |
| [mobile-showcase](examples/mobile-showcase) | Mobile UI showcase using `gea-mobile` components |

## Documentation

Full documentation is available in the [docs](docs/) directory, covering:

- [Getting Started](docs/getting-started.md)
- [Stores](docs/core-concepts/stores.md) and [Components](docs/core-concepts/components.md)
- [JSX Syntax](docs/core-concepts/jsx-syntax.md)
- [Router](docs/core-concepts/router.md)
- [Gea Mobile](docs/gea-mobile/overview.md)
- [API Reference](docs/api-reference.md)

## AI-Assisted Development

This repository includes [agent skills](.cursor/skills/gea-framework) that teach AI coding assistants how to work with Gea. If you use Cursor, Codex, or a similar AI-enabled editor, it will automatically pick up the skill files and understand Gea's stores, components, JSX conventions, and reactivity model — so you can scaffold and iterate on Gea apps with full AI assistance out of the box.

## Contributing

Contributions are welcome. The repo is a standard npm workspaces monorepo:

```bash
git clone https://github.com/dashersw/gea.git
cd gea
npm install
npm run build
```

Each package has its own `build` script. The root `npm run build` builds all packages.

## License

[MIT](LICENSE) — Copyright (c) 2017-present Armagan Amcalar

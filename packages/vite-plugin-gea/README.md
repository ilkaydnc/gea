# vite-plugin-gea

[![npm version](https://badge.fury.io/js/vite-plugin-gea.svg)](https://www.npmjs.com/package/vite-plugin-gea)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/dashersw/gea/blob/master/LICENSE)

Vite plugin that powers [Gea](https://www.npmjs.com/package/gea)'s compile-time JSX transforms, reactive binding generation, event delegation wiring, and hot module replacement.

## Installation

```bash
npm install -D vite-plugin-gea
```

Requires `vite` ^7.3.1 as a peer dependency.

## Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { geaPlugin } from 'vite-plugin-gea'

export default defineConfig({
  plugins: [geaPlugin()]
})
```

That's it. No configuration options are needed — the plugin handles everything automatically.

## What It Does

### JSX to HTML String Compilation

The plugin transforms JSX in your `.jsx` and `.tsx` files into HTML template strings at build time. This means there is no `createElement` call at runtime — templates compile down to plain strings that are inserted into the DOM.

- `className` is automatically converted to `class`
- React-style event names are converted to Gea's lowercase attributes (`onClick` becomes `click`)
- Component tags are converted to kebab-case custom elements with `data-prop-*` attributes

### Reactive Binding Generation

The plugin analyzes which state paths your template reads (e.g., `counterStore.count`) and generates `observe()` calls that surgically update only the DOM nodes that depend on changed state. No virtual DOM diffing required.

### Event Delegation Wiring

Event handlers declared in JSX (`click={fn}`, `input={fn}`, etc.) are compiled into an `events` getter that uses event delegation — a single global listener per event type on `document.body`, rather than individual listeners on each element.

### Function-to-Class Conversion

Function components are automatically converted to class components at build time. You write simple functions; the plugin handles the rest:

```jsx
// What you write
export default function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>
}

// What the plugin produces (conceptually)
class Greeting extends Component {
  template({ name }) {
    return `<h1>Hello, ${name}!</h1>`
  }
}
```

### Conditional and List Rendering

- Conditional expressions (`cond && <X />`) are compiled into `<template>` markers with efficient swap logic
- `.map()` calls with `key` props are compiled into `applyListChanges` calls that handle adds, deletes, reorders, and swaps without touching unchanged items

### Hot Module Replacement

The plugin injects HMR support that preserves component state across edits. When you save a file, only the changed components are updated — no full page reload.

### TypeScript Setup

When a `tsconfig.json` is present, the plugin automatically adds `gea-env.d.ts` to the `compilerOptions.types` array, providing JSX type definitions for Gea.

### Virtual Module

The plugin provides a `virtual:gea-reconcile` module used internally for keyed list reconciliation.

## Related Packages

- **[gea](https://www.npmjs.com/package/gea)** — Core framework
- **[gea-mobile](https://www.npmjs.com/package/gea-mobile)** — Mobile UI primitives
- **[create-gea](https://www.npmjs.com/package/create-gea)** — Project scaffolder

## License

[MIT](LICENSE) — Copyright (c) 2017-present Armagan Amcalar

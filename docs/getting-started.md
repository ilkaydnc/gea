# Getting Started

## Scaffold a New Project

The fastest way to start is with `create-gea`:

```bash
npm create gea@latest my-app
cd my-app
npm install
npm run dev
```

This gives you a Vite-powered project with TypeScript, a sample store, class and function components, and hot module replacement.

## Add to an Existing Vite Project

Install the core package and the Vite plugin:

```bash
npm install gea
npm install -D vite-plugin-gea
```

Add the plugin to your Vite config:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { geaPlugin } from 'vite-plugin-gea'

export default defineConfig({
  plugins: [geaPlugin()]
})
```

## Create a Store

Stores hold shared application state. Extend `Store`, declare reactive properties as class fields, add methods, and export a singleton instance.

```ts
// counter-store.ts
import { Store } from 'gea'

class CounterStore extends Store {
  count = 0

  increment() { this.count++ }
  decrement() { this.count-- }
}

export default new CounterStore()
```

## Create a Component

Components read from stores and return JSX from their `template()` method.

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

## Render to the DOM

```ts
// main.ts
import App from './app'

const app = new App()
app.render(document.getElementById('app'))
```

## HTML Entry Point

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Gea App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

## Next Steps

- Learn about [Stores](core-concepts/stores.md) and the reactivity system
- Explore [Components](core-concepts/components.md) — class and function styles
- Understand [JSX Syntax](core-concepts/jsx-syntax.md) differences from React
- Add client-side routing with the built-in [Router](core-concepts/router.md)
- Add mobile UI with [Gea Mobile](gea-mobile/overview.md)

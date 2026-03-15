# create-gea

[![npm version](https://badge.fury.io/js/create-gea.svg)](https://www.npmjs.com/package/create-gea)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/dashersw/gea/blob/master/LICENSE)

Scaffold a new [Gea](https://www.npmjs.com/package/gea) app with Vite in seconds.

## Usage

```bash
npm create gea@latest my-app
```

Or with other package managers:

```bash
pnpm create gea@latest my-app
yarn create gea@latest my-app
bun create gea@latest my-app
```

If you omit the project name, you'll be prompted for one (defaults to `gea-app`).

To scaffold into the current directory:

```bash
npm create gea@latest .
```

The target directory must be empty.

## What Gets Scaffolded

```
my-app/
  index.html              HTML entry point
  package.json            Dependencies: gea, vite, vite-plugin-gea, typescript
  vite.config.ts          Vite config with geaPlugin()
  tsconfig.json           TypeScript configuration
  .gitignore              Standard ignores
  src/
    main.ts               App bootstrap — creates and renders the root component
    app.tsx               Root class component composing CounterPanel and CounterNote
    counter-store.ts      Store with count state, increment/decrement methods
    counter-panel.tsx     Class component with +/- buttons
    counter-note.tsx      Function component displaying the count
    styles.css            Project styles
```

The template demonstrates:

- A **store** with reactive state and mutation methods
- A **class component** with JSX, store integration, and child components
- A **function component** receiving props
- The **Vite plugin** handling JSX transforms and HMR

## After Scaffolding

```bash
cd my-app
npm install
npm run dev
```

The scaffolder detects your package manager (npm, pnpm, yarn, or bun) and prints the correct commands.

## Related Packages

- **[gea](https://www.npmjs.com/package/gea)** — Core framework
- **[vite-plugin-gea](https://www.npmjs.com/package/vite-plugin-gea)** — Vite plugin
- **[gea-mobile](https://www.npmjs.com/package/gea-mobile)** — Mobile UI primitives

## License

[MIT](LICENSE) — Copyright (c) 2017-present Armagan Amcalar

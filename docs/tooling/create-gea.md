# create-gea

`create-gea` scaffolds a new Gea project with Vite, TypeScript, and a working counter example that demonstrates stores, class components, and function components.

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

If you omit the name, you'll be prompted (defaults to `gea-app`). Use `.` to scaffold into the current directory.

## Scaffolded Structure

```
my-app/
  index.html              HTML entry point
  package.json            gea, vite, vite-plugin-gea, typescript
  vite.config.ts          Vite config with geaPlugin()
  tsconfig.json           TypeScript configuration
  .gitignore              Standard ignores
  src/
    main.ts               Creates and renders the root component
    app.tsx               Root class component
    counter-store.ts      Store with count, increment, decrement
    counter-panel.tsx     Class component with buttons
    counter-note.tsx      Function component displaying count
    styles.css            Project styles
```

## What the Template Demonstrates

- **Store**: `counter-store.ts` — reactive state with typed interface and mutation methods
- **Class component**: `app.tsx` and `counter-panel.tsx` — `template()` returning JSX, reading from the store
- **Function component**: `counter-note.tsx` — receives `count` as a prop, returns JSX
- **Vite plugin**: `vite.config.ts` — minimal configuration, everything handled automatically
- **HMR**: edit any file and see changes reflected without a full page reload

## After Scaffolding

```bash
cd my-app
npm install
npm run dev
```

The scaffolder detects which package manager you used and prints the appropriate commands.

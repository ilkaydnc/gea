# VS Code Extension

The **Gea JSX Tools** extension (`gea-syntax`) provides code intelligence for Gea components in VS Code and Cursor.

## Features

- **Component completion** — type a JSX tag and get suggestions for discovered workspace components plus built-in Gea Mobile tags (`view`, `sidebar`, `tab-view`, `navbar`, `pull-to-refresh`, `infinite-scroll`)
- **Prop completion** — based on the target component's declared props (from `template()` parameter destructuring or function component parameters)
- **Event attribute completion** — suggests Gea event attributes like `click`, `input`, `change`, `keydown`, `blur`, `submit`, `dragstart`, `drop` (also accepts React-style `onClick`, `onChange`, etc.)
- **Hover details** — hover over components, props, or event attributes for documentation
- **Unknown component warnings** — flags JSX tags that look like Gea components but aren't imported
- **TypeScript plugin** — suppresses noisy JSX diagnostics and unused-import warnings for components used as JSX tags

## Installation

### From Source

1. Clone the Gea repository
2. Navigate to `packages/gea-vscode-extension`
3. Install dependencies: `npm install`
4. Compile: `npm run compile`
5. Open the folder in VS Code/Cursor and press `F5` to launch the Extension Development Host

### From Marketplace

Not yet published.

## Supported Languages

The extension activates for:

- JavaScript
- TypeScript
- JavaScript React (JSX)
- TypeScript React (TSX)

## Configuration

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gea.languageServer.enable` | `boolean` | `true` | Enable/disable Gea language server features |

## Architecture

- `src/client.ts` — starts the language client
- `src/server.ts` — provides completions, hover, and diagnostics
- `src/component-discovery.ts` — extracts component names and props from workspace files
- `ts-plugin/gea-template-plugin.js` — TypeScript server plugin for suppressing false-positive diagnostics

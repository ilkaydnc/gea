import { defineConfig } from 'tsdown'
import { geaPlugin } from '../vite-plugin-gea/index.ts'

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/lib/base/component.tsx',
      'src/lib/base/component-manager.ts',
      'src/lib/base/uid.ts',
      'src/lib/store.ts',
      'src/lib/router.ts',
      'src/lib/router/router-view.tsx',
      'src/lib/router/link.tsx',
    ],
    plugins: [geaPlugin() as any],
    format: 'esm',
    outDir: 'dist',
    sourcemap: true,
    dts: { build: true },
    target: 'es2020',
    platform: 'browser',
    define: {
      'import.meta.hot': 'undefined',
      'import.meta.url': '""',
    },
    hash: false,
    fixedExtension: true,
  },
  {
    entry: {
      gea: 'src/index.ts',
    },
    format: 'iife',
    globalName: 'gea',
    outDir: 'dist',
    clean: false,
    minify: true,
    sourcemap: true,
    target: 'es2020',
    platform: 'browser',
    define: {
      'import.meta.hot': 'undefined',
      'import.meta.url': '""',
    },
    hash: false,
    outputOptions: {
      exports: 'named',
      entryFileNames: '[name].js',
    },
  },
])

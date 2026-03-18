import { defineConfig } from 'tsdown'
import { geaPlugin } from '../vite-plugin-gea/index.ts'

export default defineConfig({
  entry: ['src/index.ts'],
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
})

import { defineConfig } from 'tsup'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tailwind-preset': 'src/tailwind-preset.ts',
  },
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  target: 'es2020',
  platform: 'browser',
  external: ['gea', /^@zag-js\//],
  onSuccess() {
    copyFileSync('src/styles/theme.css', 'dist/theme.css')
    console.log('Copied theme.css to dist/')
  },
})

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { geaPlugin } from '../../packages/vite-plugin-gea/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  plugins: [geaPlugin()],
  resolve: {
    alias: {
      gea: resolve(__dirname, '../../packages/gea/src'),
      'gea-router': resolve(__dirname, '../../packages/gea-router/src'),
    },
  },
  server: {
    port: 5186,
    open: true,
  },
})

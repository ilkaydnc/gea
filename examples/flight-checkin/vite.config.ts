import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { geaPlugin } from '../../packages/vite-plugin-gea/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [geaPlugin()],
  resolve: {
    alias: {
      gea: resolve(__dirname, '../../packages/gea/src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5182,
    open: true,
  },
})

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { geaPlugin } from '../../../../packages/vite-plugin-gea/index.ts'

export function createConfig(metaUrl: string, port: number) {
  const __dirname = dirname(fileURLToPath(metaUrl))
  return defineConfig({
    root: __dirname,
    plugins: [geaPlugin()],
    resolve: {
      alias: {
        gea: resolve(__dirname, '../../../../packages/gea/src'),
        'gea-ui': resolve(__dirname, '../../src'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      port,
      open: false,
    },
  })
}

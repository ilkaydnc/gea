const { defineConfig } = require('tsup')

module.exports = defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  target: 'es2017',
  platform: 'browser',
  external: ['gea'],
})

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, '..', 'dist', 'index.d.mts')
const content = readFileSync(distPath, 'utf-8')

const jsxDeclaration = `
declare global {
  namespace JSX {
    type Element = string
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}
`

// Append before the sourcemap comment if present, otherwise at the end
const sourcemapIndex = content.lastIndexOf('//# sourceMappingURL=')
const insertAt = sourcemapIndex >= 0 ? sourcemapIndex : content.length
const newContent = content.slice(0, insertAt) + jsxDeclaration + content.slice(insertAt)

writeFileSync(distPath, newContent)

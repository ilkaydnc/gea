import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(rootDir, 'src')
const distDir = join(rootDir, 'dist')
const componentsDir = join(srcDir, 'components')
const baseCssPath = join(srcDir, 'lib', 'base.css')
const outCssPath = join(distDir, 'gea-mobile.css')
const outMapPath = join(distDir, 'gea-mobile.css.map')

async function collectCssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectCssFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(fullPath)
    }
  }

  return files
}

const cssFiles = [baseCssPath, ...(await collectCssFiles(componentsDir))]
const cssSource = (
  await Promise.all(
    cssFiles.map(async (filePath) => {
      const contents = await readFile(filePath, 'utf8')
      return `/* ${relative(rootDir, filePath)} */\n${contents.trim()}`
    }),
  )
).join('\n\n')

const { code, map } = transform({
  filename: 'gea-mobile.css',
  code: Buffer.from(cssSource),
  minify: true,
  sourceMap: true,
  targets: {
    safari: 13 << 16,
    ios_saf: 13 << 16,
  },
})

await mkdir(distDir, { recursive: true })
await writeFile(outCssPath, `${code.toString()}\n/*# sourceMappingURL=gea-mobile.css.map */\n`)
await writeFile(outMapPath, map.toString())

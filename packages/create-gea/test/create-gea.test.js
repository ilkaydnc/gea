import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const fixtureDirs = []
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

after(() => {
  for (const dir of fixtureDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scaffolds a tiny Gea starter', () => {
  const targetDir = mkdtempSync(join(tmpdir(), 'create-gea-'))
  fixtureDirs.push(targetDir)

  execFileSync('node', [resolve(packageRoot, 'bin/create-gea.js'), targetDir], {
    cwd: packageRoot,
  })

  const packageJson = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
  const appSource = readFileSync(join(targetDir, 'src/app.tsx'), 'utf8')
  const storeSource = readFileSync(join(targetDir, 'src/counter-store.ts'), 'utf8')
  const classComponentSource = readFileSync(join(targetDir, 'src/counter-panel.tsx'), 'utf8')
  const functionComponentSource = readFileSync(join(targetDir, 'src/counter-note.tsx'), 'utf8')
  const gitignore = readFileSync(join(targetDir, '.gitignore'), 'utf8')

  assert.equal(packageJson.name.startsWith('create-gea-'), true)
  assert.equal(packageJson.devDependencies['vite-plugin-gea'], '^1.0.0')
  assert.match(appSource, /Hello from Gea/)
  assert.match(appSource, /CounterPanel/)
  assert.match(appSource, /CounterNote count=\{count\}/)
  assert.match(storeSource, /class CounterStore extends Store/)
  assert.match(classComponentSource, /class CounterPanel extends Component/)
  assert.match(functionComponentSource, /export default function CounterNote/)
  assert.match(functionComponentSource, /function CounterNote\(\{ count \}/)
  assert.match(gitignore, /node_modules/)
})

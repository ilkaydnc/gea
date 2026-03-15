#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templateDir = resolve(__dirname, '../template')

function printHelp() {
  console.log(`create-gea

Usage:
  npm create gea@latest [project-name]

Examples:
  npm create gea@latest my-gea-app
  npm create gea@latest .
`)
}

function isValidPackageName(value) {
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(value)
}

function toValidPackageName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]+/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
    .replace(/-+/g, '-')
}

function getPackageManager() {
  const userAgent = process.env.npm_config_user_agent ?? ''

  if (userAgent.startsWith('pnpm/')) return 'pnpm'
  if (userAgent.startsWith('yarn/')) return 'yarn'
  if (userAgent.startsWith('bun/')) return 'bun'
  return 'npm'
}

function isEmptyDir(dir) {
  return readdirSync(dir).length === 0
}

function writeTemplateFile(projectRoot, fileName, replacements) {
  const filePath = resolve(projectRoot, fileName)
  const source = readFileSync(filePath, 'utf8')

  let next = source
  for (const [from, to] of Object.entries(replacements)) {
    next = next.replaceAll(from, to)
  }

  writeFileSync(filePath, next)
}

async function getTargetDir(args) {
  const firstArg = args.find((arg) => !arg.startsWith('-'))
  if (firstArg) return firstArg

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question('Project name: ')
    return answer.trim() || 'gea-app'
  } finally {
    rl.close()
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  const targetDir = await getTargetDir(args)
  const projectRoot = resolve(process.cwd(), targetDir)

  if (existsSync(projectRoot) && !isEmptyDir(projectRoot)) {
    console.error(`Target directory is not empty: ${projectRoot}`)
    process.exit(1)
  }

  mkdirSync(projectRoot, { recursive: true })

  const rawName = targetDir === '.' ? basename(process.cwd()) : basename(projectRoot)
  const packageName = isValidPackageName(rawName) ? rawName : toValidPackageName(rawName)

  cpSync(templateDir, projectRoot, { recursive: true })

  const gitignoreSource = resolve(projectRoot, '_gitignore')
  if (existsSync(gitignoreSource)) {
    renameSync(gitignoreSource, resolve(projectRoot, '.gitignore'))
  }

  writeTemplateFile(projectRoot, 'package.json', {
    __PACKAGE_NAME__: packageName,
  })
  writeTemplateFile(projectRoot, 'index.html', {
    __PROJECT_TITLE__: packageName,
  })

  const packageManager = getPackageManager()
  const installCommand = packageManager === 'yarn' ? 'yarn' : `${packageManager} install`
  const devCommand = packageManager === 'yarn' ? 'yarn dev' : `${packageManager} run dev`

  console.log(`\nScaffolded an Gea app in ${projectRoot}\n`)
  console.log('Next steps:')
  if (targetDir !== '.') {
    console.log(`  cd ${targetDir}`)
  }
  console.log(`  ${installCommand}`)
  console.log(`  ${devCommand}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseSource } from './parse.ts'
import type { PathParts } from './ir.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

function resolveImportPath(importer: string, source: string): string | null {
  const base = resolve(dirname(importer), source)
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.js'),
    resolve(base, 'index.jsx'),
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const getterDepsCache = new Map<string, Map<string, PathParts[]>>()
const storeFieldsCache = new Map<string, Set<string>>()

function isPrivateName(name: string): boolean {
  return name.charCodeAt(0) === 95 || name.charCodeAt(name.length - 1) === 95
}

function extractGetterStatePaths(method: t.ClassMethod): PathParts[] | null {
  if (!t.isBlockStatement(method.body)) return null
  const paths = new Map<string, PathParts>()

  const program = t.program(method.body.body.map((stmt) => t.cloneNode(stmt, true) as t.Statement))
  traverse(program, {
    noScope: true,
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const node = path.node
      if (!t.isThisExpression(node.object) || !t.isIdentifier(node.property)) {
        return
      }
      const propName = node.property.name
      if (isPrivateName(propName)) return
      if (!paths.has(propName)) {
        paths.set(propName, [propName])
      }
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      if (!t.isObjectPattern(path.node.id) || !t.isThisExpression(path.node.init)) return
      for (const prop of path.node.id.properties) {
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue
        const propName = prop.key.name
        if (isPrivateName(propName)) continue
        if (!paths.has(propName)) {
          paths.set(propName, [propName])
        }
      }
    },
  })

  return paths.size > 0 ? Array.from(paths.values()) : null
}

function analyzeStoreFile(filePath: string): Map<string, PathParts[]> | null {
  const cached = getterDepsCache.get(filePath)
  if (cached) return cached

  if (!existsSync(filePath)) return null

  let source: string
  try {
    source = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const parsed = parseSource(source)
  if (!parsed?.ast) return null

  const result = new Map<string, PathParts[]>()

  traverse(parsed.ast, {
    ClassDeclaration(classPath: NodePath<t.ClassDeclaration>) {
      if (
        !classPath.node.superClass ||
        !t.isIdentifier(classPath.node.superClass) ||
        classPath.node.superClass.name !== 'Store'
      ) {
        return
      }
      for (const member of classPath.node.body.body) {
        if (!t.isClassMethod(member) || member.kind !== 'get' || !t.isIdentifier(member.key)) continue
        const deps = extractGetterStatePaths(member)
        if (deps) {
          result.set(member.key.name, deps)
        }
      }
    },
  })

  if (result.size > 0) {
    getterDepsCache.set(filePath, result)
  }

  return result.size > 0 ? result : null
}

function getStoreFields(filePath: string): Set<string> | null {
  const cached = storeFieldsCache.get(filePath)
  if (cached) return cached

  if (!existsSync(filePath)) return null

  let source: string
  try {
    source = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  const parsed = parseSource(source)
  if (!parsed?.ast) return null

  const fields = new Set<string>()

  traverse(parsed.ast, {
    ClassDeclaration(classPath: NodePath<t.ClassDeclaration>) {
      if (
        !classPath.node.superClass ||
        !t.isIdentifier(classPath.node.superClass) ||
        classPath.node.superClass.name !== 'Store'
      ) {
        return
      }
      for (const member of classPath.node.body.body) {
        if (t.isClassProperty(member) && t.isIdentifier(member.key) && member.value != null) {
          fields.add(member.key.name)
        }
      }
    },
  })

  if (fields.size > 0) {
    storeFieldsCache.set(filePath, fields)
  }

  return fields.size > 0 ? fields : null
}

export function analyzeStoreReactiveFields(
  sourceFile: string,
  storeImports: Map<string, string>,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  storeImports.forEach((importSource, localName) => {
    const resolved = resolveImportPath(sourceFile, importSource)
    if (!resolved) return
    const fields = getStoreFields(resolved)
    if (fields) result.set(localName, fields)
  })
  return result
}

/**
 * For each imported store, resolve the store file, parse it, and extract
 * getter dependencies (which `this.*` paths each getter accesses).
 */
export function analyzeStoreGetters(
  sourceFile: string,
  storeImports: Map<string, string>,
): Map<string, Map<string, PathParts[]>> {
  const result = new Map<string, Map<string, PathParts[]>>()

  storeImports.forEach((importSource, localName) => {
    const resolved = resolveImportPath(sourceFile, importSource)
    if (!resolved) return

    const getterDeps = analyzeStoreFile(resolved)
    if (getterDeps) {
      result.set(localName, getterDeps)
    }
  })

  return result
}

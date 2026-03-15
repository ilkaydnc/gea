import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import type { EventHandler } from './ir.ts'
import type { ChildComponent, ObserveDependency } from './ir.ts'
import { buildObserveKey, resolvePath } from './utils.ts'
import type { StateRefMeta } from './parse.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

export interface TemplateSetupContext {
  params: Array<t.Identifier | t.Pattern | t.RestElement>
  statements: t.Statement[]
}

export function buildComponentPropsExpression(
  jsxElement: t.JSXElement,
  imports: Map<string, string>,
  componentInstances: Map<string, ChildComponent[]>,
  eventHandlers: EventHandler[] | undefined,
  stateRefs: Map<string, string> | undefined,
  templateSetupContext: TemplateSetupContext | undefined,
  transformExpression: (expr: t.Expression) => t.Expression,
  transformFragment: (frag: t.JSXFragment) => t.TemplateLiteral,
): { expression: t.ObjectExpression; dependencies: ObserveDependency[]; setupStatements: t.Statement[] } {
  const props: t.ObjectProperty[] = []
  const dependencies = new Map<string, ObserveDependency>()

  jsxElement.openingElement.attributes.forEach((attr) => {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name) || attr.name.name === 'key') return
    const propName = attr.name.name
    let propValue: t.Expression | null = null

    if (attr.value === null) propValue = t.booleanLiteral(true)
    else if (t.isStringLiteral(attr.value)) propValue = t.stringLiteral(attr.value.value)
    else if (t.isJSXExpressionContainer(attr.value) && !t.isJSXEmptyExpression(attr.value.expression)) {
      const expr = attr.value.expression as t.Expression
      propValue = transformExpression(expr)
      if (propValue && /^on[A-Z]/.test(propName) && t.isMemberExpression(propValue)) {
        const argsId = t.identifier('args')
        propValue = t.arrowFunctionExpression(
          [t.restElement(argsId)],
          t.callExpression(t.cloneNode(propValue, true), [t.spreadElement(argsId)]),
        )
      }
    }

    if (propValue) props.push(t.objectProperty(t.identifier(propName), propValue))
  })

  const meaningfulChildren = jsxElement.children.filter((c) => !(t.isJSXText(c) && c.value.trim() === ''))
  if (meaningfulChildren.length > 0) {
    const frag = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), meaningfulChildren)
    props.push(t.objectProperty(t.identifier('children'), transformFragment(frag)))
  }

  const expression = t.objectExpression(props)
  const setupStatements = collectTemplateSetupStatements(expression, templateSetupContext)
  collectExpressionDependenciesInto(expression, stateRefs, dependencies, setupStatements)

  return { expression, dependencies: Array.from(dependencies.values()), setupStatements }
}

export function collectExpressionDependencies(
  expr: t.Expression,
  stateRefs: Map<string, StateRefMeta> | undefined,
  setupStatements: t.Statement[] = [],
): ObserveDependency[] {
  const dependencies = new Map<string, ObserveDependency>()
  collectExpressionDependenciesInto(expr, stateRefs, dependencies, setupStatements)
  return Array.from(dependencies.values())
}

function collectExpressionDependenciesInto(
  expr: t.Expression,
  stateRefs: Map<string, StateRefMeta> | undefined,
  dependencies: Map<string, ObserveDependency>,
  setupStatements: t.Statement[] = [],
) {
  if (!stateRefs) return

  const addDependency = (parts: string[], storeVar?: string) => {
    const observeKey = buildObserveKey(parts, storeVar)
    if (!dependencies.has(observeKey)) {
      dependencies.set(observeKey, {
        observeKey,
        pathParts: parts,
        storeVar,
      })
    }
  }

  const referencedNames = collectReferencedIdentifiers(expr)
  setupStatements.forEach((statement) => {
    if (!t.isVariableDeclaration(statement)) return
    statement.declarations.forEach((declaration) => {
      if (!t.isObjectPattern(declaration.id) || !declaration.init) return
      const resolved = resolvePath(declaration.init as t.MemberExpression | t.Identifier | t.ThisExpression, stateRefs)
      if (!resolved?.parts) return
      declaration.id.properties.forEach((property) => {
        if (!t.isObjectProperty(property)) return
        const keyName = t.isIdentifier(property.key)
          ? property.key.name
          : t.isStringLiteral(property.key)
            ? property.key.value
            : null
        if (!keyName) return

        const valueNames = collectPatternIdentifiers(property.value)
        if (!valueNames.some((name) => referencedNames.has(name))) return
        const isStoreInstanceDestructure =
          resolved.isImportedState && resolved.parts.length === 0 && t.isIdentifier(declaration.init)
        if (isStoreInstanceDestructure) {
          const storeRef = stateRefs.get(declaration.init.name)
          const getterStatePaths = storeRef?.getterDeps?.get(keyName)
          if (getterStatePaths && getterStatePaths.length > 0) {
            for (const dep of getterStatePaths) {
              addDependency(dep, resolved.storeVar)
            }
          } else if (storeRef?.reactiveFields?.has(keyName)) {
            addDependency([keyName], resolved.storeVar)
          } else {
            addDependency([], resolved.storeVar)
          }
        } else {
          addDependency([...resolved.parts, keyName], resolved.isImportedState ? resolved.storeVar : undefined)
        }
      })
    })
  })

  const program = t.program([
    ...setupStatements.map((statement) => t.cloneNode(statement, true) as t.Statement),
    t.expressionStatement(t.cloneNode(expr, true)),
  ])
  traverse(program, {
    noScope: true,
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const parent = path.parentPath
      if (parent && t.isMemberExpression(parent.node) && parent.node.object === path.node) return
      const resolved = resolvePath(path.node, stateRefs)
      if (!resolved?.parts?.length) return
      const parts =
        resolved.parts.length >= 2 && resolved.parts[resolved.parts.length - 1] === 'length'
          ? resolved.parts.slice(0, -1)
          : resolved.parts
      addDependency(parts, resolved.isImportedState ? resolved.storeVar : undefined)
    },
  })
}

export function collectTemplateSetupStatements(
  expr: t.Node,
  templateSetupContext: TemplateSetupContext | undefined,
): t.Statement[] {
  if (!templateSetupContext) return []

  const bindingMap = new Map<string, { statement: t.Statement; index: number }>()

  const firstParam = templateSetupContext.params[0]
  if (firstParam && !t.isRestElement(firstParam)) {
    const paramStatement = t.variableDeclaration('const', [
      t.variableDeclarator(
        t.cloneNode(firstParam, true),
        t.memberExpression(t.thisExpression(), t.identifier('props')),
      ),
    ])
    collectPatternIdentifiers(firstParam).forEach((name) => {
      bindingMap.set(name, { statement: paramStatement, index: -1 })
    })
  }

  templateSetupContext.statements.forEach((statement, index) => {
    collectStatementBindingNames(statement).forEach((name) => {
      bindingMap.set(name, { statement, index })
    })
  })

  const included = new Set<number>()
  const visiting = new Set<string>()
  const ordered: Array<{ index: number; statement: t.Statement }> = []
  const includedParamNames = new Set<string>()

  const includeName = (name: string) => {
    const binding = bindingMap.get(name)
    if (!binding || visiting.has(name)) return

    visiting.add(name)
    collectReferencedIdentifiers(binding.statement).forEach(includeName)
    visiting.delete(name)

    if (binding.index === -1) includedParamNames.add(name)

    if (!included.has(binding.index)) {
      included.add(binding.index)
      ordered.push({ index: binding.index, statement: t.cloneNode(binding.statement, true) as t.Statement })
    }
  }

  collectReferencedIdentifiers(expr).forEach(includeName)

  ordered.sort((a, b) => a.index - b.index)

  for (const entry of ordered) {
    if (entry.index !== -1) continue
    if (!t.isVariableDeclaration(entry.statement)) continue
    const decl = entry.statement.declarations[0]
    if (!t.isObjectPattern(decl.id)) continue
    decl.id.properties = decl.id.properties.filter((prop) => {
      if (t.isRestElement(prop)) return true
      if (t.isObjectProperty(prop)) {
        const keyName = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null
        return keyName ? includedParamNames.has(keyName) : true
      }
      return true
    })
  }

  return ordered.map((entry) => entry.statement)
}

function collectStatementBindingNames(statement: t.Statement): string[] {
  if (t.isVariableDeclaration(statement)) {
    return statement.declarations.flatMap((declaration) => collectPatternIdentifiers(declaration.id))
  }

  if (t.isFunctionDeclaration(statement) && statement.id) {
    return [statement.id.name]
  }

  if (t.isClassDeclaration(statement) && statement.id) {
    return [statement.id.name]
  }

  return []
}

function collectPatternIdentifiers(pattern: t.LVal): string[] {
  if (t.isIdentifier(pattern)) return [pattern.name]
  if (t.isRestElement(pattern)) return collectPatternIdentifiers(pattern.argument)
  if (t.isAssignmentPattern(pattern)) return collectPatternIdentifiers(pattern.left)
  if (t.isObjectPattern(pattern)) {
    return pattern.properties.flatMap((property) => {
      if (t.isRestElement(property)) return collectPatternIdentifiers(property.argument)
      return collectPatternIdentifiers(property.value)
    })
  }
  if (t.isArrayPattern(pattern)) {
    return pattern.elements.flatMap((element) => (element ? collectPatternIdentifiers(element) : []))
  }
  return []
}

function collectReferencedIdentifiers(node: t.Node): Set<string> {
  const names = new Set<string>()
  const program = t.program([
    t.isStatement(node) ? t.cloneNode(node, true) : t.expressionStatement(t.cloneNode(node, true)),
  ])

  traverse(program, {
    noScope: true,
    Identifier(path: NodePath<t.Identifier>) {
      if (!path.isReferencedIdentifier()) return
      names.add(path.node.name)
    },
  })

  return names
}

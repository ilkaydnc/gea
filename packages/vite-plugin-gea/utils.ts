import * as t from '@babel/types'
import { id, jsImport } from 'eszter'
import type { PathParts } from './ir.ts'
import type { StateRefMeta } from './parse.ts'
export function getJSXTagName(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string {
  if (t.isJSXIdentifier(name)) return name.name
  if (t.isJSXMemberExpression(name)) {
    return `${getJSXTagName(name.object)}.${name.property.name}`
  }
  return ''
}

export function isUpperCase(char: string): boolean {
  return char >= 'A' && char <= 'Z'
}

export function isComponentTag(tagName: string): boolean {
  return tagName.length > 0 && isUpperCase(tagName[0])
}

export function generateSelector(selectorPath: string[]): string {
  if (selectorPath.length === 0) return ':scope'
  return `:scope > ${selectorPath.join(' > ')}`
}

export function getDirectChildElements(
  children:
    | readonly t.JSXText[]
    | readonly (t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment)[],
) {
  const directChildren: t.JSXElement[] = []

  const pushChildren = (
    nodes: readonly (t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment)[],
  ) => {
    nodes.forEach((child) => {
      if (t.isJSXElement(child)) {
        directChildren.push(child)
      } else if (t.isJSXFragment(child)) {
        pushChildren(child.children)
      } else if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
        if (t.isJSXElement(child.expression)) {
          directChildren.push(child.expression)
        } else if (t.isJSXFragment(child.expression)) {
          pushChildren(child.expression.children)
        }
      }
    })
  }

  pushChildren(
    children as readonly (t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment)[],
  )

  const perTagCounts = new Map<string, number>()
  return directChildren.map((node) => {
    const tagName = getJSXTagName(node.openingElement.name) || 'div'
    const tagCount = (perTagCounts.get(tagName) || 0) + 1
    perTagCounts.set(tagName, tagCount)
    return {
      node,
      selectorSegment: `${tagName}:nth-of-type(${tagCount})`,
    }
  })
}

export function ensureImport(ast: t.File, source: string, specifier: string, isDefault = false): boolean {
  const program = ast.program

  const buildSpecifier = () =>
    isDefault
      ? t.importDefaultSpecifier(t.identifier(specifier))
      : t.importSpecifier(t.identifier(specifier), t.identifier(specifier))

  // For default imports, always use a separate declaration to avoid bundler confusion
  // (e.g. Vite misparsing mixed default+named as a named import)
  if (isDefault) {
    const alreadyHasDefault = program.body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        node.source.value === source &&
        node.specifiers.some((s) => t.isImportDefaultSpecifier(s)),
    )
    if (alreadyHasDefault) return false
    const insertIndex = Math.max(
      0,
      program.body.reduce((idx, node, i) => (t.isImportDeclaration(node) ? i + 1 : idx), 0),
    )
    program.body.splice(
      insertIndex,
      0,
      isDefault
        ? jsImport`import ${id(specifier)} from ${source};`
        : jsImport`import { ${id(specifier)} } from ${source};`,
    )
    return true
  }

  const declaration = program.body.find((node) => t.isImportDeclaration(node) && node.source.value === source) as
    | t.ImportDeclaration
    | undefined

  if (!declaration) {
    const insertIndex = Math.max(
      0,
      program.body.reduce((idx, node, i) => (t.isImportDeclaration(node) ? i + 1 : idx), 0),
    )
    program.body.splice(insertIndex, 0, jsImport`import { ${id(specifier)} } from ${source};`)
    return true
  }

  const exists = declaration.specifiers.some(
    (s) => t.isImportSpecifier(s) && t.isIdentifier(s.local) && s.local.name === specifier,
  )

  if (!exists) {
    declaration.specifiers.push(buildSpecifier())
    return true
  }

  return false
}

export function buildMemberChain(base: t.Expression, path: string): t.Expression {
  return buildMemberChainFromParts(base, path ? path.split('.') : [])
}

export function buildMemberChainFromParts(base: t.Expression, parts: PathParts): t.Expression {
  if (parts.length === 0) return base
  return parts.reduce<t.Expression>((acc, prop) => {
    const isIndex = /^\d+$/.test(prop)
    return t.memberExpression(acc, isIndex ? t.numericLiteral(Number(prop)) : t.identifier(prop), isIndex)
  }, base)
}

function sanitizeObserveName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_$]/g, '_')
}

export function normalizePathParts(path: string | PathParts): PathParts {
  return Array.isArray(path) ? path : path ? path.split('.') : []
}

export function pathPartsToString(parts: string | PathParts): string {
  return normalizePathParts(parts).join('.')
}

export function buildObserveKey(parts: string | PathParts, storeVar?: string): string {
  return JSON.stringify({ storeVar: storeVar || null, parts: normalizePathParts(parts) })
}

export function parseObserveKey(key: string): { parts: PathParts; storeVar?: string } {
  const parsed = JSON.parse(key) as { storeVar: string | null; parts: PathParts }
  return {
    parts: parsed.parts,
    ...(parsed.storeVar ? { storeVar: parsed.storeVar } : {}),
  }
}

export function getObserveMethodName(parts: string | PathParts, storeVar?: string): string {
  const owner = sanitizeObserveName(storeVar || 'local')
  const normalized = normalizePathParts(parts)
  const observePath = sanitizeObserveName(normalized.length > 0 ? normalized.join('__') : 'root')
  return `__observe_${owner}_${observePath}`
}

export function resolvePath(
  expr: t.MemberExpression | t.Identifier | t.ThisExpression,
  stateRefs: Map<string, StateRefMeta>,
  context: { inMap?: boolean; mapItemVar?: string } = {},
): { parts: PathParts | null; isImportedState?: boolean; storeVar?: string } | null {
  if (t.isIdentifier(expr)) {
    if (context.inMap && context.mapItemVar === expr.name) {
      return { parts: null }
    }
    if (stateRefs.has(expr.name)) {
      const ref = stateRefs.get(expr.name)!
      if (ref.kind === 'local-destructured' && ref.propName) {
        return { parts: [ref.propName] }
      }
      return {
        parts: [],
        isImportedState: ref.kind === 'imported',
        storeVar: ref.kind === 'imported' ? expr.name : undefined,
      }
    }
    return { parts: null }
  }

  if (t.isThisExpression(expr)) {
    return { parts: [] }
  }

  if (t.isMemberExpression(expr)) {
    const objectResult = resolvePath(
      expr.object as t.MemberExpression | t.Identifier | t.ThisExpression,
      stateRefs,
      context,
    )
    if (!objectResult || !objectResult.parts) {
      if (context.inMap && t.isIdentifier(expr.object) && expr.object.name === context.mapItemVar) {
        if (t.isIdentifier(expr.property)) {
          return { parts: [expr.property.name] }
        }
      }
      return { parts: null }
    }

    if (
      objectResult.isImportedState &&
      objectResult.storeVar &&
      objectResult.parts.length === 0 &&
      t.isIdentifier(expr.property)
    ) {
      const ref = stateRefs.get(objectResult.storeVar)
      const propName = expr.property.name
      if (ref?.reactiveFields) {
        if (ref.reactiveFields.has(propName)) {
          return { parts: [propName], isImportedState: true, storeVar: objectResult.storeVar }
        }
        return null
      }
      return { parts: [propName], isImportedState: true, storeVar: objectResult.storeVar }
    }

    if (t.isIdentifier(expr.property)) {
      return {
        parts: [...objectResult.parts, expr.property.name],
        isImportedState: objectResult.isImportedState,
        storeVar: objectResult.storeVar,
      }
    } else if (t.isNumericLiteral(expr.property)) {
      return {
        parts: [...objectResult.parts, String(expr.property.value)],
        isImportedState: objectResult.isImportedState,
        storeVar: objectResult.storeVar,
      }
    }
  }

  return { parts: null }
}

export function extractHandlerBody(handlerExpression: t.Expression, propNames?: Set<string>): t.Statement[] {
  if (t.isArrowFunctionExpression(handlerExpression)) {
    let body: t.Statement[]
    if (t.isBlockStatement(handlerExpression.body)) {
      body = handlerExpression.body.body
    } else {
      body = [t.expressionStatement(handlerExpression.body)]
    }
    return propNames?.size ? replacePropRefsInStatements(body, propNames) : body
  }
  if (t.isFunctionExpression(handlerExpression)) {
    const body = handlerExpression.body.body
    return propNames?.size ? replacePropRefsInStatements(body, propNames) : body
  }
  // Identifier handlers (e.g. click={onSelect}) must use this.props so the callback from parent is used
  const callee = t.isIdentifier(handlerExpression)
    ? t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('props')), t.cloneNode(handlerExpression))
    : handlerExpression
  return [t.expressionStatement(t.callExpression(callee, [t.identifier('e')]))]
}

/** Replace identifiers that are template params with this.props.X so handlers work at runtime. */
export function replacePropRefsInStatements(statements: t.Statement[], propNames: Set<string>): t.Statement[] {
  return statements.map((stmt) => replacePropRefsInNode(stmt, propNames) as t.Statement)
}

/**
 * After prop-ref rewriting, `const { X } = this.props` may become dead code
 * because all references to X in subsequent statements were rewritten to
 * `this.props.X`. Drop or trim the destructuring when its bindings are unused.
 *
 * @param additionalNodes - extra AST nodes (e.g. the rewritten expression) whose
 *   identifiers should also count as "referenced" when deciding whether to prune.
 */
export function pruneDeadParamDestructuring(statements: t.Statement[], additionalNodes?: t.Node[]): t.Statement[] {
  return statements.filter((stmt, i) => {
    if (!t.isVariableDeclaration(stmt)) return true
    const decl = stmt.declarations[0]
    if (!decl || !t.isObjectPattern(decl.id)) return true
    if (
      !t.isMemberExpression(decl.init) ||
      !t.isThisExpression(decl.init.object) ||
      !t.isIdentifier(decl.init.property, { name: 'props' })
    )
      return true

    const boundNames = new Set<string>()
    for (const prop of decl.id.properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) boundNames.add(prop.value.name)
      else if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) boundNames.add(prop.argument.name)
    }

    const referencedInRest = collectAllIdentifierNames(statements, i + 1, additionalNodes)

    const usedNames = [...boundNames].filter((n) => referencedInRest.has(n))
    if (usedNames.length === 0) return false

    decl.id.properties = decl.id.properties.filter((prop) => {
      if (t.isRestElement(prop)) return true
      if (t.isObjectProperty(prop)) {
        const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null
        return key ? referencedInRest.has(key) : true
      }
      return true
    })
    return decl.id.properties.length > 0
  })
}

function collectAllIdentifierNames(
  statements: t.Statement[],
  fromIndex: number,
  additionalNodes?: t.Node[],
): Set<string> {
  const names = new Set<string>()
  const walk = (node: t.Node | null | undefined): void => {
    if (!node || typeof node !== 'object' || !('type' in node)) return
    if (t.isIdentifier(node)) {
      names.add(node.name)
      return
    }
    if ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) && !node.computed) {
      walk(node.object)
      return
    }
    for (const key of t.VISITOR_KEYS[node.type] || []) {
      const child = (node as any)[key]
      if (Array.isArray(child)) {
        for (const c of child) if (c && typeof c === 'object' && 'type' in c) walk(c as t.Node)
      } else if (child && typeof child === 'object' && 'type' in child) {
        walk(child as t.Node)
      }
    }
  }
  for (let j = fromIndex; j < statements.length; j++) walk(statements[j])
  if (additionalNodes) for (const node of additionalNodes) walk(node)
  return names
}

export function pruneUnusedSetupDestructuring(setupStatements: t.Statement[], bodyNodes: t.Node[]): t.Statement[] {
  return setupStatements.filter((stmt, i) => {
    if (!t.isVariableDeclaration(stmt)) return true
    const decl = stmt.declarations[0]
    if (!decl) return true

    const usedNames = collectAllIdentifierNames(setupStatements, i + 1, bodyNodes)

    if (t.isObjectPattern(decl.id)) {
      decl.id.properties = decl.id.properties.filter((prop) => {
        if (t.isRestElement(prop)) return true
        if (t.isObjectProperty(prop)) {
          const valueName = t.isIdentifier(prop.value) ? prop.value.name : null
          return valueName ? usedNames.has(valueName) : true
        }
        return true
      })
      return decl.id.properties.length > 0
    }

    if (t.isIdentifier(decl.id)) {
      return usedNames.has(decl.id.name)
    }

    return true
  })
}

/** Replace prop refs in an expression (e.g. handler in props object). */
export function replacePropRefsInExpression(expr: t.Expression, propNames: Set<string>): t.Expression {
  return replacePropRefsInNode(expr, propNames) as t.Expression
}

function replacePropRefsInNode(node: t.Node, propNames: Set<string>): t.Node {
  if (t.isIdentifier(node) && propNames.has(node.name)) {
    return t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('props')), t.identifier(node.name))
  }
  if (t.isExpressionStatement(node)) {
    return t.expressionStatement(replacePropRefsInNode(node.expression, propNames) as t.Expression)
  }
  if (t.isBlockStatement(node)) {
    return t.blockStatement(node.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement))
  }
  if (t.isIfStatement(node)) {
    return t.ifStatement(
      replacePropRefsInNode(node.test, propNames) as t.Expression,
      replacePropRefsInNode(node.consequent, propNames) as t.Statement,
      node.alternate ? (replacePropRefsInNode(node.alternate, propNames) as t.Statement) : null,
    )
  }
  if (t.isReturnStatement(node)) {
    return t.returnStatement(node.argument ? (replacePropRefsInNode(node.argument, propNames) as t.Expression) : null)
  }
  if (t.isCallExpression(node)) {
    return t.callExpression(
      replacePropRefsInNode(node.callee, propNames) as t.Expression,
      node.arguments.map((a) => (t.isExpression(a) ? replacePropRefsInNode(a, propNames) : a) as t.Expression),
    )
  }
  if (t.isMemberExpression(node)) {
    return t.memberExpression(
      replacePropRefsInNode(node.object, propNames) as t.Expression,
      node.property,
      node.computed,
    )
  }
  if (t.isConditionalExpression(node)) {
    return t.conditionalExpression(
      replacePropRefsInNode(node.test, propNames) as t.Expression,
      replacePropRefsInNode(node.consequent, propNames) as t.Expression,
      replacePropRefsInNode(node.alternate, propNames) as t.Expression,
    )
  }
  if (t.isLogicalExpression(node)) {
    return t.logicalExpression(
      node.operator,
      replacePropRefsInNode(node.left, propNames) as t.Expression,
      replacePropRefsInNode(node.right, propNames) as t.Expression,
    )
  }
  if (t.isBinaryExpression(node)) {
    return t.binaryExpression(
      node.operator,
      replacePropRefsInNode(node.left, propNames) as t.Expression,
      replacePropRefsInNode(node.right, propNames) as t.Expression,
    )
  }
  if (t.isUnaryExpression(node)) {
    return t.unaryExpression(
      node.operator,
      replacePropRefsInNode(node.argument, propNames) as t.Expression,
      node.prefix,
    )
  }
  if (t.isSequenceExpression(node)) {
    return t.sequenceExpression(node.expressions.map((e) => replacePropRefsInNode(e, propNames) as t.Expression))
  }
  if (t.isAssignmentExpression(node)) {
    return t.assignmentExpression(
      node.operator,
      replacePropRefsInNode(node.left, propNames) as t.Expression,
      replacePropRefsInNode(node.right, propNames) as t.Expression,
    )
  }
  if (t.isVariableDeclaration(node)) {
    return t.variableDeclaration(
      node.kind,
      node.declarations.map((d) =>
        t.variableDeclarator(d.id, d.init ? (replacePropRefsInNode(d.init, propNames) as t.Expression) : null),
      ),
    )
  }
  if (t.isArrowFunctionExpression(node)) {
    const body = t.isBlockStatement(node.body)
      ? t.blockStatement(node.body.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement))
      : (replacePropRefsInNode(node.body, propNames) as t.Expression)
    return t.arrowFunctionExpression(node.params, body, node.async)
  }
  if (t.isFunctionExpression(node)) {
    const body = t.blockStatement(node.body.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement))
    return t.functionExpression(node.id, node.params, body, node.generator, node.async)
  }
  if (t.isTemplateLiteral(node)) {
    return t.templateLiteral(
      node.quasis,
      node.expressions.map((e) => replacePropRefsInNode(e, propNames) as t.Expression),
    )
  }
  if (t.isTaggedTemplateExpression(node)) {
    return t.taggedTemplateExpression(
      replacePropRefsInNode(node.tag, propNames) as t.Expression,
      replacePropRefsInNode(node.quasi, propNames) as t.TemplateLiteral,
    )
  }
  if (t.isArrayExpression(node)) {
    return t.arrayExpression(
      node.elements.map((e) =>
        e === null
          ? null
          : t.isSpreadElement(e)
            ? (replacePropRefsInNode(e, propNames) as t.SpreadElement)
            : (replacePropRefsInNode(e, propNames) as t.Expression),
      ),
    )
  }
  if (t.isObjectExpression(node)) {
    return t.objectExpression(
      node.properties.map((p) => {
        if (t.isSpreadElement(p)) return replacePropRefsInNode(p, propNames) as t.SpreadElement
        if (t.isObjectProperty(p))
          return t.objectProperty(
            p.computed ? (replacePropRefsInNode(p.key, propNames) as t.Expression) : p.key,
            replacePropRefsInNode(p.value, propNames) as t.Expression,
            p.computed,
            p.shorthand,
          )
        return p
      }),
    )
  }
  if (t.isSpreadElement(node)) {
    return t.spreadElement(replacePropRefsInNode(node.argument, propNames) as t.Expression)
  }
  if (t.isNewExpression(node)) {
    return t.newExpression(
      replacePropRefsInNode(node.callee, propNames) as t.Expression,
      node.arguments.map((a) => (t.isExpression(a) ? replacePropRefsInNode(a, propNames) : a) as t.Expression),
    )
  }
  if (t.isTryStatement(node)) {
    const block = t.blockStatement(node.block.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement))
    const handler = node.handler
      ? t.catchClause(
          node.handler.param,
          t.blockStatement(node.handler.body.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement)),
        )
      : null
    const finalizer = node.finalizer
      ? t.blockStatement(node.finalizer.body.map((s) => replacePropRefsInNode(s, propNames) as t.Statement))
      : null
    return t.tryStatement(block, handler, finalizer)
  }
  if (t.isThrowStatement(node)) {
    return t.throwStatement(replacePropRefsInNode(node.argument, propNames) as t.Expression)
  }
  return node
}

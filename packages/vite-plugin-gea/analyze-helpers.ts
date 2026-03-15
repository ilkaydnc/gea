import * as t from '@babel/types'
import type { PathParts, ReactiveBinding, TextExpression } from './ir.ts'
import { buildObserveKey, pathPartsToString, resolvePath } from './utils.ts'
import type { StateRefMeta } from './parse.ts'

export function resolvePropRef(
  expr: t.Expression | t.JSXEmptyExpression,
  propsParamName?: string,
  destructuredPropNames?: Set<string>,
): string | null {
  if (t.isIdentifier(expr) && destructuredPropNames?.has(expr.name)) return expr.name
  if (!t.isMemberExpression(expr) || !t.isIdentifier(expr.property)) return null
  const propName = expr.property.name
  if (
    t.isMemberExpression(expr.object) &&
    t.isIdentifier(expr.object.property) &&
    expr.object.property.name === 'props'
  ) {
    const obj = expr.object.object
    if (t.isThisExpression(obj)) return propName
    if (t.isIdentifier(obj) && obj.name === propsParamName) return propName
  }
  if (t.isIdentifier(expr.object) && expr.object.name === (propsParamName || 'props')) return propName
  return null
}

export function resolveExpr(expr: t.Expression | t.JSXEmptyExpression, stateRefs: Map<string, StateRefMeta>) {
  if (t.isMemberExpression(expr) && t.isCallExpression(expr.object) && t.isMemberExpression(expr.object.callee)) {
    return resolvePath(expr.object.callee.object as t.MemberExpression | t.Identifier, stateRefs)
  }
  if (t.isMemberExpression(expr) || t.isIdentifier(expr)) return resolvePath(expr, stateRefs)
  if (t.isCallExpression(expr) && t.isMemberExpression(expr.callee)) {
    return resolvePath(expr.callee.object as t.MemberExpression | t.Identifier, stateRefs)
  }
  return null
}

export function applyImportedState(
  binding: ReactiveBinding,
  result: { parts: PathParts | null; isImportedState?: boolean; storeVar?: string },
  stateProps: Map<string, PathParts>,
) {
  if (result.isImportedState && result.parts) {
    binding.isImportedState = true
    binding.storeVar = result.storeVar
    stateProps.set(buildObserveKey(result.parts, result.storeVar), [...result.parts])
  }
}

export function isComputedArrayProp(
  pathParts: PathParts,
  textExpressions: TextExpression[],
  stateRefs: Map<string, StateRefMeta>,
): boolean {
  const deps = new Set<string>()
  textExpressions.forEach((te) => {
    if (te.expression && t.isCallExpression(te.expression) && t.isMemberExpression(te.expression.callee)) {
      const r = resolvePath(te.expression.callee.object as t.MemberExpression | t.Identifier, stateRefs)
      if (r?.parts?.length) deps.add(r.parts[0]!)
    }
  })
  return pathParts.length > 0 && deps.has(pathParts[0]!)
}

export function addArrayTextBindings(
  selector: string,
  tagName: string,
  elementPath: string[],
  bindings: ReactiveBinding[],
  stateProps: Map<string, PathParts>,
  stateRefs: Map<string, StateRefMeta>,
  textTemplate: string,
  textExpressions: TextExpression[],
  result: { parts: PathParts | null; isImportedState?: boolean; storeVar?: string },
) {
  const deps = new Set<string>()
  textExpressions.forEach((te) => {
    if (te.pathParts.length > 0) deps.add(te.pathParts[0])
    if (te.expression && t.isCallExpression(te.expression) && t.isMemberExpression(te.expression.callee)) {
      const r = resolvePath(te.expression.callee.object as t.MemberExpression | t.Identifier, stateRefs)
      if (r?.parts?.length) deps.add(r.parts[0]!)
    }
  })

  deps.forEach((arrayPath) => {
    const existing = bindings.find((b) => pathPartsToString(b.pathParts) === arrayPath)
    if (!existing) {
      const isArr = result.parts?.[0] === arrayPath
      if (isArr) stateProps.set(buildObserveKey([arrayPath], result.storeVar), [arrayPath])
      bindings.push({
        pathParts: [arrayPath],
        type: 'text',
        selector,
        elementPath: [...elementPath],
        textTemplate,
        textExpressions,
        ...(isArr ? { isImportedState: true, storeVar: result.storeVar } : {}),
      })
    } else if (existing.type === 'text' && !existing.textTemplate) {
      existing.textTemplate = textTemplate
      existing.textExpressions = textExpressions
    }
  })
}

function unwrapJSX(expr: t.Expression): t.JSXElement | t.JSXFragment | undefined {
  if (t.isJSXElement(expr)) return expr
  if (t.isJSXFragment(expr)) return expr
  if (t.isParenthesizedExpression(expr) && t.isJSXElement(expr.expression)) return expr.expression
  if (t.isConditionalExpression(expr)) {
    const fromCons = unwrapJSX(expr.consequent)
    if (fromCons) return fromCons
    return unwrapJSX(expr.alternate)
  }
  return undefined
}

export function extractItemTemplate(arrowFn: t.ArrowFunctionExpression): t.JSXElement | t.JSXFragment | undefined {
  let body: t.Expression | undefined
  if (t.isJSXElement(arrowFn.body) || t.isJSXFragment(arrowFn.body)) body = arrowFn.body
  else if (t.isParenthesizedExpression(arrowFn.body)) body = arrowFn.body.expression
  else if (t.isBlockStatement(arrowFn.body)) {
    const returnStmt = arrowFn.body.body.find((s) => t.isReturnStatement(s)) as t.ReturnStatement | undefined
    body = returnStmt?.argument as t.Expression | undefined
  } else if (t.isConditionalExpression(arrowFn.body)) body = arrowFn.body
  return body ? unwrapJSX(body) : undefined
}

export function detectItemIdProperty(
  template: t.JSXElement | t.JSXFragment | undefined,
  itemVar: string,
): string | undefined {
  if (!template || !t.isJSXElement(template)) return undefined
  for (const attr of template.openingElement.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name) || attr.name.name !== 'key') continue
    if (!t.isJSXExpressionContainer(attr.value)) continue
    const keyExpr = attr.value.expression
    if (
      t.isMemberExpression(keyExpr) &&
      t.isIdentifier(keyExpr.object) &&
      keyExpr.object.name === itemVar &&
      t.isIdentifier(keyExpr.property)
    )
      return keyExpr.property.name
  }
  return undefined
}

export function hasExplicitItemKey(template: t.JSXElement | t.JSXFragment | undefined): boolean {
  if (!template || !t.isJSXElement(template)) return false
  return template.openingElement.attributes.some(
    (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'key',
  )
}

export function detectContainerSelector(node: t.JSXElement, tagName: string): string {
  for (const attr of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue
    if (attr.name.name === 'class' && t.isStringLiteral(attr.value)) return `.${attr.value.value.split(' ')[0]}`
    if (attr.name.name === 'id' && t.isStringLiteral(attr.value)) return `#${attr.value.value}`
  }
  return tagName
}

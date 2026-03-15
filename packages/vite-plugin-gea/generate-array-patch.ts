import * as t from '@babel/types'
import { appendToBody, id, js, jsMethod } from 'eszter'
import type { NodePath } from '@babel/traverse'
import type { ArrayMapBinding } from './ir.ts'
import { normalizePathParts, pathPartsToString } from './utils.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

interface PatchEntry {
  childPath: number[]
  type: 'text' | 'className' | 'attribute'
  expression: t.Expression
  attributeName?: string
}

interface PatchPlan {
  entries: PatchEntry[]
  requiresRerender: boolean
}

const EVENT_NAMES = new Set([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mouseover',
  'mouseout',
  'mousemove',
  'keydown',
  'keyup',
  'keypress',
  'focus',
  'blur',
  'input',
  'change',
  'submit',
  'scroll',
  'touchstart',
  'touchmove',
  'touchend',
  'tap',
  'longTap',
  'swipeRight',
  'swipeUp',
  'swipeLeft',
  'swipeDown',
  'dragstart',
  'dragend',
  'dragover',
  'dragleave',
  'drop',
])

export function generatePatchItemMethod(arrayMap: ArrayMapBinding): t.ClassMethod | null {
  void arrayMap
  return null
}

export function collectPatchEntries(arrayMap: ArrayMapBinding): PatchPlan {
  const cloned = t.cloneNode(arrayMap.itemTemplate!, true) as t.JSXElement | t.JSXFragment
  const tempFile = t.file(t.program([t.expressionStatement(cloned)]))

  traverse(tempFile, {
    Identifier(path: NodePath<t.Identifier>) {
      if (path.node.name === arrayMap.itemVariable) path.node.name = 'item'
    },
  })

  const modified = (tempFile.program.body[0] as t.ExpressionStatement).expression
  const entries: PatchEntry[] = []
  const requiresRerender = templateRequiresRerender(tempFile)
  if (t.isJSXElement(modified)) {
    walkJSXForPatch(modified, [], entries)
  }
  return { entries, requiresRerender }
}

function walkJSXForPatch(node: t.JSXElement, path: number[], entries: PatchEntry[]): void {
  for (const attr of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue
    const name = attr.name.name

    if (name === 'key' || EVENT_NAMES.has(name)) continue

    if (!t.isJSXExpressionContainer(attr.value) || t.isJSXEmptyExpression(attr.value.expression)) continue

    if (name === 'class' || name === 'className') {
      entries.push({
        childPath: [...path],
        type: 'className',
        expression: t.cloneNode(attr.value.expression as t.Expression, true),
      })
    } else if (name !== 'checked') {
      entries.push({
        childPath: [...path],
        type: 'attribute',
        expression: t.cloneNode(attr.value.expression as t.Expression, true),
        attributeName: name,
      })
    }
  }

  let hasElementChild = false
  const textParts: Array<{ raw: string } | { expr: t.Expression }> = []

  for (const child of node.children) {
    if (t.isJSXElement(child)) {
      hasElementChild = true
    } else if (t.isJSXFragment(child)) {
      hasElementChild = true
    } else if (t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)) {
      textParts.push({ expr: child.expression as t.Expression })
    } else if (t.isJSXText(child)) {
      const raw = child.value
      if (textParts.length > 0 && 'raw' in textParts[textParts.length - 1]) {
        ;(textParts[textParts.length - 1] as { raw: string }).raw += raw
      } else {
        textParts.push({ raw })
      }
    }
  }

  if (!hasElementChild && textParts.length > 0) {
    const hasExpr = textParts.some((p) => 'expr' in p)
    if (hasExpr) {
      const quasis: t.TemplateElement[] = []
      const expressions: t.Expression[] = []
      let currentRaw = ''
      for (const part of textParts) {
        if ('raw' in part) {
          currentRaw += part.raw
        } else {
          quasis.push(t.templateElement({ raw: currentRaw, cooked: currentRaw }, false))
          currentRaw = ''
          expressions.push(t.cloneNode(part.expr, true) as t.Expression)
        }
      }
      quasis.push(t.templateElement({ raw: currentRaw, cooked: currentRaw }, true))
      const templateExpr =
        expressions.length > 0 ? t.templateLiteral(quasis, expressions) : t.stringLiteral(quasis[0]?.value?.raw ?? '')
      entries.push({
        childPath: [...path],
        type: 'text',
        expression: templateExpr,
      })
    }
    return
  }

  let elementIndex = 0
  for (const child of node.children) {
    if (t.isJSXElement(child)) {
      walkJSXForPatch(child, [...path, elementIndex], entries)
      elementIndex++
    }
  }
}

export function generateCreateItemMethod(arrayMap: ArrayMapBinding): t.ClassMethod | null {
  if (!arrayMap.itemTemplate) return null
  const arrayPath = pathPartsToString(arrayMap.arrayPathParts || normalizePathParts((arrayMap as any).arrayPath || ''))
  const arrayName = arrayPath.replace(/\./g, '')
  const capName = arrayName.charAt(0).toUpperCase() + arrayName.slice(1)
  const methodName = `create${capName}Item`
  const renderMethodName = `render${capName}Item`
  const containerProp = `__${arrayPath.replace(/\./g, '_')}_container`
  const itemIdProperty = arrayMap.itemIdProperty || 'id'
  const { entries, requiresRerender } = collectPatchEntries(arrayMap)

  if (requiresRerender) {
    return appendToBody(
      jsMethod`${id(methodName)}(item) {}`,
      js`var __tw = this.${id(containerProp)}.cloneNode(false);`,
      js`__tw.innerHTML = this.${id(renderMethodName)}(item);`,
      js`var el = __tw.firstElementChild;`,
      t.returnStatement(t.identifier('el')),
    )
  }

  if (entries.length === 0) return null

  const cloneArgs: t.Expression[] = [
    t.memberExpression(t.thisExpression(), t.identifier(containerProp)),
    t.identifier('item'),
    t.arrowFunctionExpression(
      [t.identifier('__i')],
      t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(renderMethodName)), [t.identifier('__i')]),
    ),
  ]
  if (arrayMap.containerBindingId) {
    cloneArgs.push(t.stringLiteral(arrayMap.containerBindingId))
  } else {
    cloneArgs.push(t.identifier('undefined'))
  }
  if (itemIdProperty !== 'id') {
    cloneArgs.push(t.stringLiteral(itemIdProperty))
  } else {
    cloneArgs.push(t.identifier('undefined'))
  }

  const patchTuples = entries.map((entry) => {
    const pathExpr = t.arrayExpression(entry.childPath.map((idx) => t.numericLiteral(idx)))
    let typeStr: string
    switch (entry.type) {
      case 'className':
        typeStr = 'c'
        break
      case 'text':
        typeStr = 't'
        break
      case 'attribute':
        typeStr = entry.attributeName!
        break
    }
    return t.arrayExpression([pathExpr, t.stringLiteral(typeStr), entry.expression])
  })
  cloneArgs.push(t.arrayExpression(patchTuples))

  return appendToBody(
    jsMethod`${id(methodName)}(item) {}`,
    t.returnStatement(
      t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('__geaCloneItem')), cloneArgs),
    ),
  )
}

function templateRequiresRerender(file: t.File): boolean {
  let requiresRerender = false
  traverse(file, {
    noScope: true,
    ConditionalExpression(path: NodePath<t.ConditionalExpression>) {
      if (branchContainsJSX(path.node.consequent) || branchContainsJSX(path.node.alternate)) {
        requiresRerender = true
        path.stop()
      }
    },
  })
  return requiresRerender
}

function branchContainsJSX(expr: t.Expression): boolean {
  let containsJSX = false
  const program = t.program([t.expressionStatement(t.cloneNode(expr, true))])
  traverse(program, {
    noScope: true,
    JSXElement(path: NodePath<t.JSXElement>) {
      containsJSX = true
      path.stop()
    },
    JSXFragment(path: NodePath<t.JSXFragment>) {
      containsJSX = true
      path.stop()
    },
  })
  return containsJSX
}

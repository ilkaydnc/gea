import * as t from '@babel/types'
import { appendToBody, id, js, jsMethod } from 'eszter'
import type { NodePath } from '@babel/traverse'
import type { ChildComponent } from './ir.ts'
import { pruneUnusedSetupDestructuring } from './utils.ts'

export function childHasNoProps(child: ChildComponent): boolean {
  return t.isObjectExpression(child.propsExpression) && child.propsExpression.properties.length === 0
}
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

export interface DirectPropMapping {
  parentPropName: string
  childPropName: string
}

export function getDirectPropMappings(
  child: ChildComponent,
  templatePropNames: Set<string>,
): DirectPropMapping[] | null {
  if (!child.propsExpression || !t.isObjectExpression(child.propsExpression)) return null
  const mappings: DirectPropMapping[] = []
  for (const prop of child.propsExpression.properties) {
    if (!t.isObjectProperty(prop)) return null
    const childPropName = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null
    if (!childPropName) return null
    const value = prop.value
    if (!t.isIdentifier(value) || !templatePropNames.has(value.name)) return null
    mappings.push({ parentPropName: value.name, childPropName })
  }
  return mappings.length > 0 ? mappings : null
}

export function injectChildComponents(
  ast: t.File,
  componentInstances: Map<string, ChildComponent[]>,
  directForwardingChildren?: Set<string>,
): void {
  if (componentInstances.size === 0) return

  const childComponents = Array.from(componentInstances.values()).flat()
  const instanceStatements = buildInstanceStatements(childComponents)

  let injected = false
  traverse(ast, {
    ClassMethod(path: NodePath<t.ClassMethod>) {
      if (!t.isIdentifier(path.node.key) || path.node.key.name !== 'constructor') return
      const body = path.node.body.body
      body.push(...instanceStatements)
      injected = true
    },
  })

  if (!injected) {
    traverse(ast, {
      ClassDeclaration(path: NodePath<t.ClassDeclaration>) {
        if (!t.isIdentifier(path.node.superClass)) return
        const ctor = appendToBody(
          jsMethod`constructor(...args) {}`,
          t.expressionStatement(t.callExpression(t.super(), [t.spreadElement(t.identifier('args'))])),
          ...instanceStatements,
        )
        path.node.body.body.unshift(ctor)
      },
    })
  }

  traverse(ast, {
    ClassDeclaration(path: NodePath<t.ClassDeclaration>) {
      if (!t.isIdentifier(path.node.superClass)) return

      childComponents.forEach((child) => {
        const isDirect = directForwardingChildren?.has(child.instanceVar)
        const noProps = childHasNoProps(child)
        if (!isDirect && !noProps) {
          path.node.body.body.push(buildPropsBuilderMethod(child))
          path.node.body.body.push(buildRefreshMethod(child))
        }
        if (child.lazy) {
          path.node.body.body.push(buildEnsureMethod(child))
        }
      })
      ensureDisposeMethod(path.node.body, childComponents)
    },
  })
}

export function injectComponentRegistrations(ast: t.File, componentInstances: Map<string, string>): void {
  traverse(ast, {
    ClassMethod(path: NodePath<t.ClassMethod>) {
      if (!t.isIdentifier(path.node.key) || path.node.key.name !== 'template') return
      const registrations = Array.from(componentInstances.keys()).map((tagName) =>
        t.expressionStatement(
          t.callExpression(t.memberExpression(t.identifier('Component'), t.identifier('_register')), [
            t.identifier(tagName),
          ]),
        ),
      )
      path.node.body.body.splice(0, 0, ...registrations)
    },
  })
}

function buildInstanceStatements(instances: ChildComponent[]): t.ExpressionStatement[] {
  const stmts: t.ExpressionStatement[] = []
  instances.forEach((child) => {
    if (child.lazy) {
      stmts.push(js`this.${id(child.instanceVar)} = null;` as t.ExpressionStatement)
      return
    }

    let propsArg: t.Expression
    if (child.directMappings && child.directMappings.length > 0) {
      propsArg = t.objectExpression(
        child.directMappings.map((m) =>
          t.objectProperty(
            t.identifier(m.childPropName),
            t.memberExpression(
              t.memberExpression(t.thisExpression(), t.identifier('props')),
              t.identifier(m.parentPropName),
            ),
          ),
        ),
      )
    } else if (childHasNoProps(child)) {
      propsArg = t.objectExpression([])
    } else {
      propsArg = t.callExpression(
        t.memberExpression(t.thisExpression(), t.identifier(getPropsBuilderMethodName(child))),
        [],
      )
    }

    stmts.push(
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.thisExpression(), t.identifier(child.instanceVar)),
          t.newExpression(t.identifier(child.tagName), [
            t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('__reactiveProps')), [propsArg]),
          ]),
        ),
      ),
    )
    stmts.push(js`this.${id(child.instanceVar)}.parentComponent = this;` as t.ExpressionStatement)
    stmts.push(js`this.${id(child.instanceVar)}.__geaCompiledChild = true;` as t.ExpressionStatement)
  })
  return stmts
}

function getPropsBuilderMethodName(child: ChildComponent): string {
  return `__buildProps_${child.instanceVar.replace(/^_/, '')}`
}

function getEnsureChildMethodName(child: ChildComponent): string {
  return `__ensureChild_${child.instanceVar.replace(/^_/, '')}`
}

function buildPropsBuilderMethod(child: ChildComponent): t.ClassMethod {
  const setupStmts: t.Statement[] = (child.setupStatements || []).map(
    (statement) => t.cloneNode(statement, true) as t.Statement,
  )
  const returnStmt = t.returnStatement(t.cloneNode(child.propsExpression, true))
  const prunedSetup = pruneUnusedSetupDestructuring(setupStmts, [returnStmt])
  return appendToBody(jsMethod`${id(getPropsBuilderMethodName(child))}() {}`, ...prunedSetup, returnStmt)
}

function buildEnsureMethod(child: ChildComponent): t.ClassMethod {
  const propsArg: t.Expression = childHasNoProps(child)
    ? t.objectExpression([])
    : t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(getPropsBuilderMethodName(child))), [])

  return appendToBody(
    jsMethod`${id(getEnsureChildMethodName(child))}() {}`,
    t.ifStatement(
      t.unaryExpression('!', t.memberExpression(t.thisExpression(), t.identifier(child.instanceVar))),
      t.blockStatement([
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier(child.instanceVar)),
            t.newExpression(t.identifier(child.tagName), [
              t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('__reactiveProps')), [propsArg]),
            ]),
          ),
        ),
        js`this.${id(child.instanceVar)}.parentComponent = this;` as t.ExpressionStatement,
        js`this.${id(child.instanceVar)}.__geaCompiledChild = true;` as t.ExpressionStatement,
      ]),
    ),
    t.returnStatement(t.memberExpression(t.thisExpression(), t.identifier(child.instanceVar))),
  )
}

function buildRefreshMethod(child: ChildComponent): t.ClassMethod {
  const method = jsMethod`${id(`__refreshChildProps_${child.instanceVar.replace(/^_/, '')}`)}() {}`
  method.body.body.push(js`const child = this.${id(child.instanceVar)};` as t.VariableDeclaration)

  if (child.lazy) {
    method.body.body.push(
      t.ifStatement(t.unaryExpression('!', t.identifier('child')), t.blockStatement([t.returnStatement()])),
    )
  } else {
    method.body.body.push(
      t.ifStatement(t.unaryExpression('!', t.identifier('child')), t.blockStatement([t.returnStatement()])),
    )
  }

  method.body.body.push(
    js`child.__geaUpdateProps(this.${id(getPropsBuilderMethodName(child))}());` as t.ExpressionStatement,
  )

  return method
}

function ensureDisposeMethod(classBody: t.ClassBody, children: ChildComponent[]): void {
  const disposeCalls = children.map((child) => js`this.${id(child.instanceVar)}?.dispose?.();` as t.ExpressionStatement)

  const existingDispose = classBody.body.find(
    (member) => t.isClassMethod(member) && t.isIdentifier(member.key) && member.key.name === 'dispose',
  ) as t.ClassMethod | undefined

  if (existingDispose) {
    existingDispose.body.body.unshift(...disposeCalls)
    return
  }

  classBody.body.push(
    appendToBody(jsMethod`${id('dispose')}() {}`, ...disposeCalls, js`super.dispose();` as t.ExpressionStatement),
  )
}

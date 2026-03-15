import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import type { ClassMethod, ReturnStatement } from '@babel/types'
import type { ChildComponent, EventHandler } from './ir.ts'
import type { AnalysisResult } from './analyze.ts'
import { analyzeTemplate } from './analyze.ts'
import { collectStateReferences } from './parse.ts'
import {
  transformJSXToTemplate,
  transformJSXFragmentToTemplate,
  transformJSXExpression,
  collectComponentTags,
} from './transform-jsx.ts'
import { appendCompiledEventMethods } from './generate-events.ts'
import { injectChildComponents, injectComponentRegistrations, getDirectPropMappings } from './generate-components.ts'
import { pruneUnusedSetupDestructuring } from './utils.ts'
import type { DirectPropMapping } from './generate-components.ts'
import { applyStaticReactivity } from './apply-reactivity.ts'
import { analyzeStoreGetters, analyzeStoreReactiveFields } from './store-getter-analysis.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

export function transformComponentFile(
  ast: t.File,
  imports: Map<string, string>,
  storeImports: Map<string, string>,
  className: string,
  sourceFile: string,
  originalAST: t.File,
  compImportsUsedAsTags: Set<string>,
): boolean {
  let transformed = false
  const stateRefs = collectStateReferences(originalAST, storeImports)

  const storeGetterDeps = analyzeStoreGetters(sourceFile, storeImports)
  for (const [storeVar, getterMap] of storeGetterDeps) {
    const ref = stateRefs.get(storeVar)
    if (ref && ref.kind === 'imported') {
      ref.getterDeps = getterMap
    }
  }

  const storeReactiveFields = analyzeStoreReactiveFields(sourceFile, storeImports)
  for (const [storeVar, fields] of storeReactiveFields) {
    const ref = stateRefs.get(storeVar)
    if (ref && ref.kind === 'imported') {
      ref.reactiveFields = fields
    }
  }

  const compiledChildren: ChildComponent[] = []
  const eventIdCounter = { value: 0 }
  const preTransformAnalysis = new Map<string, AnalysisResult>()

  traverse(ast, {
    ClassMethod(path: NodePath<ClassMethod>) {
      if (!t.isIdentifier(path.node.key) || path.node.key.name !== 'template') return
      const body = path.node.body.body
      const retStmt = body.find((s): s is ReturnStatement => t.isReturnStatement(s) && s.argument !== null)
      if (!retStmt?.argument) return

      const instanceTags: string[] = []
      const allComponentTags = new Set<string>()
      if (t.isJSXElement(retStmt.argument))
        collectComponentTags(retStmt.argument, imports, instanceTags, allComponentTags)
      else if (t.isJSXFragment(retStmt.argument))
        collectComponentTags(retStmt.argument, imports, instanceTags, allComponentTags)

      const componentInstances = new Map<string, ChildComponent[]>()
      const tagCounts = new Map<string, number>()
      instanceTags.forEach((tag) => {
        const nextCount = (tagCounts.get(tag) || 0) + 1
        tagCounts.set(tag, nextCount)
        const instanceName =
          nextCount === 1
            ? `_${tag.charAt(0).toLowerCase() + tag.slice(1)}`
            : `_${tag.charAt(0).toLowerCase() + tag.slice(1)}${nextCount}`
        const instances = componentInstances.get(tag) || []
        instances.push({
          tagName: tag,
          instanceVar: instanceName,
          slotId: instanceName,
          propsExpression: t.objectExpression([]),
          dependencies: [],
        })
        componentInstances.set(tag, instances)
      })

      const allComponentInstances = new Map<string, string>()
      allComponentTags.forEach((tag) => {
        allComponentInstances.set(tag, tag.charAt(0).toLowerCase() + tag.slice(1))
        const src = imports.get(tag)
        if (src) compImportsUsedAsTags.add(src.startsWith('./') ? src : `./${src}`)
      })

      const eventHandlers: EventHandler[] = []
      const returnIndex = body.indexOf(retStmt)
      const classPath = path.findParent((p) => t.isClassDeclaration(p.node)) as NodePath<t.ClassDeclaration> | null
      const classBody = t.isClassBody(path.parent) ? path.parent : undefined
      const analysis = analyzeTemplate(path.node, stateRefs, classBody)
      if (classPath?.node.id && t.isIdentifier(classPath.node.id)) {
        preTransformAnalysis.set(classPath.node.id.name, analysis)
      }
      const conditionalSlotInfos = analysis.conditionalSlots.map((s) => ({ slotId: s.slotId }))
      const stateChildSlots: import('./transform-jsx').StateChildSlot[] = []
      const ctx = {
        imports,
        componentInstances,
        componentInstanceCursors: new Map<string, number>(),
        eventHandlers,
        eventIdCounter,
        stateRefs,
        elementPathToBindingId: analysis.elementPathToBindingId,
        templateSetupContext: {
          params: path.node.params,
          statements: returnIndex >= 0 ? body.slice(0, returnIndex) : [],
        },
        sourceFile,
        isRoot: true,
        conditionalSlots: conditionalSlotInfos,
        conditionalSlotCursor: { value: 0 },
        stateChildSlots,
        stateChildSlotCounter: { value: 0 },
      }

      if (t.isJSXElement(retStmt.argument)) {
        retStmt.argument = transformJSXToTemplate(retStmt.argument, ctx)
        transformed = true
      } else if (t.isJSXFragment(retStmt.argument)) {
        retStmt.argument = transformJSXFragmentToTemplate(retStmt.argument, ctx)
        transformed = true
      } else if (t.isExpression(retStmt.argument)) {
        retStmt.argument = transformJSXExpression(retStmt.argument, ctx)
        transformed = true
      }

      for (let i = 0; i < conditionalSlotInfos.length; i++) {
        if (analysis.conditionalSlots[i]) {
          analysis.conditionalSlots[i].truthyHtmlExpr = conditionalSlotInfos[i].truthyHtmlExpr
          analysis.conditionalSlots[i].falsyHtmlExpr = conditionalSlotInfos[i].falsyHtmlExpr
        }
      }

      if (stateChildSlots.length > 0) {
        analysis.stateChildSlots = stateChildSlots
      }

      if (eventHandlers.length > 0) {
        const classPath = path.findParent((p) => t.isClassDeclaration(p.node)) as NodePath<t.ClassDeclaration> | null
        if (classPath) {
          const setupStatements = returnIndex >= 0 ? body.slice(0, returnIndex) : []
          transformed = appendCompiledEventMethods(classPath.node.body, eventHandlers, setupStatements) || transformed
        }
      }

      if (componentInstances.size > 0) {
        const templateParamNames = new Set<string>()
        const firstParam = path.node.params[0]
        if (firstParam && t.isObjectPattern(firstParam)) {
          firstParam.properties.forEach((p) => {
            if (t.isObjectProperty(p) && t.isIdentifier(p.key)) templateParamNames.add(p.key.name)
          })
        }

        const directForwardingSet = new Set<string>()
        const directMappingsMap = new Map<string, DirectPropMapping[]>()
        for (const children of componentInstances.values()) {
          for (const child of children) {
            if (child.lazy) continue
            const mappings = getDirectPropMappings(child, templateParamNames)
            if (mappings) {
              directForwardingSet.add(child.instanceVar)
              directMappingsMap.set(child.instanceVar, mappings)
            }
          }
        }

        const allChildren = Array.from(componentInstances.values()).flat()
        for (const child of allChildren) {
          const mappings = directMappingsMap.get(child.instanceVar)
          if (mappings) child.directMappings = mappings
        }

        injectChildComponents(ast, componentInstances, directForwardingSet)
        compiledChildren.push(...allChildren)
        transformed = true
      }
      if (allComponentInstances.size > 0) {
        ensureComponentImport(ast, imports)
        injectComponentRegistrations(ast, allComponentInstances)
        transformed = true
      }

      if (transformed) {
        const currentReturnIndex = body.indexOf(retStmt)
        if (currentReturnIndex > 0) {
          const setupStmts = body.slice(0, currentReturnIndex)
          const prunedSetup = pruneUnusedSetupDestructuring(setupStmts, [retStmt])
          if (prunedSetup.length < setupStmts.length) {
            body.splice(0, currentReturnIndex, ...prunedSetup)
          }
        }
      }
    },
  })

  transformRemainingJSX(ast, imports)
  addJoinToMapCallsInTemplates(ast)

  transformed =
    applyStaticReactivity(
      ast,
      originalAST,
      className,
      sourceFile,
      imports,
      stateRefs,
      storeImports,
      compiledChildren,
      eventIdCounter,
      preTransformAnalysis,
    ) || transformed

  return transformed
}

export function transformNonComponentJSX(ast: t.File, imports: Map<string, string>): boolean {
  let transformed = false
  traverse(ast, {
    ClassMethod(path: NodePath<ClassMethod>) {
      if (!t.isIdentifier(path.node.key) || path.node.key.name !== 'template') return
      const retStmt = path.node.body.body.find(
        (s): s is ReturnStatement => t.isReturnStatement(s) && s.argument !== null,
      )
      if (!retStmt?.argument) return
      const ctx = { imports, isRoot: true }
      if (t.isJSXElement(retStmt.argument)) {
        retStmt.argument = transformJSXToTemplate(retStmt.argument, ctx)
        transformed = true
      } else if (t.isJSXFragment(retStmt.argument)) {
        retStmt.argument = transformJSXFragmentToTemplate(retStmt.argument, ctx)
        transformed = true
      } else if (t.isExpression(retStmt.argument)) {
        retStmt.argument = transformJSXExpression(retStmt.argument, ctx)
        transformed = true
      }
    },
  })
  transformRemainingJSX(ast, imports)
  return transformed
}

/** Add .join('') to .map() calls in template methods to prevent Array.toString() commas when interpolating in template literals. */
function addJoinToMapCallsInTemplates(ast: t.File): void {
  traverse(ast, {
    noScope: true,
    ClassMethod(path: NodePath<t.ClassMethod>) {
      if (!t.isIdentifier(path.node.key) || path.node.key.name !== 'template') return
      const templateMethod = path.node
      const tempProg = t.program([
        t.expressionStatement(t.arrowFunctionExpression(templateMethod.params as t.Identifier[], templateMethod.body)),
      ])
      traverse(tempProg, {
        noScope: true,
        CallExpression(callPath: NodePath<t.CallExpression>) {
          if (!t.isMemberExpression(callPath.node.callee)) return
          if (!t.isIdentifier(callPath.node.callee.property) || callPath.node.callee.property.name !== 'map') return
          if (!callPath.node.arguments[0] || !t.isArrowFunctionExpression(callPath.node.arguments[0])) return
          const alreadyHasJoin =
            callPath.parentPath?.isMemberExpression() &&
            t.isIdentifier(callPath.parentPath.node.property) &&
            callPath.parentPath.node.property.name === 'join' &&
            callPath.parentPath.parentPath?.isCallExpression()
          if (alreadyHasJoin) return
          callPath.replaceWith(
            t.callExpression(t.memberExpression(callPath.node, t.identifier('join')), [t.stringLiteral('')]),
          )
        },
      })
    },
  })
}

function ensureComponentImport(ast: t.File, imports: Map<string, string>): void {
  if (imports.has('Component')) return

  let geaImportPath: NodePath<t.ImportDeclaration> | null = null
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      if (path.node.source.value === 'gea') {
        geaImportPath = path
        path.stop()
      }
    },
  })

  if (geaImportPath) {
    ;(geaImportPath as NodePath<t.ImportDeclaration>).node.specifiers.push(
      t.importSpecifier(t.identifier('Component'), t.identifier('Component')),
    )
  } else {
    ast.program.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier('Component'), t.identifier('Component'))],
        t.stringLiteral('gea'),
      ),
    )
  }
  imports.set('Component', 'gea')
}

function transformRemainingJSX(ast: t.File, imports: Map<string, string>): void {
  traverse(ast, {
    noScope: true,
    JSXElement(path: NodePath<t.JSXElement>) {
      const parent = path.findParent((p) => t.isClassMethod(p.node))
      if (
        parent &&
        t.isClassMethod(parent.node) &&
        t.isIdentifier(parent.node.key) &&
        parent.node.key.name === 'template'
      )
        return
      try {
        path.replaceWith(transformJSXToTemplate(path.node, { imports }))
      } catch {
        // JSX transform may fail for non-standard syntax
      }
    },
    JSXFragment(path: NodePath<t.JSXFragment>) {
      const parent = path.findParent((p) => t.isClassMethod(p.node))
      if (
        parent &&
        t.isClassMethod(parent.node) &&
        t.isIdentifier(parent.node.key) &&
        parent.node.key.name === 'template'
      )
        return
      try {
        path.replaceWith(transformJSXFragmentToTemplate(path.node, { imports }))
      } catch {
        // Fragment transform may fail for non-standard syntax
      }
    },
  })
}

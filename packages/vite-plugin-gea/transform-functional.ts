import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import type { FunctionalComponentInfo } from './parse.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

/**
 * Converts a functional component (React-style) to an Gea class component.
 * Mutates the AST in place. Ensures Component is imported from 'gea'.
 */
export function convertFunctionalToClass(
  ast: t.File,
  info: FunctionalComponentInfo,
  imports: Map<string, string>,
): void {
  let params: t.Pattern[] = [t.identifier('props')]
  let templateBody: t.Statement[] = []
  let removeVarDeclPath: NodePath<t.VariableDeclaration> | null = null
  let exportPath: NodePath<t.ExportDefaultDeclaration> | null = null

  traverse(ast, {
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      exportPath = path
      const decl = path.node.declaration

      const extractFromFunction = (fn: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression) => {
        if (fn.params.length > 0) {
          params = fn.params.map((p) => t.cloneNode(p))
        }
        if (t.isBlockStatement(fn.body)) {
          const ret = fn.body.body.find((s) => t.isReturnStatement(s) && (s as t.ReturnStatement).argument)
          if (ret && t.isReturnStatement(ret) && ret.argument) {
            const retIdx = fn.body.body.indexOf(ret)
            templateBody = fn.body.body.slice(0, retIdx + 1).map((s) => t.cloneNode(s) as t.Statement)
          }
        } else {
          templateBody = [t.returnStatement(t.cloneNode(fn.body) as t.Expression)]
        }
      }

      if (t.isFunctionDeclaration(decl)) {
        extractFromFunction(decl)
      } else if (t.isArrowFunctionExpression(decl)) {
        extractFromFunction(decl)
      } else if (t.isIdentifier(decl)) {
        const binding = path.scope.getBinding(decl.name)
        const init = binding?.path?.isVariableDeclarator() ? (binding.path.node as t.VariableDeclarator).init : null
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          extractFromFunction(init)
          const varDeclPath = binding!.path.findParent((p) =>
            t.isVariableDeclaration(p.node),
          ) as NodePath<t.VariableDeclaration> | null
          if (varDeclPath) removeVarDeclPath = varDeclPath
        }
      }

      path.stop()
    },
  })

  if (templateBody.length === 0 || !exportPath) return

  const firstParam = params[0]
  const firstStatement = templateBody[0]
  if (
    params.length === 1 &&
    t.isIdentifier(firstParam) &&
    t.isVariableDeclaration(firstStatement) &&
    firstStatement.declarations.length === 1
  ) {
    const decl = firstStatement.declarations[0]
    if (decl && t.isObjectPattern(decl.id) && decl.init && t.isIdentifier(decl.init, { name: firstParam.name })) {
      params = [t.cloneNode(decl.id)]
      templateBody = templateBody.slice(1)
    }
  }

  ensureComponentImport(ast, imports)

  const templateMethod = t.classMethod('method', t.identifier('template'), params, t.blockStatement(templateBody))

  const classDecl = t.classDeclaration(
    t.identifier(info.name),
    t.identifier('Component'),
    t.classBody([templateMethod]),
  )

  if (removeVarDeclPath) {
    removeVarDeclPath.remove()
  }

  const program = ast.program
  const idx = program.body.indexOf(exportPath.node)
  if (idx >= 0) {
    program.body[idx] = t.exportDefaultDeclaration(classDecl)
  }
}

function ensureComponentImport(ast: t.File, imports: Map<string, string>): void {
  if (imports.get('Component')) return

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
    const spec = t.importSpecifier(t.identifier('Component'), t.identifier('Component'))
    geaImportPath.node.specifiers.push(spec)
    imports.set('Component', 'gea')
  } else {
    const importDecl = t.importDeclaration(
      [t.importSpecifier(t.identifier('Component'), t.identifier('Component'))],
      t.stringLiteral('gea'),
    )
    ast.program.body.unshift(importDecl)
    imports.set('Component', 'gea')
  }
}

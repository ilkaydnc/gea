/**
 * Generate __syncArraySlot_X for unresolved maps with component children.
 * Creates component instances with full props (including functions) instead of serializing to HTML.
 */
import * as t from '@babel/types'
import { id, jsBlockBody, jsExpr, jsMethod } from 'eszter'
import type { NodePath } from '@babel/traverse'
import type { UnresolvedMapInfo } from './ir.ts'
import { buildComponentPropsExpression } from './transform-attributes.ts'
import { getJSXTagName, isComponentTag, pruneUnusedSetupDestructuring } from './utils.ts'
import { replacePropRefsInExpression, replacePropRefsInStatements } from './utils.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const traverse = require('@babel/traverse').default

export function isUnresolvedMapWithComponentChild(
  um: UnresolvedMapInfo,
  imports: Map<string, string>,
): { componentTag: string } | null {
  const template = um.itemTemplate
  if (!template) return null
  const root = t.isJSXElement(template) ? template : t.isJSXFragment(template) ? null : null
  if (!root || !t.isJSXElement(root)) return null
  const tagName = getJSXTagName(root.openingElement.name)
  if (!tagName || !isComponentTag(tagName) || !imports.has(tagName)) return null
  return { componentTag: tagName }
}

function getArrayCapName(arrayPropName: string): string {
  return arrayPropName.charAt(0).toUpperCase() + arrayPropName.slice(1)
}

export function getComponentArrayItemsName(arrayPropName: string): string {
  return `_${arrayPropName}Items`
}

export function getComponentArrayBuildMethodName(arrayPropName: string): string {
  return `_build${getArrayCapName(arrayPropName)}Items`
}

export function getComponentArrayRefreshMethodName(arrayPropName: string): string {
  return `__refresh${getArrayCapName(arrayPropName)}Items`
}

export function generateComponentArrayMethods(
  um: UnresolvedMapInfo,
  arrayPropName: string,
  imports: Map<string, string>,
  propNames: Set<string>,
  _classBody: t.ClassBody,
  storeArrayAccess?: { storeVar: string; propName: string },
): t.ClassMethod[] {
  const comp = isUnresolvedMapWithComponentChild(um, imports)
  if (!comp) return []

  const itemTemplate = um.itemTemplate
  if (!itemTemplate || !t.isJSXElement(itemTemplate)) return []

  const transformExpr = (expr: t.Expression) => replacePropRefsInExpression(expr, propNames)
  const transformFrag = (_frag: t.JSXFragment) =>
    t.templateLiteral([t.templateElement({ raw: '', cooked: '' }, true)], [])

  const propsResult = buildComponentPropsExpression(
    itemTemplate,
    imports,
    new Map(),
    undefined,
    undefined,
    undefined,
    transformExpr,
    transformFrag,
  )

  const propsExpr = propsResult.expression
  const itemVar = um.itemVariable
  const needsRename = itemVar !== 'opt'
  let finalPropsExpr: t.ObjectExpression = propsExpr
  if (needsRename) {
    const cloned = t.cloneNode(propsExpr, true) as t.ObjectExpression
    traverse(cloned, {
      noScope: true,
      Identifier(path: NodePath<t.Identifier>) {
        if (path.node.name !== itemVar) return
        const parentNode = path.parentPath?.node
        if (parentNode && t.isObjectProperty(parentNode) && parentNode.key === path.node && !parentNode.computed) {
          return
        }
        path.node.name = 'opt'
      },
      MemberExpression(path: NodePath<t.MemberExpression>) {
        if (t.isIdentifier(path.node.object) && path.node.object.name === itemVar) {
          path.node.object = t.identifier('opt')
        }
      },
    })
    finalPropsExpr = cloned
  }

  const itemsName = getComponentArrayItemsName(arrayPropName)
  const buildMethodName = getComponentArrayBuildMethodName(arrayPropName)
  const refreshMethodName = getComponentArrayRefreshMethodName(arrayPropName)
  const mountMethodName = `__mount${getArrayCapName(arrayPropName)}Items`
  const containerName = `__${arrayPropName}ItemsContainer`
  const containerLookupExpr = um.containerBindingId
    ? t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('getElementById')), [
        t.binaryExpression(
          '+',
          t.memberExpression(t.thisExpression(), t.identifier('id')),
          t.stringLiteral(`-${um.containerBindingId}`),
        ),
      ])
    : (jsExpr`
        this.$(${um.containerSelector}) ||
        (this.element_ && this.element_.matches && this.element_.matches(${um.containerSelector})
          ? this.element_
          : null)
      ` as t.Expression)

  let arrAccessExpr: t.Expression
  let arrSetupStatements: t.Statement[] = []
  if (storeArrayAccess) {
    arrAccessExpr = t.memberExpression(t.identifier(storeArrayAccess.storeVar), t.identifier(storeArrayAccess.propName))
  } else if (um.computationExpr) {
    arrSetupStatements = um.computationSetupStatements
      ? replacePropRefsInStatements(
          um.computationSetupStatements.map((stmt) => t.cloneNode(stmt, true) as t.Statement),
          propNames,
        )
      : []
    arrAccessExpr = replacePropRefsInExpression(t.cloneNode(um.computationExpr, true), propNames)
  } else {
    arrAccessExpr = t.memberExpression(
      t.memberExpression(t.thisExpression(), t.identifier('props')),
      t.identifier(arrayPropName),
    )
  }

  arrSetupStatements = pruneUnusedSetupDestructuring(arrSetupStatements, [arrAccessExpr, finalPropsExpr])

  const itemPropsMethodName = `__itemProps_${arrayPropName}`
  const itemPropsCall = t.callExpression(t.memberExpression(t.thisExpression(), t.identifier(itemPropsMethodName)), [
    t.identifier('opt'),
  ])

  const itemPropsMethod = jsMethod`${id(itemPropsMethodName)}(opt) {}`
  itemPropsMethod.body.body.push(t.returnStatement(finalPropsExpr))

  const buildMethod = jsMethod`${id(buildMethodName)}() {}`
  buildMethod.body.body.push(
    ...arrSetupStatements,
    ...jsBlockBody`
       const arr = ${arrAccessExpr} ?? [];
       this.${id(itemsName)} = arr.map(opt => {
         const item = new ${id(comp.componentTag)}(this.__reactiveProps(${t.cloneNode(itemPropsCall, true)}));
         item.parentComponent = this;
         item.__geaCompiledChild = true;
         return item;
       });
     `,
  )

  const mountMethod = jsMethod`${id(mountMethodName)}() {}`
  mountMethod.body.body.push(
    ...jsBlockBody`
      if (!this.${id(containerName)}) {
        this.${id(containerName)} = ${containerLookupExpr};
      }
      if (!this.${id(containerName)}) return;
      this.${id(containerName)}.textContent = '';
      for (let i = 0; i < (this.${id(itemsName)}?.length ?? 0); i++) {
        const item = this.${id(itemsName)}[i];
        if (!item) continue;
        if (!this.__childComponents.includes(item)) {
          this.__childComponents.push(item);
        }
        item.render(this.${id(containerName)}, i);
      }
    `,
  )

  const refreshMethod = jsMethod`${id(refreshMethodName)}() {}`
  refreshMethod.body.body.push(
    ...arrSetupStatements.map((stmt) => t.cloneNode(stmt, true) as t.Statement),
    ...jsBlockBody`
       const arr = ${t.cloneNode(arrAccessExpr, true)} ?? [];
       const __old = this.${id(itemsName)} ?? [];
       const __oldLen = __old.length;
       const __newLen = arr.length;
       if (__oldLen !== __newLen) {
         if (__newLen > __oldLen) {
           for (let __k = 0; __k < __oldLen; __k++) {
             const opt = arr[__k];
             __old[__k].__geaUpdateProps(${t.cloneNode(itemPropsCall, true)});
           }
           if (!this.${id(containerName)} && this.rendered_) {
             this.${id(containerName)} = ${t.cloneNode(containerLookupExpr, true)};
           }
           for (let __k = __oldLen; __k < __newLen; __k++) {
             const opt = arr[__k];
             const __item = new ${id(comp.componentTag)}(this.__reactiveProps(${t.cloneNode(itemPropsCall, true)}));
             __item.parentComponent = this;
             __item.__geaCompiledChild = true;
             this.${id(itemsName)}.push(__item);
             if (!this.__childComponents.includes(__item)) {
               this.__childComponents.push(__item);
             }
             if (this.rendered_ && this.${id(containerName)}) {
               __item.render(this.${id(containerName)}, __k);
             }
           }
           return;
         }
         if (__newLen < __oldLen) {
           for (let __k = __newLen; __k < __oldLen; __k++) {
             __old[__k]?.dispose?.();
           }
           this.${id(itemsName)}.length = __newLen;
           this.__childComponents = (this.__childComponents || []).filter(
             child => !__old.slice(__newLen).includes(child)
           );
           for (let __k = 0; __k < __newLen; __k++) {
             const opt = arr[__k];
             this.${id(itemsName)}[__k].__geaUpdateProps(${t.cloneNode(itemPropsCall, true)});
           }
           return;
         }
       }
       for (let i = 0; i < arr.length; i++) {
         const opt = arr[i];
         this.${id(itemsName)}[i].__geaUpdateProps(${t.cloneNode(itemPropsCall, true)});
       }
     `,
  )

  return [itemPropsMethod, buildMethod, mountMethod, refreshMethod]
}

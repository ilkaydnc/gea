import * as t from '@babel/types'
import { id, jsMethod } from 'eszter'
import type { ReactiveBinding } from './ir.ts'
import { buildSimpleUpdate, buildWildcardUpdate } from './generate-observe-helpers.ts'
import type { StateRefMeta } from './parse.ts'
import { buildObserveKey, getObserveMethodName, normalizePathParts } from './utils.ts'

export function generateObserveHandler(
  binding: ReactiveBinding,
  stateRefs: Map<string, StateRefMeta>,
  methodName = getObserveMethodName(
    binding.pathParts || normalizePathParts((binding as any).path || ''),
    binding.storeVar,
  ),
): t.ClassMethod {
  const observePath = binding.pathParts || normalizePathParts((binding as any).path || '')
  const paramName = observePath[observePath.length - 1] || 'value'
  const param = t.identifier(paramName)
  const changeParam = t.identifier('change')

  const isWildcard = observePath.includes('*')
  const body = isWildcard
    ? buildWildcardUpdate(binding, param, stateRefs)
    : buildSimpleUpdate(binding, param, stateRefs)

  const method = jsMethod`${id(methodName)}(${param}, ${changeParam}) {}`
  method.body.body.push(...(Array.isArray(body) ? body : [body]))
  return method
}

export function mergeObserveHandlers(
  bindings: ReactiveBinding[],
  stateRefs: Map<string, StateRefMeta>,
): Map<string, t.ClassMethod> {
  const byPath = new Map<string, t.ClassMethod>()

  bindings.forEach((binding) => {
    const pathParts = binding.pathParts || normalizePathParts((binding as any).path || '')
    const observeKey = buildObserveKey(pathParts, binding.storeVar)
    const handler = generateObserveHandler(binding, stateRefs, getObserveMethodName(pathParts, binding.storeVar))

    if (!byPath.has(observeKey)) {
      byPath.set(observeKey, handler)
    } else {
      const existing = byPath.get(observeKey)!
      if (t.isBlockStatement(existing.body) && t.isBlockStatement(handler.body)) {
        existing.body.body.push(...handler.body.body)
      }
    }
  })

  return byPath
}

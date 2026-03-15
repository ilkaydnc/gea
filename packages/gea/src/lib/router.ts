import { Store } from './store'
import type Component from './base/component'

export interface RouteParams {
  [key: string]: string
}

export interface RouteMatch {
  path: string
  pattern: string
  params: RouteParams
}

export type RouteComponent = typeof Component | ((props: Record<string, string>) => string)

export interface RouteConfig {
  path: string
  component: RouteComponent
}

export function matchRoute(pattern: string, path: string): RouteMatch | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  const hasWildcard = patternParts.length > 0 && patternParts[patternParts.length - 1] === '*'
  if (hasWildcard) patternParts.pop()

  if (!hasWildcard && patternParts.length !== pathParts.length) return null
  if (hasWildcard && pathParts.length < patternParts.length) return null

  const params: RouteParams = {}

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]
    const pathPart = pathParts[i]

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(pathPart)
    } else if (pp !== pathPart) {
      return null
    }
  }

  if (hasWildcard) {
    params['*'] = pathParts.slice(patternParts.length).map(decodeURIComponent).join('/')
  }

  return { path, pattern, params }
}

export class Router extends Store {
  path = typeof window !== 'undefined' ? window.location.pathname : '/'
  hash = typeof window !== 'undefined' ? window.location.hash : ''
  search = typeof window !== 'undefined' ? window.location.search : ''

  constructor() {
    super()
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        this.path = window.location.pathname
        this.hash = window.location.hash
        this.search = window.location.search
      })
    }
  }

  navigate(path: string): void {
    if (typeof window === 'undefined') return
    window.history.pushState(null, '', path)
    this.syncFromUrl_(path)
  }

  replace(path: string): void {
    if (typeof window === 'undefined') return
    window.history.replaceState(null, '', path)
    this.syncFromUrl_(path)
  }

  back(): void {
    if (typeof window !== 'undefined') window.history.back()
  }

  forward(): void {
    if (typeof window !== 'undefined') window.history.forward()
  }

  get query(): Record<string, string> {
    const result: Record<string, string> = {}
    const searchParams = new URLSearchParams(this.search)
    searchParams.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  private syncFromUrl_(fullPath: string): void {
    const url = new URL(fullPath, window.location.origin)
    this.path = url.pathname
    this.hash = url.hash
    this.search = url.search
  }
}

export const router = new Router()

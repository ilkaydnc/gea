import { Router } from './router'
import Link from './link'
import Outlet from './outlet'
import RouterView from './router-view'
import type { RouteMap, RouterOptions } from './types'

export function createRouter<T extends RouteMap>(routes: T, options?: RouterOptions): Router<T> {
  return new Router<T>(routes, options)
}

const router = new Router()

export { router, Router }
export { Link }
export { Outlet }
export { RouterView }
export type {
  RouteMap,
  RouteEntry,
  RouteGroupConfig,
  RouterOptions,
  GuardFn,
  GuardResult,
  NavigationTarget,
  InferRouteProps,
} from './types'

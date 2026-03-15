export { default as Component } from './lib/base/component'
export { Store, isInternalProp } from './lib/store'
export { default as ComponentManager } from './lib/base/component-manager'
export { applyListChanges } from './lib/base/list'
export type { ListConfig } from './lib/base/list'
export { Router, router, matchRoute } from './lib/router'
export type { RouteComponent, RouteConfig, RouteMatch, RouteParams } from './lib/router'
export { default as RouterView } from './lib/router/router-view'
export { default as Link } from './lib/router/link'

import Component from './lib/base/component'
import { applyListChanges } from './lib/base/list'
import { Store } from './lib/store'

const gea = {
  Store,
  Component,
  applyListChanges,
}

export default gea

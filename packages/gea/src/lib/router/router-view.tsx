import Component from '../base/component'
import ComponentManager from '../base/component-manager'
import { router, matchRoute } from '../router'
import type { RouteConfig } from '../router'

export default class RouterView extends Component {
  private currentChild_: Component | null = null
  private currentPattern_: string | null = null
  private currentPath_: string | null = null
  private currentFnEl_: HTMLElement | null = null
  private observerRemover_: (() => void) | null = null

  created(props: { routes: RouteConfig[] }) {
    this.observerRemover_ = router.observe('path', () => {
      this.updateView_()
    })
  }

  template(props: { routes: RouteConfig[] }) {
    return <div></div>
  }

  onAfterRender() {
    this.updateView_()
  }

  private isClassComponent_(comp: any): comp is typeof Component {
    let proto = comp.prototype
    while (proto) {
      if (proto === Component.prototype) return true
      proto = Object.getPrototypeOf(proto)
    }
    return false
  }

  private clearCurrent_(): void {
    if (this.currentChild_) {
      this.currentChild_.dispose()
      this.currentChild_ = null
      this.__childComponents = []
    }
    if (this.currentFnEl_) {
      this.currentFnEl_.remove()
      this.currentFnEl_ = null
    }
    this.currentPattern_ = null
    this.currentPath_ = null
  }

  private updateView_(): void {
    if (!this.el) return

    const routes: RouteConfig[] = this.props.routes
    if (!routes) return

    const currentPath = router.path

    if (currentPath === this.currentPath_) return

    let matched: { component: any; params: Record<string, string>; pattern: string } | null = null

    for (let i = 0; i < routes.length; i++) {
      const result = matchRoute(routes[i].path, currentPath)
      if (result) {
        matched = { component: routes[i].component, params: result.params, pattern: result.pattern }
        break
      }
    }

    if (!matched) {
      this.clearCurrent_()
      return
    }

    if (matched.pattern === this.currentPattern_ && this.currentChild_) {
      this.currentChild_.__geaUpdateProps(matched.params)
      this.currentPath_ = currentPath
      return
    }

    this.clearCurrent_()

    if (this.isClassComponent_(matched.component)) {
      const child = new matched.component(matched.params)
      child.parentComponent = this
      child.render(this.el)
      this.currentChild_ = child
      this.__childComponents = [child]
    } else {
      this.renderFnComponent_(matched.component, matched.params)
    }

    this.currentPattern_ = matched.pattern
    this.currentPath_ = currentPath
  }

  private renderFnComponent_(comp: any, params: Record<string, string>): void {
    const html = String(comp(params)).trim()
    const el = ComponentManager.getInstance().createElement(html)
    this.el.appendChild(el)
    this.currentFnEl_ = el
  }

  dispose() {
    if (this.observerRemover_) {
      this.observerRemover_()
      this.observerRemover_ = null
    }
    this.clearCurrent_()
    super.dispose()
  }
}

import { Component } from 'gea'
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla'

type SpreadCleanup = () => void
type PropsGetter = string | ((api: any, el: Element) => Record<string, any>)

export interface SpreadMap {
  [selector: string]: PropsGetter
}

export default class ZagComponent extends Component {
  declare _machine: VanillaMachine<any> | null
  declare _api: any
  declare _spreadCleanups: Map<string, SpreadCleanup>
  declare _spreadScheduled: boolean

  createMachine(_props: any): any {
    return null
  }

  getMachineProps(_props: any): any {
    return {}
  }

  connectApi(service: any): any {
    return null
  }

  getSpreadMap(): SpreadMap {
    return {}
  }

  syncState(_api: any): void {}

  created(props: any) {
    if (!this._spreadCleanups) this._spreadCleanups = new Map()
    if (this._spreadScheduled === undefined) this._spreadScheduled = false

    const machineDef = this.createMachine(props)
    if (!machineDef) return

    const machineProps = this.getMachineProps(props)
    this._machine = new VanillaMachine(machineDef, machineProps)
    this._machine.start()

    this._api = this.connectApi(this._machine.service)
    this.syncState(this._api)

    this._machine.subscribe(() => {
      if (!this._machine) return
      this._api = this.connectApi(this._machine.service)
      this.syncState(this._api)
      this._scheduleSpreadApplication()
    })
  }

  _scheduleSpreadApplication() {
    if (this._spreadScheduled) return
    this._spreadScheduled = true
    queueMicrotask(() => {
      this._spreadScheduled = false
      this._applyAllSpreads()
    })
  }

  _resolveProps(getter: PropsGetter, el: Element): Record<string, any> | null {
    if (typeof getter === 'function') {
      return getter(this._api, el)
    }
    const method = this._api[getter]
    if (typeof method !== 'function') return null
    return method.call(this._api)
  }

  _queryAllIncludingSelf(selector: string): Element[] {
    const results = this.$$(selector)
    const root = this.el
    if (root && root.matches(selector) && !results.includes(root)) {
      results.unshift(root)
    }
    return results
  }

  _applyAllSpreads() {
    if (!this.rendered_ || !this._api) return
    const map = this.getSpreadMap()

    for (const selector in map) {
      const getter = map[selector]
      const elements = this._queryAllIncludingSelf(selector)

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        const key = selector + ':' + i
        const nextProps = this._resolveProps(getter, el)
        if (!nextProps) continue

        const prevCleanup = this._spreadCleanups.get(key)
        if (prevCleanup) prevCleanup()

        const cleanup = spreadProps(el, nextProps)
        this._spreadCleanups.set(key, cleanup)
      }
    }
  }

  onAfterRender() {
    this._applyAllSpreads()
  }

  dispose() {
    for (const cleanup of this._spreadCleanups.values()) {
      cleanup()
    }
    this._spreadCleanups.clear()

    if (this._machine) {
      this._machine.stop()
      this._machine = null
    }
    this._api = null

    super.dispose()
  }

  static normalizeProps = normalizeProps
}

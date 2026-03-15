import EventEmitter from './eventemitter3'

type Constructor<T = {}> = new (...args: any[]) => T

interface Disposable {
  dispose(): void
}

export interface WithEventsMixin {
  _events: Record<string, any>
  _eventsCount: number
  emit(event: string, ...args: any[]): boolean
  on(event: string, fn: Function, context?: any): this
  once(event: string, fn: Function, context?: any): this
  off(event: string, fn?: Function, context?: any, once?: boolean): this
  removeListener(event: string, fn?: Function, context?: any, once?: boolean): this
  removeAllListeners(event?: string): this
}

/**
 * Mixin that adds EventEmitter capabilities to any base class.
 * Components using this will have emit/on/once/off/removeAllListeners
 * mixed in, and dispose() will automatically clean up listeners.
 */
export function withEvents<TBase extends Constructor<Disposable>>(Base: TBase) {
  class WithEvents extends Base {
    _events: Record<string, any>
    _eventsCount: number

    declare emit: (event: string, ...args: any[]) => boolean
    declare on: (event: string, fn: Function, context?: any) => this
    declare once: (event: string, fn: Function, context?: any) => this
    declare off: (event: string, fn?: Function, context?: any, once?: boolean) => this
    declare removeListener: (event: string, fn?: Function, context?: any, once?: boolean) => this
    declare removeAllListeners: (event?: string) => this

    constructor(...args: any[]) {
      super(...args)
      this._events = Object.create(null)
      this._eventsCount = 0
    }

    dispose() {
      this.removeAllListeners()
      super.dispose()
    }
  }

  const eeProto = EventEmitter.prototype
  for (const key of Object.getOwnPropertyNames(eeProto)) {
    if (key !== 'constructor') {
      ;(WithEvents.prototype as any)[key] = (eeProto as any)[key]
    }
  }

  return WithEvents as unknown as TBase & (new (...args: any[]) => WithEventsMixin)
}

/*!
 * EventEmitter3
 *
 * Lightweight event emitter. Moved here from gea core since only
 * gea-mobile components need pub/sub on instances.
 *
 * Original: https://github.com/primus/eventemitter3
 * License: MIT
 */

interface EventListener {
  fn: Function
  context: any
  once: boolean
}

type EventStore = Record<string, EventListener | EventListener[]>

const has = Object.prototype.hasOwnProperty
let prefix: string | false = '~'

function createEvents(): EventStore {
  const rv = Object.create(null)
  rv.__proto__ = undefined
  return rv
}

if (!(createEvents() as any).__proto__) prefix = false

function createEE(fn: Function, context: any, once: boolean): EventListener {
  return { fn, context, once }
}

function addListener(emitter: EventEmitter, event: string, fn: Function, context: any, once: boolean): EventEmitter {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function')
  }

  const listener = createEE(fn, context || emitter, once)
  const evt = prefix ? prefix + event : event

  if (!emitter._events[evt]) {
    emitter._events[evt] = listener
    emitter._eventsCount++
  } else if (!(emitter._events[evt] as EventListener).fn) {
    ;(emitter._events[evt] as EventListener[]).push(listener)
  } else {
    emitter._events[evt] = [emitter._events[evt] as EventListener, listener]
  }

  return emitter
}

function clearEvent(emitter: EventEmitter, evt: string): void {
  if (--emitter._eventsCount === 0) emitter._events = createEvents()
  else delete emitter._events[evt]
}

export default class EventEmitter {
  _events: EventStore
  _eventsCount: number

  constructor() {
    this._events = createEvents()
    this._eventsCount = 0
  }

  eventNames(): (string | symbol)[] {
    const names: (string | symbol)[] = []

    if (this._eventsCount === 0) return names

    const events = this._events
    for (const name in events) {
      if (has.call(events, name)) names.push(prefix ? name.slice(1) : name)
    }

    if (Object.getOwnPropertySymbols) {
      return names.concat(Object.getOwnPropertySymbols(events))
    }

    return names
  }

  listeners(event: string): Function[] {
    const evt = prefix ? prefix + event : event
    const handlers = this._events[evt]

    if (!handlers) return []
    if ((handlers as EventListener).fn) return [(handlers as EventListener).fn]

    const ee = Array((handlers as EventListener[]).length)
    for (let i = 0; i < (handlers as EventListener[]).length; i++) {
      ee[i] = (handlers as EventListener[])[i].fn
    }
    return ee
  }

  listenerCount(event: string): number {
    const evt = prefix ? prefix + event : event
    const listeners = this._events[evt]
    if (!listeners) return 0
    if ((listeners as EventListener).fn) return 1
    return (listeners as EventListener[]).length
  }

  emit(event: string, a1?: any, a2?: any, a3?: any, a4?: any, a5?: any): boolean {
    const evt = prefix ? prefix + event : event

    if (!this._events[evt]) return false

    const listeners = this._events[evt]
    const len = arguments.length
    let args: any[] | undefined
    let i: number

    if ((listeners as EventListener).fn) {
      const single = listeners as EventListener
      if (single.once) this.removeListener(event, single.fn, undefined, true)

      switch (len) {
        case 1:
          return (single.fn.call(single.context), true)
        case 2:
          return (single.fn.call(single.context, a1), true)
        case 3:
          return (single.fn.call(single.context, a1, a2), true)
        case 4:
          return (single.fn.call(single.context, a1, a2, a3), true)
        case 5:
          return (single.fn.call(single.context, a1, a2, a3, a4), true)
        case 6:
          return (single.fn.call(single.context, a1, a2, a3, a4, a5), true)
      }

      args = Array(len - 1)
      for (i = 1; i < len; i++) {
        args[i - 1] = arguments[i] // eslint-disable-line prefer-rest-params
      }

      single.fn.apply(single.context, args)
    } else {
      const multi = listeners as EventListener[]
      const length = multi.length
      let j: number

      for (i = 0; i < length; i++) {
        if (multi[i].once) this.removeListener(event, multi[i].fn, undefined, true)

        switch (len) {
          case 1:
            multi[i].fn.call(multi[i].context)
            break
          case 2:
            multi[i].fn.call(multi[i].context, a1)
            break
          case 3:
            multi[i].fn.call(multi[i].context, a1, a2)
            break
          case 4:
            multi[i].fn.call(multi[i].context, a1, a2, a3)
            break
          default:
            if (!args) {
              args = Array(len - 1)
              for (j = 1; j < len; j++) {
                args[j - 1] = arguments[j] // eslint-disable-line prefer-rest-params
              }
            }

            multi[i].fn.apply(multi[i].context, args)
        }
      }
    }

    return true
  }

  on(event: string, fn: Function, context?: any): this {
    addListener(this, event, fn, context, false)
    return this
  }

  once(event: string, fn: Function, context?: any): this {
    addListener(this, event, fn, context, true)
    return this
  }

  removeListener(event: string, fn?: Function, context?: any, once?: boolean): this {
    const evt = prefix ? prefix + event : event

    if (!this._events[evt]) return this
    if (!fn) {
      clearEvent(this, evt)
      return this
    }

    const listeners = this._events[evt]

    if ((listeners as EventListener).fn) {
      const single = listeners as EventListener
      if (single.fn === fn && (!once || single.once) && (!context || single.context === context)) {
        clearEvent(this, evt)
      }
    } else {
      const events: EventListener[] = []
      const multi = listeners as EventListener[]
      for (let i = 0, length = multi.length; i < length; i++) {
        if (multi[i].fn !== fn || (once && !multi[i].once) || (context && multi[i].context !== context)) {
          events.push(multi[i])
        }
      }

      if (events.length) this._events[evt] = events.length === 1 ? events[0] : events
      else clearEvent(this, evt)
    }

    return this
  }

  removeAllListeners(event?: string): this {
    if (event) {
      const evt = prefix ? prefix + event : event
      if (this._events[evt]) clearEvent(this, evt)
    } else {
      this._events = createEvents()
      this._eventsCount = 0
    }
    return this
  }

  off(event: string, fn?: Function, context?: any, once?: boolean): this {
    return this.removeListener(event, fn, context, once)
  }

  addListener(event: string, fn: Function, context?: any): this {
    return this.on(event, fn, context)
  }

  static prefixed: string | false = prefix
  static EventEmitter = EventEmitter
}

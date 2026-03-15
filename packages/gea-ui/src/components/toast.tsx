import * as toast from '@zag-js/toast'
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla'
import { Component } from 'gea'

let _store: toast.Store | null = null

function getStore(props?: toast.StoreProps) {
  if (!_store) {
    _store = toast.createStore({
      placement: 'bottom-end',
      duration: 5000,
      removeDelay: 200,
      max: 5,
      ...props,
    })
  }
  return _store
}

export class ToastStore {
  static getStore = getStore

  static create(options: toast.Options) {
    return getStore().create(options)
  }

  static success(options: Omit<toast.Options, 'type'>) {
    return getStore().create({ ...options, type: 'success' })
  }

  static error(options: Omit<toast.Options, 'type'>) {
    return getStore().create({ ...options, type: 'error' })
  }

  static info(options: Omit<toast.Options, 'type'>) {
    return getStore().create({ ...options, type: 'info' })
  }

  static loading(options: Omit<toast.Options, 'type'>) {
    return getStore().create({ ...options, type: 'loading' })
  }

  static dismiss(id?: string) {
    if (id) getStore().dismiss(id)
    else getStore().dismiss()
  }
}

export class Toaster extends Component {
  _machine: VanillaMachine<any> | null = null
  _api: any = null
  _toastCleanups: Map<string, Array<() => void>> = new Map()
  _subscriptionCleanup: (() => void) | null = null
  toasts: toast.Options[] = []

  created(props: any) {
    const store = getStore(props.storeProps)

    this._machine = new VanillaMachine(toast.group.machine, { store })
    this._machine.start()

    this._api = toast.group.connect(this._machine.service, normalizeProps)
    this.toasts = this._api.getToasts()

    this._machine.subscribe(() => {
      this._api = toast.group.connect(this._machine!.service, normalizeProps)
      const nextToasts = this._api.getToasts()
      this.toasts = nextToasts
      queueMicrotask(() => this._applyGroupSpreads())
    })
  }

  _applyGroupSpreads() {
    if (!this.rendered_ || !this._api) return

    const groupEl = this.$('[data-part="group"]')
    if (groupEl) {
      const prev = this._toastCleanups.get('__group')
      if (prev) prev.forEach((fn) => fn())
      const cleanup = spreadProps(groupEl, this._api.getGroupProps())
      this._toastCleanups.set('__group', [cleanup])
    }

    const toastEls = this.$$('[data-part="toast-root"]')
    for (const el of toastEls) {
      const toastId = (el as HTMLElement).dataset.toastId
      if (!toastId) continue

      const toastData = this.toasts.find((t: any) => t.id === toastId)
      if (!toastData) continue

      const toastMachine = new VanillaMachine(toast.machine, toastData as any)
      toastMachine.start()
      const api = toast.connect(toastMachine.service, normalizeProps)

      const prevCleanups = this._toastCleanups.get(toastId)
      if (prevCleanups) prevCleanups.forEach((fn) => fn())

      const cleanups: Array<() => void> = []
      cleanups.push(spreadProps(el, api.getRootProps()))

      const title = el.querySelector('[data-part="title"]')
      if (title) cleanups.push(spreadProps(title, api.getTitleProps()))

      const desc = el.querySelector('[data-part="description"]')
      if (desc) cleanups.push(spreadProps(desc, api.getDescriptionProps()))

      const close = el.querySelector('[data-part="close-trigger"]')
      if (close) cleanups.push(spreadProps(close, api.getCloseTriggerProps()))

      const action = el.querySelector('[data-part="action-trigger"]')
      if (action) cleanups.push(spreadProps(action, api.getActionTriggerProps()))

      this._toastCleanups.set(toastId, cleanups)
    }
  }

  onAfterRender() {
    this._applyGroupSpreads()
  }

  dispose() {
    for (const cleanups of this._toastCleanups.values()) {
      cleanups.forEach((fn) => fn())
    }
    this._toastCleanups.clear()

    if (this._subscriptionCleanup) {
      this._subscriptionCleanup()
      this._subscriptionCleanup = null
    }

    if (this._machine) {
      this._machine.stop()
      this._machine = null
    }
    this._api = null

    super.dispose()
  }

  template(props: any) {
    return (
      <div data-part="group" class={`toaster fixed z-[100] flex max-h-screen flex-col-reverse gap-2 p-4 ${props.class || 'bottom-0 right-0'}`}>
        {this.toasts.map((t: any) => (
          <div data-part="toast-root" data-toast-id={t.id} class="toast-root group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 shadow-lg transition-all bg-background text-foreground">
            <div class="grid gap-1">
              {t.title && <div data-part="title" class="toast-title text-sm font-semibold">{t.title}</div>}
              {t.description && <div data-part="description" class="toast-description text-sm opacity-90">{t.description}</div>}
            </div>
            <button data-part="close-trigger" class="toast-close-trigger text-foreground/50 hover:text-foreground">
              &#x2715;
            </button>
          </div>
        ))}
      </div>
    )
  }
}

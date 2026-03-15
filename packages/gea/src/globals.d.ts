export {}

declare global {
  interface HTMLElement {
    __geaEventHandlers?: Record<string, EventListener>
    parentComps?: string
  }

  interface Event {
    targetEl?: EventTarget | null
  }
}

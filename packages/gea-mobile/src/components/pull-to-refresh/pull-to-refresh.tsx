import { Component } from 'gea'
import { withEvents } from '../../lib/with-events'
import PullToRefreshModel from './pull-to-refresh-model'
import './pull-to-refresh.css'

export default class PullToRefresh extends withEvents(Component) {
  model: PullToRefreshModel
  EventType: PullToRefreshModel['EventType']
  scrollEl: HTMLElement | null
  containerEl: HTMLElement | null
  threshold: number
  height: number
  arrowOffset: number

  private scrollListener_: ((e: Event) => void) | null
  private releaseListener_: (() => void) | null

  constructor(opt_el?: HTMLElement) {
    super()

    this.model = new PullToRefreshModel()
    this.EventType = this.model.EventType
    this.scrollEl = null
    this.containerEl = null
    this.scrollListener_ = null
    this.releaseListener_ = null
    this.threshold = 135
    this.height = 96
    this.arrowOffset = 0

    if (opt_el) this.register(opt_el)

    this.bindModelEvents()
  }

  private bindModelEvents(): void {
    this.model.on(this.model.EventType.SHOULD_REFRESH, this.onShouldRefresh.bind(this))
  }

  onShouldRefresh(): void {
    const spinner = this.$(this.mappings.SPINNER)
    const arrow = this.$(this.mappings.ARROW)

    window.requestAnimationFrame(() => {
      this.containerEl!.style.transform = `translateY(${this.height}px)`
      this.containerEl!.style.transition = '800ms cubic-bezier(.41,1,.1,1)'

      if (spinner) (spinner as HTMLElement).style.opacity = '1'
      if (arrow) (arrow as HTMLElement).style.opacity = '0'

      this.emit(this.model.EventType.SHOULD_REFRESH)
    })
  }

  onAfterRender(): void {
    super.onAfterRender()
    if (!this.scrollEl) this.register(this.el.parentElement as HTMLElement)
  }

  reset(): void {
    if (this.scrollEl) {
      this.containerEl!.style.transform = 'translateY(0)'
      this.containerEl!.style.transition = '300ms ease-out'
    }

    const spinner = this.$(this.mappings.SPINNER)
    const arrow = this.$(this.mappings.ARROW)

    if (spinner) (spinner as HTMLElement).style.opacity = '0'

    setTimeout(() => {
      if (arrow) (arrow as HTMLElement).style.opacity = '1'
    }, 500)

    this.model.reset()
  }

  register(scrollEl: HTMLElement | null, containerEl?: HTMLElement | null): void {
    if (!scrollEl) return

    if (this.scrollListener_) this.scrollEl!.removeEventListener('scroll', this.scrollListener_)
    if (this.releaseListener_) document.body.removeEventListener('touchend', this.releaseListener_)

    this.scrollEl = scrollEl

    if (containerEl) this.containerEl = containerEl
    else this.containerEl = scrollEl

    this.reset()

    this.scrollListener_ = this.onScroll_.bind(this)
    this.releaseListener_ = this.onRelease_.bind(this)

    this.scrollEl.addEventListener('scroll', this.scrollListener_)
    document.body.addEventListener('touchend', this.releaseListener_)
  }

  private onScroll_(e: Event): void {
    this.checkShouldRefresh()

    const scroll = -((e.target && (e.target as HTMLElement).scrollTop) || 0)
    const pos = this.arrowOffset + Math.pow(scroll, 0.75)
    const rotationThreshold = this.threshold - 60
    let rot = 0

    if (scroll >= rotationThreshold) rot = Math.min(180, (scroll - rotationThreshold) * 3)

    const arrow = this.$(this.mappings.ARROW)

    if (arrow) (arrow as HTMLElement).style.transform = `translateY(${pos}px) rotate(${rot}deg)`
  }

  private onRelease_(): void {
    if (!this.scrollEl) return

    if (this.scrollEl.scrollTop < -this.threshold) this.model.refresh()
  }

  checkShouldRefresh(): void {
    this.model.triggerShouldCheckState()
  }

  template() {
    return (
      <pull-to-refresh>
        <pull-to-refresh-arrow>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </pull-to-refresh-arrow>
        <div class="spinner"></div>
      </pull-to-refresh>
    )
  }

  dispose(): void {
    this.model.removeAllListeners()
    if (this.scrollEl && this.scrollListener_) this.scrollEl.removeEventListener('scroll', this.scrollListener_)
    document.body.removeEventListener('touchend', this.releaseListener_!)

    super.dispose()
  }

  get mappings() {
    return {
      ARROW: 'pull-to-refresh-arrow',
      SPINNER: '.spinner',
    }
  }
}

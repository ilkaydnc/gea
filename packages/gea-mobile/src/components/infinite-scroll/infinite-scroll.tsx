import { Component } from 'gea'
import { withEvents } from '../../lib/with-events'
import InfiniteScrollModel from './infinite-scroll-model'
import throttle from '../../lib/throttle'
import './infinite-scroll.css'

class InfiniteScroll extends withEvents(Component) {
  model: InfiniteScrollModel
  EventType: InfiniteScrollModel['EventType']
  scrollEl: HTMLElement | null
  endOfListText: string
  throttle: () => void

  private scrollListener_: (() => void) | null

  constructor(opt_el?: HTMLElement) {
    super()
    this.model = new InfiniteScrollModel()
    this.EventType = this.model.EventType

    this.scrollListener_ = null
    this.scrollEl = null
    this.endOfListText = ''

    this.throttle = throttle(this.checkShouldLoadMore_, 100, this)

    if (opt_el) this.register(opt_el)
    this.bindModelEvents()
  }

  private bindModelEvents(): void {
    this.model.on(this.model.EventType.SHOULD_LOAD, this.onShouldLoad.bind(this))
  }

  private onShouldLoad(): void {
    this.emit(this.EventType.SHOULD_LOAD)
  }

  render(opt_base?: HTMLElement, opt_index?: number) {
    const rv = super.render(opt_base!, opt_index)

    if (!this.el) this.register(this.el!.parentElement as HTMLElement)

    return rv
  }

  reset(): void {
    this.model.reset()
  }

  register(el: HTMLElement | null): void {
    if (!el) return

    this.reset()

    this.scrollEl && this.scrollEl.removeEventListener('scroll', this.scrollListener_!)

    this.scrollEl = el
    this.scrollListener_ = this.onScroll_.bind(this)
    this.scrollEl.addEventListener('scroll', this.scrollListener_)
  }

  private onScroll_(): void {
    this.throttle()
  }

  private checkShouldLoadMore_(): void {
    this.model.triggerShouldCheckState()
    if (!this.model.shouldCheck()) return

    const el = this.scrollEl
    if (!el) return

    if (el.scrollHeight > el.offsetHeight && el.scrollTop > el.scrollHeight - el.offsetHeight - 400) this.model.load()
  }

  showSpinner(): void {
    this.el.classList.add('spinner')
    this.el.innerText = ''
    this.reset()
  }

  showEndOfList(): void {
    this.el.innerText = this.endOfListText
    this.el.classList.remove('spinner')
  }

  template() {
    return <inf-scroll></inf-scroll>
  }

  dispose(): void {
    this.model.removeAllListeners()
    this.scrollEl!.removeEventListener('scroll', this.scrollListener_!)

    super.dispose()
  }
}

export default InfiniteScroll

import math from './math'

const deviceIsIOSWithBadTarget = navigator.userAgent.match(/iPhone/i) && /OS ([6-9]|\d{2})_\d/.test(navigator.userAgent)

const EventType = {
  TAP: 'tap',
  LONG_TAP: 'longTap',
  SWIPE_RIGHT: 'swipeRight',
  SWIPE_UP: 'swipeUp',
  SWIPE_LEFT: 'swipeLeft',
  SWIPE_DOWN: 'swipeDown',
} as const

export default class GestureHandler {
  el: HTMLElement
  isInMotion: boolean
  canTap: boolean
  canSwipe: boolean
  touchStartTime: number
  touches: number[]

  private hadTouchEvent_: boolean
  private longTapTimer_: ReturnType<typeof setTimeout> | null
  private longTapFired_: boolean
  private touchStartTarget_: Element | null

  constructor(opt_el?: HTMLElement) {
    this.el = opt_el || document.body

    this.isInMotion = false
    this.canTap = false
    this.canSwipe = false
    this.touchStartTime = 0
    this.touches = []
    this.hadTouchEvent_ = false
    this.longTapTimer_ = null
    this.longTapFired_ = false
    this.touchStartTarget_ = null

    this.el.addEventListener('touchstart', this.onTouchstart.bind(this), false)
    this.el.addEventListener('touchmove', this.onTouchmove.bind(this), false)
    this.el.addEventListener('touchend', this.onTouchend.bind(this), false)
    this.el.addEventListener('click', this.onClick_.bind(this), false)
  }

  onClick_(e: MouseEvent): void {
    if (this.hadTouchEvent_) return

    const tap = document.createEvent('Event')
    tap.initEvent(EventType.TAP, true, true)
    ;(e.target as Element).dispatchEvent(tap)
  }

  onTouchstart(e: TouchEvent): void {
    this.hadTouchEvent_ = true
    this.isInMotion = true
    this.canTap = true
    this.canSwipe = true
    this.longTapFired_ = false
    this.touchStartTime = new Date().getTime()
    this.touchStartTarget_ = e.target as Element

    const changedTouch = e.changedTouches[0]

    this.touches = [e.timeStamp, changedTouch.pageX, changedTouch.pageY]

    this.longTapTimer_ = setTimeout(() => {
      this.longTapTimer_ = null
      if (!this.canTap) return

      this.longTapFired_ = true
      this.canTap = false

      const longTap = document.createEvent('Event')
      longTap.initEvent(EventType.LONG_TAP, true, true)
      this.touchStartTarget_?.dispatchEvent(longTap)
    }, 800)
  }

  onTouchmove(e: TouchEvent): void {
    let touches = this.touches
    const changedTouch = e.changedTouches[0]

    if (Math.abs(changedTouch.pageX - touches[1]) > 20 || Math.abs(changedTouch.pageY - touches[2]) > 20) {
      this.canTap = false
      this.cancelLongTapTimer_()
    }

    if (!this.canSwipe) return

    touches.push(e.timeStamp, changedTouch.pageX, changedTouch.pageY)
    if (e.timeStamp - touches[0] > 300) {
      this.canSwipe = false
      return
    }

    const date = e.timeStamp
    touches = this.touches = touches.filter((touch, index, arr) => {
      const relatedTimeStamp = arr[index - (index % 3)]
      return relatedTimeStamp > date - 250
    })

    if (touches.length / 3 <= 1) return

    const distance = math.distance(touches[1], touches[2], touches[touches.length - 2], touches[touches.length - 1])
    if (distance < 60) return

    const angle = math.angle(touches[1], touches[2], touches[touches.length - 2], touches[touches.length - 1])

    let eventType: string = EventType.SWIPE_RIGHT
    if (angle > 45 && angle < 135) {
      eventType = EventType.SWIPE_DOWN
    } else if (angle > 135 && angle < 225) {
      eventType = EventType.SWIPE_LEFT
    } else if (angle > 225 && angle < 315) {
      eventType = EventType.SWIPE_UP
    }

    const swipe = document.createEvent('Event')
    swipe && swipe.initEvent(eventType, true, true)
    ;(e.target as HTMLElement).dispatchEvent(swipe)

    this.canSwipe = false
  }

  onTouchend(e: TouchEvent): void {
    this.isInMotion = false
    this.cancelLongTapTimer_()

    if (!this.canTap || this.longTapFired_) return

    const elapsed = new Date().getTime() - this.touchStartTime
    if (elapsed > 300) return

    const touches = this.touches,
      changedTouch = e.changedTouches[0]

    if (Math.abs(changedTouch.pageX - touches[1]) > 20 || Math.abs(changedTouch.pageY - touches[2]) > 20) {
      this.canTap = false
      return
    }

    const tap = document.createEvent('Event')
    tap.initEvent(EventType.TAP, true, true)

    let targetElement: Element = e.target as Element

    if (deviceIsIOSWithBadTarget)
      targetElement = document.elementFromPoint(
        changedTouch.pageX - window.pageXOffset,
        changedTouch.pageY - window.pageYOffset,
      ) as Element

    targetElement.dispatchEvent(tap)
  }

  private cancelLongTapTimer_(): void {
    if (this.longTapTimer_) {
      clearTimeout(this.longTapTimer_)
      this.longTapTimer_ = null
    }
  }
}

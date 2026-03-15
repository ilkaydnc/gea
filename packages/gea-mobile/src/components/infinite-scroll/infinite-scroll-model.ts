import EventEmitter from '../../lib/eventemitter3'

enum ISState {
  DEFAULT = 'default',
  SHOULD_CHECK = 'shouldCheck',
  LOADING = 'loading',
}

enum ISEventType {
  SHOULD_LOAD = 'load',
}

export default class InfiniteScrollModel extends EventEmitter {
  private state_: ISState

  constructor() {
    super()

    this.state_ = ISState.DEFAULT
  }

  reset(): void {
    this.state_ = ISState.DEFAULT
  }

  triggerShouldCheckState(): void {
    if (this.state_ != ISState.LOADING) this.state_ = ISState.SHOULD_CHECK
  }

  shouldCheck(): boolean {
    return this.state_ == ISState.SHOULD_CHECK
  }

  load(): void {
    if (!this.shouldCheck()) return

    this.state_ = ISState.LOADING

    this.emit(this.EventType.SHOULD_LOAD)
  }

  get State() {
    return ISState
  }

  get EventType() {
    return ISEventType
  }
}

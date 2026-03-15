import EventEmitter from '../../lib/eventemitter3'

enum P2RState {
  DEFAULT = 'default',
  SHOULD_CHECK = 'shouldCheck',
  REFRESHING = 'refreshing',
}

enum P2REventType {
  SHOULD_REFRESH = 'refresh',
}

export default class P2RComponentModel extends EventEmitter {
  private state_: P2RState

  constructor() {
    super()

    this.state_ = P2RState.DEFAULT
  }

  reset(): void {
    this.state_ = P2RState.DEFAULT
  }

  triggerShouldCheckState(): void {
    if (this.state_ != P2RState.REFRESHING) this.state_ = P2RState.SHOULD_CHECK
  }

  shouldCheck(): boolean {
    return this.state_ == P2RState.SHOULD_CHECK
  }

  refresh(): void {
    if (!this.shouldCheck()) return

    this.state_ = P2RState.REFRESHING

    this.emit(this.EventType.SHOULD_REFRESH)
  }

  get State() {
    return P2RState
  }

  get EventType() {
    return P2REventType
  }
}

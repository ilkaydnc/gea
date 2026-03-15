import { Store } from 'gea'

interface GestureLogEntry {
  id: string
  gesture: string
  time: string
}

let counter = 0

class AppStore extends Store {
  gestureLog: GestureLogEntry[] = []

  vm: any = null

  addGestureLog(gesture: string) {
    const entry: GestureLogEntry = {
      id: String(++counter),
      gesture,
      time: new Date().toLocaleTimeString(),
    }
    this.gestureLog.unshift(entry)
    if (this.gestureLog.length > 20) {
      this.gestureLog.pop()
    }
  }

  clearGestureLog() {
    this.gestureLog = []
  }
}

export default new AppStore()

import { Store } from 'gea'

class CounterStore extends Store {
  count = 0

  increment() {
    this.count++
  }

  decrement() {
    this.count--
  }
}

export default new CounterStore()

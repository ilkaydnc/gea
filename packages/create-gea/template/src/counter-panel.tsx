import { Component } from 'gea'
import counterStore from './counter-store'

export default class CounterPanel extends Component {
  template() {
    const { count } = counterStore

    return (
      <section class="panel">
        <p class="label">Class component</p>
        <p class="count">{count}</p>
        <div class="actions">
          <button class="button button-muted" click={counterStore.decrement}>
            Decrement
          </button>
          <button class="button" click={counterStore.increment}>
            Increment
          </button>
        </div>
      </section>
    )
  }
}

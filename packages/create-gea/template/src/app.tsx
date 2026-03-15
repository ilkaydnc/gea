import { Component } from 'gea'
import CounterNote from './counter-note'
import CounterPanel from './counter-panel'
import counterStore from './counter-store'

export default class App extends Component {
  template() {
    return (
      <main class="app">
        <p class="eyebrow">Gea</p>
        <h1>Hello from Gea</h1>
        <p class="copy">A tiny starter with a shared store, one class component, and one function component.</p>
        <CounterPanel />
        <CounterNote count={counterStore.count} />
      </main>
    )
  }
}

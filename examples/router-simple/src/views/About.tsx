import { Component } from 'gea'

export default class About extends Component {
  template() {
    return (
      <div class="view">
        <h1>About</h1>
        <p>
          This example uses <code>createRouter</code> from <code>gea-router</code> to define a flat
          route map. Each path maps directly to a component — no nested layouts or route guards.
        </p>
        <p>
          The <code>Link</code> component handles client-side navigation via
          <code>history.pushState</code>, and <code>router.isActive()</code> highlights the current
          nav link.
        </p>
      </div>
    )
  }
}

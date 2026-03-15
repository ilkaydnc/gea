export default function About() {
  return (
    <div class="view">
      <h1>About</h1>
      <p>
        This example demonstrates Gea's built-in router. Routes are declared as a plain array of
        <code>{' { path, component } '}</code> objects passed to <code>{'<RouterView />'}</code>.
      </p>
      <p>
        The <code>Link</code> component renders an anchor tag that navigates via
        <code>history.pushState</code> — no full page reloads.
      </p>
    </div>
  )
}

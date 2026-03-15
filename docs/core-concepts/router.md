# Router

Gea includes a built-in client-side router for single-page applications. It consists of a reactive `router` store, a `RouterView` component for declarative route rendering, a `Link` component for SPA navigation, and a `matchRoute` utility for manual matching.

## Quick Example

```jsx
import { Component, Link, RouterView } from 'gea'
import Home from './views/Home'
import About from './views/About'
import UserProfile from './views/UserProfile'

export default class App extends Component {
  template() {
    return (
      <div class="app">
        <nav>
          <Link to="/" label="Home" />
          <Link to="/about" label="About" />
          <Link to="/users/1" label="Alice" />
        </nav>
        <RouterView routes={[
          { path: '/', component: Home },
          { path: '/about', component: About },
          { path: '/users/:id', component: UserProfile },
        ]} />
      </div>
    )
  }
}
```

## Route Patterns

| Pattern | Example URL | Params |
| --- | --- | --- |
| `/about` | `/about` | `{}` |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/users/:userId/posts/:postId` | `/users/7/posts/99` | `{ userId: '7', postId: '99' }` |
| `/files/*` | `/files/docs/readme.md` | `{ '*': 'docs/readme.md' }` |
| `/repo/:owner/*` | `/repo/dashersw/src/index.ts` | `{ owner: 'dashersw', '*': 'src/index.ts' }` |

Named parameters (`:param`) match a single path segment. Wildcards (`*`) capture the rest of the path. Parameter values are URI-decoded automatically.

## RouterView

`RouterView` renders the first matching route from a `routes` array. It observes `router.path` and automatically swaps the rendered component when the URL changes.

```jsx
<RouterView routes={[
  { path: '/', component: Home },
  { path: '/about', component: About },
  { path: '/users/:id', component: UserProfile },
]} />
```

- Routes are matched in array order — the first match wins.
- Matched params (e.g. `{ id: '42' }`) are passed as props to the component.
- Both class components and function components are supported.
- When the route changes, the previous component is disposed and the new one is rendered.
- Navigating between URLs that match the same pattern (e.g. `/users/1` → `/users/2`) updates the existing component's props instead of re-creating it.
- If no route matches, nothing is rendered.

## Link

`Link` renders an `<a>` tag that navigates via `history.pushState` instead of triggering a full page reload.

```jsx
<Link to="/about" label="About" />
<Link to="/users/1" label="Alice" class="nav-link" />
```

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `to` | `string` | Yes | Target path |
| `label` | `string` | Yes | Text content of the link |
| `class` | `string` | No | CSS class(es) for the `<a>` tag |

Modifier keys (Cmd, Ctrl, Shift, Alt) are detected — the browser's native behavior (open in new tab, etc.) is preserved. The `href` attribute is always set, so right-click → "Open in new tab" works.

## Programmatic Navigation

The `router` singleton is a `Store` that tracks `path`, `hash`, and `search` from `window.location`. Its properties are reactive — templates and observers are notified when they change.

```ts
import { router } from 'gea'

router.navigate('/about')          // push new history entry
router.replace('/login')           // replace current entry
router.back()                      // history.back()
router.forward()                   // history.forward()

console.log(router.path)           // '/about'
console.log(router.query)          // { q: 'hello' } for ?q=hello
```

| Method | Description |
| --- | --- |
| `navigate(path)` | Push a new history entry and update `path`, `hash`, `search` |
| `replace(path)` | Replace the current history entry (no new back-button entry) |
| `back()` | Go back one entry (`history.back()`) |
| `forward()` | Go forward one entry (`history.forward()`) |

| Property | Type | Description |
| --- | --- | --- |
| `path` | `string` | Current pathname (e.g. `'/users/42'`) |
| `hash` | `string` | Current hash (e.g. `'#section'`) |
| `search` | `string` | Current search string (e.g. `'?q=hello'`) |
| `query` | `Record<string, string>` | Parsed key-value pairs from `search` (getter) |

The router responds to the browser's `popstate` event (back/forward buttons) and updates its properties accordingly.

## Route Parameters in Components

Function components receive matched params as props:

```jsx
export default function UserProfile({ id }) {
  return <h1>User {id}</h1>
}
```

Class components receive them via `created(props)` and `template(props)`:

```jsx
export default class UserProfile extends Component {
  created(props) {
    // props.id is available here
  }

  template({ id }) {
    return <h1>User {id}</h1>
  }
}
```

## matchRoute Utility

Use `matchRoute` for manual route matching outside of `RouterView`:

```ts
import { matchRoute } from 'gea'

const result = matchRoute('/users/:id', '/users/42')
// { path: '/users/42', pattern: '/users/:id', params: { id: '42' } }
```

Returns `null` if the pattern doesn't match.

## Inline Conditional Routing

For simple apps, you can skip `RouterView` and use Gea's compile-time conditionals directly:

```jsx
import { Component } from 'gea'
import { router, matchRoute } from 'gea'

export default class App extends Component {
  template() {
    const path = router.path
    const userMatch = matchRoute('/users/:id', path)
    return (
      <div>
        {path === '/' && <Home />}
        {path === '/about' && <About />}
        {userMatch && <UserProfile id={userMatch.params.id} />}
      </div>
    )
  }
}
```

This trades configuration-driven routing for tighter integration with Gea's compile-time reactivity system.

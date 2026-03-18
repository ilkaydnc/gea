# Navigation

## Programmatic Navigation

The router exposes navigation methods directly. Import the router and call them.

### push

Adds a new entry to browser history.

```ts
import { router } from './router'

router.push('/projects/42')

router.push({
  path: '/projects',
  query: { sort: 'name' },
  hash: 'details',
})
```

### replace

Replaces the current history entry. The back button skips over it.

```ts
router.replace('/login')

router.replace({
  path: '/dashboard',
  query: { tab: 'overview' },
})
```

### back, forward, go

```ts
router.back()       // go back one entry
router.forward()    // go forward one entry
router.go(-2)       // go back two entries
```

These map directly to `history.back()`, `history.forward()`, and `history.go()`.

### Recommendations

- Use `push` for user-initiated navigation (clicking a button, submitting a form).
- Use `replace` for redirects and programmatic corrections (auth redirects, fixing stale URLs).
- Avoid `go()` with large offsets. Users lose context when they jump multiple entries.

## Link Component

`Link` renders an `<a>` tag with the correct `href`. It intercepts clicks and calls `router.push`. Modifier-key clicks (ctrl, meta, shift) and external URLs pass through to the browser.

```tsx
import { Link } from 'gea-router'

<Link to="/dashboard">Dashboard</Link>
```

### replace

Use the `replace` prop to call `router.replace` instead of `router.push`.

```tsx
<Link to="/login" replace>Sign in</Link>
```

### Styling

`Link` is a plain `<a>` tag. Pass any attribute you'd put on an anchor.

```tsx
<Link to="/about" class="nav-link" id="about-link">About</Link>
```

### Recommendations

- Use `Link` instead of `<a>` for internal navigation. It prevents full page reloads.
- Use plain `<a>` for external links. `Link` is for routes within your app.

## Active Link Detection

The router provides two methods for detecting which route is active.

### isActive

Returns `true` if the current path starts with the given path. Use it for parent navigation items that should stay highlighted when a child route is active.

```ts
router.isActive('/dashboard')         // true for /dashboard, /dashboard/projects, /dashboard/projects/42
```

### isExact

Returns `true` only on an exact path match.

```ts
router.isExact('/dashboard')          // true only for /dashboard
```

### Example: Active Nav Links

```tsx
import { Component } from 'gea'
import { Link } from 'gea-router'
import { router } from './router'
import { cn } from './utils/cn'

export default class Nav extends Component {
  template() {
    return (
      <nav>
        <Link to="/dashboard"
              class={cn('nav-link', router.isExact('/dashboard') && 'active')}>
          Overview
        </Link>
        <Link to="/dashboard/projects"
              class={cn('nav-link', router.isActive('/dashboard/projects') && 'active')}>
          Projects
        </Link>
        <Link to="/settings"
              class={cn('nav-link', router.isActive('/settings') && 'active')}>
          Settings
        </Link>
      </nav>
    )
  }
}
```

### Recommendations

- Use `isExact` for top-level items like "Overview" that shouldn't stay highlighted when a sibling is active.
- Use `isActive` for section-level items like "Projects" that should stay highlighted for all child routes (`/projects`, `/projects/42`, `/projects/42/edit`).
- Keep active detection in the template. It's reactive — the classes update automatically when the route changes.

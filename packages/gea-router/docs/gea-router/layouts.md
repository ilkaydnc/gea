# Layouts

Layouts are normal Gea components. They render a shell — nav, sidebar, header — and use `<Outlet />` to display the matched child route. Layouts don't receive the child as a prop; the `Outlet` handles instantiation and lifecycle.

## Path-Mode Layout

In path mode (the default), the layout renders its chrome and places an `<Outlet />` where the child should appear.

```tsx
import { Component } from 'gea'
import { Link, Outlet } from 'gea-router'
import { router } from '../router'

export default class DashboardLayout extends Component {
  template() {
    return (
      <div class="dashboard">
        <nav>
          <Link to="/dashboard"
                class={router.isExact('/dashboard') ? 'nav-link active' : 'nav-link'}
                label="Overview" />
          <Link to="/dashboard/projects"
                class={router.isActive('/dashboard/projects') ? 'nav-link active' : 'nav-link'}
                label="Projects" />
        </nav>
        <main><Outlet /></main>
      </div>
    )
  }
}
```

The `<Outlet />` renders the resolved child component with full lifecycle — `created()`, `onAfterRender()`, event bindings, and child components all work normally.

## Query-Mode Layout

In query mode, the layout receives `activeKey`, `keys`, and `navigate` props for managing tabs or similar UI.

```tsx
import { Component } from 'gea'
import { Outlet } from 'gea-router'

export default class SettingsLayout extends Component {
  template({ activeKey, keys, navigate }) {
    return (
      <div class="settings">
        <h1>Settings</h1>
        <div class="tabs">
          {keys.map((key: string) => (
            <button
              class={key === activeKey ? 'tab active' : 'tab'}
              click={() => navigate(key)}>
              {key}
            </button>
          ))}
        </div>
        <div class="content"><Outlet /></div>
      </div>
    )
  }
}
```

The route config that produces these props:

```ts
'/settings': {
  layout: SettingsLayout,
  mode: { type: 'query', param: 'view' },
  children: {
    'profile': ProfileSettings,
    'billing': BillingSettings,
    'team': TeamSettings,
  }
}
```

`navigate('billing')` updates the URL to `/settings?view=billing` and the `<Outlet />` renders `BillingSettings`.

## Layout Props Reference

| Prop | Mode | Type | Description |
|---|---|---|---|
| `activeKey` | query | `string` | Currently active child key |
| `keys` | query | `string[]` | All available child keys |
| `navigate` | query | `(key: string) => void` | Switch to a different child |

Path-mode layouts don't receive any special props — they just use `<Outlet />`.

## Pathless Layouts

A layout at `'/'` wraps its children without adding a URL segment. Use it for app shells, auth boundaries, or shared wrappers.

```ts
'/': {
  layout: AppShell,
  guard: AuthGuard,
  children: {
    '/dashboard': Dashboard,
    '/settings': Settings,
  }
}
```

URL `/dashboard` resolves to `AppShell > Dashboard`. The pathless layout doesn't affect the URL.

```tsx
import { Component } from 'gea'
import { Outlet } from 'gea-router'

export default class AppShell extends Component {
  template() {
    return (
      <div class="app">
        <Header />
        <main><Outlet /></main>
        <Footer />
      </div>
    )
  }
}
```

## Nested Outlets

Each nesting level gets its own `<Outlet />`. Given this config:

```ts
'/': {
  layout: AppShell,         // renders <Outlet /> → DashboardLayout
  children: {
    '/dashboard': {
      layout: DashboardLayout, // renders <Outlet /> → Overview or Projects
      children: {
        '/': Overview,
        '/projects': Projects,
      }
    }
  }
}
```

When the user navigates to `/dashboard/projects`:
1. `AppShell` renders, its `<Outlet />` mounts `DashboardLayout`
2. `DashboardLayout` renders, its `<Outlet />` mounts `Projects`

## Recommendations

- Keep layouts as dumb shells. They render chrome and place `<Outlet />`. Business logic belongs in stores.
- Use path mode for URL-driven navigation (dashboards, resource pages). Use query mode for tab-style UIs where the base path stays the same.
- Don't put navigation logic in layouts. Use `Link` and `router.isActive()` for nav highlighting.

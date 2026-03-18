# Type Safety

gea-router infers types from your route config. No codegen, no manual type definitions. The route object is the single source of truth.

## as const

The foundation of type inference. Without `as const`, TypeScript widens string literals and the router can't infer param names or child keys.

```ts
// Without as const — types are too wide, no inference
export const router = createRouter({
  '/projects/:id': Project,
})

// With as const — full type inference
export const router = createRouter({
  '/projects/:id': Project,
} as const)
```

Always add `as const` to your route config.

## InferRouteProps

Extracts layout prop types from the router. Export it once from your router file.

```ts
// router.ts
import { createRouter, InferRouteProps } from 'gea-router'

export const router = createRouter({
  '/': {
    layout: AppShell,
    children: {
      '/dashboard': {
        layout: DashboardLayout,
        children: {
          '/': Overview,
          '/projects': Projects,
          '/projects/:id': Project,
        }
      },
      '/settings': {
        layout: SettingsLayout,
        mode: { type: 'query', param: 'view' },
        children: {
          'profile': ProfileSettings,
          'billing': BillingSettings,
          'team': TeamSettings,
        }
      },
    }
  },
  '*': NotFound,
} as const)

export type RouteProps = InferRouteProps<typeof router>
```

## RouteProps

Use `RouteProps['/path']` to type a layout component. The type is keyed by the route path where the layout is mounted.

```tsx
import type { RouteProps } from '../router'

export default class DashboardLayout extends Component<RouteProps['/dashboard']> {
  template({ page, route, params }) {
    // page:   Overview | Projects | Project   — union of children
    // route:  string                          — matched pattern
    // params: { id?: string }                 — union of all child params
  }
}
```

For query-mode layouts:

```tsx
export default class SettingsLayout extends Component<RouteProps['/settings']> {
  template({ page, activeKey, keys, navigate }) {
    // activeKey: 'profile' | 'billing' | 'team'
    // keys:     ('profile' | 'billing' | 'team')[]
    // navigate: (key: 'profile' | 'billing' | 'team') => void
  }
}
```

The types follow the route config. Add a child route, and the layout's `page` union updates automatically.

## ExtractParams

Extracts param types from a route pattern string.

```ts
import type { ExtractParams } from 'gea-router'

type Params = ExtractParams<'/projects/:id'>
// { id: string }

type Nested = ExtractParams<'/users/:userId/posts/:postId'>
// { userId: string; postId: string }
```

This is used internally by `InferRouteProps`. You rarely need it directly, but it's available for edge cases where you need param types outside of a layout.

## Putting It Together

```ts
// router.ts
import { createRouter, InferRouteProps } from 'gea-router'
// ... imports

export const router = createRouter({
  '/login': Login,

  '/': {
    layout: AppShell,
    guard: AuthGuard,
    children: {
      '/dashboard': {
        layout: DashboardLayout,
        children: {
          '/': Overview,
          '/projects': Projects,
          '/projects/:id': Project,
        }
      },
    }
  },

  '*': NotFound,
} as const)

export type RouteProps = InferRouteProps<typeof router>
```

```tsx
// layouts/DashboardLayout.tsx
import { Component } from 'gea'
import type { RouteProps } from '../router'

export default class DashboardLayout extends Component<RouteProps['/dashboard']> {
  template({ page, params }) {
    // TypeScript knows:
    // - page is Overview | Projects | Project
    // - params.id is string | undefined (present for Project, absent for others)
    return (
      <div class="dashboard">
        <nav>...</nav>
        <main>{page}</main>
      </div>
    )
  }
}
```

```tsx
// views/Project.tsx — route components get typed params too
import { Component } from 'gea'

export default class Project extends Component {
  created({ id }) {
    // id: string — inferred from '/projects/:id'
    projectStore.fetch(id)
  }
}
```

## Recommendations

- Always use `as const` on the route config. Without it, nothing else works.
- Export `RouteProps` once from `router.ts`. Every layout imports the same type.
- Type layouts with `RouteProps['/path']`, not manual interfaces. The types stay in sync with the config automatically.
- Don't use `ExtractParams` unless you have a specific need outside of layout typing. `RouteProps` covers the common case.
- If TypeScript complains about the route config being too complex, break child objects into named constants with `as const` on each, then compose them.

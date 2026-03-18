# Guards

A guard is a function that controls access to a route. It runs before the route component renders.

## Return Values

A guard returns one of three things:

| Return | Effect |
|---|---|
| `true` | Proceed to the route |
| `string` | Redirect to that path |
| `Component` | Render it instead of the route |

## Redirect Guard

The most common pattern. Check a condition, redirect if it fails.

```ts
import authStore from './stores/auth-store'

export const AuthGuard = () => {
  if (authStore.user) return true
  return '/login'
}
```

Apply it to a route group:

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

Every route inside the group is protected. Unauthenticated users are sent to `/login`.

## UI Guard (Dead End)

Return a component instead of a redirect. The user sees an inline message rather than being sent elsewhere.

```ts
import NoAccess from './views/NoAccess'

export const AdminGuard = () => {
  if (authStore.user?.role === 'admin') return true
  return NoAccess
}
```

```tsx
export default class NoAccess extends Component {
  template() {
    return (
      <div class="no-access">
        <h2>You don't have access to this page</h2>
        <Link to="/dashboard">Go back to dashboard</Link>
      </div>
    )
  }
}
```

The URL stays the same. The guard component replaces the route content.

## UI Guard (Blocking with Proceed)

The guard component receives a `proceed` callback. Call it to continue to the original route after the user completes an action.

```ts
import TwoFactorPrompt from './views/TwoFactorPrompt'

export const TwoFactorGuard = () => {
  if (authStore.user?.verified2FA) return true
  return TwoFactorPrompt
}
```

```tsx
export default class TwoFactorPrompt extends Component {
  template({ proceed }) {
    return (
      <div class="two-factor">
        <h2>Enter verification code</h2>
        <input id="code" />
        <button click={() => this.verify(proceed)}>Verify</button>
      </div>
    )
  }

  async verify(proceed) {
    const code = (this.$('#code') as HTMLInputElement).value
    const ok = await authStore.verify2FA(code)
    if (ok) proceed()
  }
}
```

The user stays on the same URL. After verification, `proceed()` renders the original route without a page reload.

## Stacking Guards

Guards on nested groups stack from parent to child. The parent guard runs first. The child guard only runs if the parent passes.

```ts
'/': {
  guard: AuthGuard,           // runs first
  children: {
    '/admin': {
      guard: AdminGuard,      // runs second, only if AuthGuard passes
      children: {
        '/': AdminPanel,
        '/users': UserManagement,
      }
    }
  }
}
```

A user hitting `/admin/users` must pass both `AuthGuard` and `AdminGuard`.

## Checks in created()

For one-off logic that doesn't belong in the route config, use the component's `created()` lifecycle method.

```tsx
export default class ProjectEdit extends Component {
  created({ id }) {
    const project = projectStore.getById(id)
    if (project?.ownerId !== authStore.user?.id) {
      router.replace('/projects')
    }
  }
}
```

This is not a guard — it runs after route resolution. Use it for fine-grained checks that depend on component-specific data.

## Recommendations

- Use redirect guards for auth. Redirecting to `/login` is the expected pattern for unauthenticated users.
- Use UI guards for role-based access. Showing a "no access" message in place is better UX than redirecting to an unrelated page.
- Use the `proceed` callback for multi-step verification (2FA, terms acceptance). It keeps the user on the same URL and avoids navigation complexity.
- Put guards on the group, not on individual routes. If three routes share the same auth check, one guard on the parent covers all of them.
- Keep guards simple. A guard should check a condition and return. Async work (like fetching permissions) belongs in stores, triggered from `created()`.

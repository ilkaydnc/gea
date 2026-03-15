# UI Components

`gea-mobile` includes several pre-built components for common mobile UI patterns.

## Sidebar

Slide-out navigation panel that integrates with ViewManager gestures.

```js
import { Sidebar } from 'gea-mobile'
```

### Usage

```jsx
class AppSidebar extends Sidebar {
  template_items() {
    return `
      <sidebar-item data-view="home">Home</sidebar-item>
      <sidebar-item data-view="settings">Settings</sidebar-item>
      <sidebar-item data-view="about">About</sidebar-item>
    `
  }
}
```

Tapping a sidebar item emits a `SWITCH_VIEW` event with the `data-view` value.

## TabView

Tab-based view switching with a bottom tab bar and an internal ViewManager for managing the content area.

```js
import { TabView } from 'gea-mobile'
```

### Usage

```jsx
class MainTabs extends TabView {
  template_views() {
    // Return the content views for each tab
  }

  template_items() {
    // Return the tab bar items
  }
}
```

### Methods

| Method | Description |
| --- | --- |
| `activateItem(index)` | Switch to a tab by its index |
| `activateItemByName(name)` | Switch to a tab by its name |

## NavBar

Top navigation bar with optional back and menu buttons.

```js
import { NavBar } from 'gea-mobile'
```

### Usage

```jsx
const nav = new NavBar({
  title: 'My App',
  hasBackButton: true,
  hasMenuButton: false
})
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Title displayed in the center |
| `hasBackButton` | `boolean` | `false` | Show a back button on the left |
| `hasMenuButton` | `boolean` | `false` | Show a menu button on the left |

Back and menu buttons emit `tap` events that can be handled via event delegation.

## PullToRefresh

Pull-down-to-refresh pattern. Shows an arrow indicator that transitions to a spinner when the user pulls past the threshold.

```js
import { PullToRefresh } from 'gea-mobile'
```

### Usage

```js
const ptr = new PullToRefresh()
ptr.register(scrollElement)

// Listen for the refresh event and reload data
// Call ptr.reset() when the data is loaded
```

### Methods

| Method | Description |
| --- | --- |
| `register(scrollEl, containerEl?)` | Attach to a scrollable element |
| `reset()` | Reset to idle state after data loads |

The component emits a `SHOULD_REFRESH` event when the user pulls past the 135px threshold.

## InfiniteScroll

Load-more-on-scroll pattern. Monitors scroll position and emits an event when the user scrolls near the bottom.

```js
import { InfiniteScroll } from 'gea-mobile'
```

### Usage

```js
const inf = new InfiniteScroll()
inf.register(scrollElement)

// Listen for the load event and fetch more data
// Call inf.reset() for a new dataset, or inf.showEndOfList() when done
```

### Methods

| Method | Description |
| --- | --- |
| `register(el)` | Attach to a scrollable element |
| `reset()` | Reset for a new data set |
| `showSpinner()` | Show the loading indicator |
| `showEndOfList()` | Show end-of-list marker |

The component emits a `SHOULD_LOAD` event using throttled scroll checks (100ms interval).

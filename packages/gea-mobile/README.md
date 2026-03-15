# gea-mobile

[![npm version](https://badge.fury.io/js/gea-mobile.svg)](https://www.npmjs.com/package/gea-mobile)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/dashersw/gea/blob/master/LICENSE)

Mobile-oriented UI primitives for the [Gea](https://www.npmjs.com/package/gea) framework — full-screen views, iOS-style navigation transitions, back gestures, sidebars, tabs, pull-to-refresh, and infinite scroll.

## Installation

```bash
npm install gea-mobile
```

`gea-mobile` has a peer dependency on `gea` ^1.0.0.

### CSS

Import the stylesheet in your entry point:

```js
import 'gea-mobile/style.css'
```

Or reference it directly:

```js
import 'gea-mobile/dist/gea-mobile.css'
```

## Components

### View

A full-screen `Component` that renders to `document.body` by default. Adds a `view` attribute for uniform CSS layout and supports navigation transitions.

```jsx
import { View } from 'gea-mobile'

class HomeView extends View {
  template() {
    return (
      <view>
        <h1>Welcome</h1>
      </view>
    )
  }

  onActivation() {
    // called when this view enters the viewport
  }
}
```

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | `0` | Z-axis position |
| `supportsBackGesture` | `boolean` | `false` | Enable swipe-back gesture |
| `backGestureTouchTargetWidth` | `number` | `50` | Touch area width (px) for back gesture |
| `hasSidebar` | `boolean` | `false` | Allow sidebar reveal via swipe |

### ViewManager

Manages a navigation stack of `View` instances with iOS-style push/pull transitions.

```js
import { ViewManager } from 'gea-mobile'

const vm = new ViewManager()
const home = new HomeView()

vm.setCurrentView(home)

// Navigate forward (preserving history for back navigation)
vm.pull(detailView, true)

// Go back
vm.push()
```

| Method | Description |
| --- | --- |
| `pull(view, canGoBack?)` | Navigate to a new view. If `canGoBack` is true, current view is saved in history. |
| `push()` | Go back to the previous view in history. |
| `setCurrentView(view, noDispose?)` | Set the active view without animation. |
| `canGoBack()` | Returns `true` if there are views in history. |
| `toggleSidebar()` | Toggle the sidebar open/closed. |

### GestureHandler

Registers touch gesture events with the component system. These events work via event delegation like all standard DOM events.

Supported gestures: `tap`, `longTap`, `swipeRight`, `swipeLeft`, `swipeUp`, `swipeDown`.

```jsx
<div swipeRight={() => handleSwipe()}>Swipe me</div>
```

### Sidebar

Slide-out navigation panel. Integrates with `ViewManager` gestures for reveal/dismiss.

```jsx
import { Sidebar } from 'gea-mobile'

class AppSidebar extends Sidebar {
  template_items() {
    return `
      <sidebar-item data-view="home">Home</sidebar-item>
      <sidebar-item data-view="settings">Settings</sidebar-item>
    `
  }
}
```

### TabView

Tab-based view switching with a bottom tab bar and an internal `ViewManager`.

```jsx
import { TabView } from 'gea-mobile'

class MainTabs extends TabView {
  template_views() { /* tab content views */ }
  template_items() { /* tab bar items */ }
}
```

| Method | Description |
| --- | --- |
| `activateItem(index)` | Switch to tab by index |
| `activateItemByName(name)` | Switch to tab by name |

### NavBar

Top navigation bar with optional back and menu buttons.

```jsx
import { NavBar } from 'gea-mobile'

const nav = new NavBar({
  title: 'My App',
  hasBackButton: true,
  hasMenuButton: false
})
```

### PullToRefresh

Pull-down-to-refresh pattern. Emits a `SHOULD_REFRESH` event when the user pulls past the threshold.

```js
import { PullToRefresh } from 'gea-mobile'

const ptr = new PullToRefresh()
ptr.register(scrollElement)
```

| Method | Description |
| --- | --- |
| `register(scrollEl, containerEl?)` | Attach to a scrollable element |
| `reset()` | Reset to idle state after data loads |

### InfiniteScroll

Load-more-on-scroll pattern. Emits a `SHOULD_LOAD` event when the user scrolls near the bottom.

```js
import { InfiniteScroll } from 'gea-mobile'

const inf = new InfiniteScroll()
inf.register(scrollElement)
```

| Method | Description |
| --- | --- |
| `register(el)` | Attach to a scrollable element |
| `reset()` | Reset state for a new data set |
| `showSpinner()` | Show the loading indicator |
| `showEndOfList()` | Show end-of-list marker |

## Full Example

```jsx
import { View, ViewManager } from 'gea-mobile'
import 'gea-mobile/style.css'

class HomeView extends View {
  template() {
    return (
      <view>
        <h1>Home</h1>
        <button click={this.openDetail}>View Detail</button>
      </view>
    )
  }

  openDetail() {
    const detail = new DetailView()
    detail.supportsBackGesture = true
    this.vm.pull(detail, true)
  }
}

class DetailView extends View {
  template() {
    return (
      <view>
        <h1>Detail</h1>
        <p>Swipe from the left edge to go back.</p>
      </view>
    )
  }
}

const vm = new ViewManager()
const home = new HomeView()
home.vm = vm
vm.setCurrentView(home)
```

## Documentation

Full documentation: [docs](https://github.com/dashersw/gea/tree/master/docs/gea-mobile)

## License

[MIT](LICENSE) — Copyright (c) 2017-present Armagan Amcalar

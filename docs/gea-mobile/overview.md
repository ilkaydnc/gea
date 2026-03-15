# Gea Mobile Overview

`gea-mobile` extends the Gea framework with mobile-oriented UI primitives: full-screen views, iOS-style navigation transitions, back gestures, sidebars, tab bars, pull-to-refresh, and infinite scroll.

## Installation

```bash
npm install gea-mobile
```

`gea-mobile` has a peer dependency on `gea` ^1.0.0.

## CSS

Import the stylesheet in your entry point:

```js
import 'gea-mobile/style.css'
```

This provides base styles for views, transitions, and the built-in components.

## Components at a Glance

| Component | Purpose |
| --- | --- |
| [View](view.md) | Full-screen component with transition support |
| [ViewManager](view-manager.md) | Navigation stack with push/pull transitions |
| [GestureHandler](gestures.md) | Touch gesture recognition (tap, swipe, long tap) |
| [Sidebar](components.md#sidebar) | Slide-out navigation panel |
| [TabView](components.md#tabview) | Tab-based view switching |
| [NavBar](components.md#navbar) | Top navigation bar |
| [PullToRefresh](components.md#pulltorefresh) | Pull-down-to-refresh pattern |
| [InfiniteScroll](components.md#infinitescroll) | Load-more-on-scroll pattern |

## Quick Example

```jsx
import { View, ViewManager } from 'gea-mobile'
import 'gea-mobile/style.css'

class HomeView extends View {
  template() {
    return (
      <view>
        <h1>Home</h1>
        <button click={this.openDetail}>Open Detail</button>
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

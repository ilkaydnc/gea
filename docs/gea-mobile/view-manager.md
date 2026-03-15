# ViewManager

`ViewManager` manages a stack of `View` instances with iOS-style push/pull transitions. It handles forward navigation, back navigation, history management, and sidebar toggling.

## Import

```js
import { ViewManager } from 'gea-mobile'
```

## Basic Usage

```js
const vm = new ViewManager()
const home = new HomeView()

vm.setCurrentView(home)
```

By default, ViewManager uses `document.body` as its root element. You can pass a `View` to use its element as the container:

```js
const vm = new ViewManager(containerView)
```

## Methods

| Method | Description |
| --- | --- |
| `pull(view, canGoBack?)` | Navigate to a new view. If `canGoBack` is `true`, the current view is saved in history. |
| `push()` | Go back to the previous view in history. Disposes the current view. |
| `setCurrentView(view, noDispose?)` | Set the active view without animation. Disposes history unless `noDispose` is `true`. |
| `canGoBack()` | Returns `true` if there are views in the history stack. |
| `toggleSidebar()` | Toggle the sidebar open/closed. |
| `getLastViewInHistory()` | Returns the most recent view in the history stack. |

## Navigation Flow

```js
const vm = new ViewManager()
const home = new HomeView()
const detail = new DetailView()
const subDetail = new SubDetailView()

// Set initial view
vm.setCurrentView(home)

// Navigate forward (preserve history)
vm.pull(detail, true)

// Navigate deeper
vm.pull(subDetail, true)

// Go back one level (disposes subDetail, restores detail)
vm.push()

// Go back again (disposes detail, restores home)
vm.push()
```

## Passing ViewManager to Views

Views need a reference to the ViewManager for forward navigation. A common pattern:

```js
const vm = new ViewManager()
const home = new HomeView()
home.vm = vm
vm.setCurrentView(home)
```

Inside the view:

```jsx
class HomeView extends View {
  template() {
    return (
      <view>
        <button click={this.openDetail}>Detail</button>
      </view>
    )
  }

  openDetail() {
    const detail = new DetailView()
    detail.vm = this.vm
    detail.supportsBackGesture = true
    this.vm.pull(detail, true)
  }
}
```

## Sidebar Integration

ViewManager supports a sidebar that can be toggled with a swipe or button:

```js
vm.toggleSidebar()
```

Views that support sidebar reveal should set `hasSidebar = true`.

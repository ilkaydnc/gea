# View

`View` extends `Component` with defaults suited for full-screen pages. It renders to `document.body` by default, adds a `view` attribute to the root element for uniform CSS styling, and supports navigation transitions.

## Import

```js
import { View } from 'gea-mobile'
```

## Basic Usage

```jsx
class HomeView extends View {
  template() {
    return (
      <view>
        <h1>Welcome</h1>
        <p>This is the home screen.</p>
      </view>
    )
  }

  onActivation() {
    // Called when this view enters the viewport
  }
}

const home = new HomeView()
home.render() // renders to document.body
```

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | `0` | Z-axis position for stacking views |
| `supportsBackGesture` | `boolean` | `false` | Enable swipe-back gesture from left edge |
| `backGestureTouchTargetWidth` | `number` | `50` | Width in pixels of the touch area for back gesture |
| `hasSidebar` | `boolean` | `false` | Allow sidebar reveal via swipe |

## Lifecycle

| Method | Description |
| --- | --- |
| `onActivation()` | Called when the view becomes the active view in a ViewManager |
| `panIn(isBeingPulled)` | Animate the view into the viewport |
| `panOut(isBeingPulled)` | Animate the view out of the viewport |

In addition to the standard Component lifecycle (`created`, `onAfterRender`, `dispose`).

## Recommended CSS

The `gea-mobile/style.css` import provides these defaults, but for custom setups:

```css
[view] {
  position: absolute;
  transition: transform 0.35s;
  z-index: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}
```

## Back Gesture

To enable the iOS-style swipe-back gesture on a detail view:

```js
class DetailView extends View {
  constructor() {
    super()
    this.supportsBackGesture = true
    this.backGestureTouchTargetWidth = window.innerWidth / 2
  }

  template() {
    return <view><h1>Detail</h1></view>
  }
}
```

When the user drags from the left edge toward the right, the previous view is revealed underneath. Releasing past the threshold completes the navigation; releasing before snaps back.

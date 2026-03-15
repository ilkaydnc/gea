# Gestures

`GestureHandler` provides touch gesture recognition for Gea applications. It registers gesture events with the component system, so they work via event delegation like all standard DOM events.

## Import

The gesture handler is automatically initialized when you import from `gea-mobile`. No explicit setup is needed.

## Supported Gestures

| Event | Description |
| --- | --- |
| `tap` | Quick touch and release |
| `longTap` | Touch and hold (~500ms) |
| `swipeRight` | Horizontal swipe to the right |
| `swipeLeft` | Horizontal swipe to the left |
| `swipeUp` | Vertical swipe upward |
| `swipeDown` | Vertical swipe downward |

## Usage in JSX

Use gesture event names as attributes, just like standard events:

```jsx
class MyView extends View {
  template() {
    return (
      <view>
        <div tap={this.handleTap}>Tap me</div>
        <div longTap={this.handleLongTap}>Long press me</div>
        <div swipeRight={this.handleSwipe}>Swipe me</div>
      </view>
    )
  }
}
```

## How It Works

The `GestureHandler` uses `touchstart`, `touchmove`, and `touchend` events to detect gesture patterns. When a gesture is recognized, it dispatches a custom event (`tap`, `swipeRight`, etc.) that propagates through the normal event delegation system.

This means gesture events:

- Bubble up through the DOM like standard events
- Are handled via event delegation (one global listener, not per-element)
- Can be intercepted at any level of the component hierarchy

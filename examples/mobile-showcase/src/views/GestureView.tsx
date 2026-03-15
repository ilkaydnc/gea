import { View } from 'gea-mobile'
import AppNavBar from '../components/AppNavBar'
import appStore from '../app-store'

export default class GestureView extends View {
  constructor() {
    super()
    this.hasSidebar = true
    this.supportsBackGesture = true
  }

  template() {
    return (
      <view>
        <AppNavBar
          title="Gestures"
          onBackTap={() => appStore.vm.push()}
          onMenuTap={() => appStore.vm.toggleSidebar()}
        />
        <div class="view-content gesture-content">
          <div class="gesture-instructions">
            <p>Try these gestures on the target area below:</p>
          </div>

          <div
            class="gesture-target"
            tap={() => appStore.addGestureLog('tap')}
            longTap={() => appStore.addGestureLog('longTap')}
            swipeLeft={() => appStore.addGestureLog('swipeLeft')}
            swipeRight={() => appStore.addGestureLog('swipeRight')}
            swipeUp={() => appStore.addGestureLog('swipeUp')}
            swipeDown={() => appStore.addGestureLog('swipeDown')}
          >
            <div class="gesture-target-label">Touch here</div>
            <div class="gesture-target-icons">
              <span>tap</span>
              <span>long tap</span>
              <span>swipe</span>
            </div>
          </div>

          <div class="gesture-log-header">
            <h3>Event Log</h3>
            <button class="gesture-clear-btn" tap={appStore.clearGestureLog}>
              Clear
            </button>
          </div>

          <div class="gesture-log">
            {appStore.gestureLog.length === 0 ? (
              <div class="gesture-log-empty">No gestures detected yet</div>
            ) : (
              appStore.gestureLog.map((entry) => (
                <div key={entry.id} class={`gesture-log-entry gesture-${entry.gesture}`}>
                  <span class="gesture-log-name">{entry.gesture}</span>
                  <span class="gesture-log-time">{entry.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </view>
    )
  }
}

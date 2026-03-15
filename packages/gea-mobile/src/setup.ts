import { ComponentManager } from 'gea'
import GestureHandler from './lib/gesture-handler'

const gestureEvents = ['tap', 'longTap', 'swipeRight', 'swipeUp', 'swipeLeft', 'swipeDown']

ComponentManager.registerEventTypes(gestureEvents)
ComponentManager.installEventPlugin((manager) => {
  ;(manager as any).gestureHandler = new GestureHandler()
})

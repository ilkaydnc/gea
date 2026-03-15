import { Sidebar, ViewManager } from 'gea-mobile'
import AppSidebar from './components/AppSidebar'
import HomeView from './views/HomeView'
import FeedView from './views/FeedView'
import TabDemoView from './views/TabDemoView'
import GestureView from './views/GestureView'
import appStore from './app-store'
import './styles.css'

type ViewName = 'home' | 'feed' | 'tabs' | 'gestures'

const vm = new ViewManager()
appStore.vm = vm

const sidebar = new AppSidebar()
sidebar.vm = vm
sidebar.render()

const viewFactories: Record<ViewName, () => object> = {
  home: () => {
    const v = new HomeView()
    v.onNavigate = (name: ViewName) => navigateTo(name, true)
    return v
  },
  feed: () => new FeedView(),
  tabs: () => new TabDemoView(),
  gestures: () => new GestureView(),
}

function navigateTo(viewName: ViewName, canGoBack = false): void {
  const factory = viewFactories[viewName]
  if (!factory) return

  const view = factory()
  vm.pull(view, canGoBack)
}

vm.setCurrentView(viewFactories.home())

sidebar.on(Sidebar.EventType.SWITCH_VIEW, ({ view }: { view: ViewName }) => {
  const factory = viewFactories[view]
  if (!factory) return

  vm.setCurrentView(factory())
})

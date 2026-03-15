import { Sidebar } from 'gea-mobile'

export default class AppSidebar extends Sidebar {
  template_items() {
    return [
      <sidebar-item data-view="home">
        <sidebar-label>Home</sidebar-label>
      </sidebar-item>,
      <sidebar-item data-view="feed">
        <sidebar-label>Feed</sidebar-label>
      </sidebar-item>,
      <sidebar-item data-view="tabs">
        <sidebar-label>Tabs</sidebar-label>
      </sidebar-item>,
      <sidebar-item data-view="gestures">
        <sidebar-label>Gestures</sidebar-label>
      </sidebar-item>,
    ]
  }
}

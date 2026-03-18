import { Component } from 'gea'
import { Outlet } from 'gea-router'

export default class SettingsLayout extends Component {
  template({ activeKey, keys, navigate }) {
    return (
      <div class="settings-layout">
        <h1>Settings</h1>
        <div class="settings-tabs">
          {keys.map((key: string) => (
            <button
              class={key === activeKey ? 'tab active' : 'tab'}
              click={() => navigate(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
        <div class="settings-content"><Outlet /></div>
      </div>
    )
  }
}

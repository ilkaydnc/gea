import { Component } from 'gea'
import authStore from '../stores/auth-store'

export default class Overview extends Component {
  template() {
    return (
      <div class="view overview">
        <h1>Dashboard</h1>
        <p>Welcome back, {authStore.user?.name}!</p>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">3</div>
            <div class="stat-label">Projects</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">12</div>
            <div class="stat-label">Tasks</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">5</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
      </div>
    )
  }
}

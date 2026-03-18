import { Component } from 'gea'
import authStore from '../stores/auth-store'

export default class ProfileSettings extends Component {
  template() {
    return (
      <div class="view settings-tab">
        <h2>Profile</h2>
        <div class="form-group">
          <label>Name</label>
          <input type="text" value={authStore.user?.name || ''} />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" value={authStore.user?.email || ''} />
        </div>
        <button class="btn-primary">Save Profile</button>
      </div>
    )
  }
}

import { Component } from 'gea'

export default class BillingSettings extends Component {
  template() {
    return (
      <div class="view settings-tab">
        <h2>Billing</h2>
        <p>Manage your billing information and subscription.</p>
        <div class="billing-card">
          <h3>Current Plan</h3>
          <p>Free Tier</p>
          <button class="btn-primary">Upgrade</button>
        </div>
      </div>
    )
  }
}

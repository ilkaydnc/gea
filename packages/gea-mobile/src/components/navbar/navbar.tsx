import { Component } from 'gea'
import './navbar.css'

export interface NavBarOptions {
  hasBackButton: boolean
  hasMenuButton: boolean
  title: string
}

export default class NavBar extends Component {
  vm: any
  config: NavBarOptions

  constructor(opt_config: NavBarOptions = { hasBackButton: false, hasMenuButton: false, title: '' }) {
    super()
    this.vm = null
    this.config = opt_config
  }

  onBackButtonTap(): void {
    this.vm && this.vm.push()
  }

  onMenuButtonTap(): void {
    this.vm && this.vm.toggleSidebar()
  }

  template() {
    const { hasBackButton, hasMenuButton, title } = this.config

    return (
      <nav-bar>
        {hasBackButton && <back-button tap={this.onBackButtonTap}></back-button>}
        {hasMenuButton && <menu-button tap={this.onMenuButtonTap}></menu-button>}
        {title}
      </nav-bar>
    )
  }
}

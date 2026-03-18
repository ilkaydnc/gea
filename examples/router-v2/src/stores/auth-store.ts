import { Store } from 'gea'

class AuthStore extends Store {
  user: { name: string; email: string } | null = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null

  login(name: string, email: string) {
    this.user = { name, email }
    localStorage.setItem('user', JSON.stringify(this.user))
  }

  logout() {
    this.user = null
    localStorage.removeItem('user')
  }
}

const authStore = new AuthStore()
export default authStore

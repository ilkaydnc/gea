import { Component } from 'gea'
import { Link, RouterView } from 'gea'
import Home from './views/Home'
import About from './views/About'
import UserProfile from './views/UserProfile'

export default class App extends Component {
  template() {
    return (
      <div class="app">
        <nav class="nav">
          <Link to="/" label="Home" />
          <Link to="/about" label="About" />
          <Link to="/users/1" label="Alice" />
          <Link to="/users/2" label="Bob" />
          <Link to="/users/3" label="Charlie" />
        </nav>
        <main class="content">
          <RouterView
            routes={[
              { path: '/', component: Home },
              { path: '/about', component: About },
              { path: '/users/:id', component: UserProfile },
            ]}
          />
        </main>
      </div>
    )
  }
}

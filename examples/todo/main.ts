import TodoApp from './todo-app'
import './styles.css'

const app = document.getElementById('app')
if (!app) throw new Error('App root element not found')

const view = new TodoApp()
view.render(app)

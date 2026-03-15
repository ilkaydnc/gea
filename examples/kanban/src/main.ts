import KanbanApp from './kanban-app'
import './styles.css'

const app = document.getElementById('app')
if (!app) throw new Error('App root element not found')

const view = new KanbanApp()
view.render(app)

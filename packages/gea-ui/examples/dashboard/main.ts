import App from './app'
import '../../src/styles/theme.css'
import './styles.css'

const root = document.getElementById('app')
if (!root) throw new Error('App root element not found')

const app = new App()
app.render(root)

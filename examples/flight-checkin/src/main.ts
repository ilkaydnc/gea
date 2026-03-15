import FlightCheckin from './flight-checkin'
import './styles.css'

const app = document.getElementById('app')
if (!app) throw new Error('App root element not found')

const view = new FlightCheckin()
view.render(app)

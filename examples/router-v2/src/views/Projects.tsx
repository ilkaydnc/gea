import { Component } from 'gea'

const projects = [
  { id: '1', name: 'Website Redesign', status: 'In Progress' },
  { id: '2', name: 'Mobile App', status: 'Planning' },
  { id: '3', name: 'API Integration', status: 'Done' },
]

export default class Projects extends Component {
  template() {
    return (
      <div class="view projects">
        <h1>Projects</h1>
        <div class="project-list">
          {projects.map(p => (
            <div class="project-card">
              <div class="project-info">
                <h3>{p.name}</h3>
                <span class="project-status">{p.status}</span>
              </div>
              <a href={`/dashboard/projects/${p.id}`} class="btn-link">View</a>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

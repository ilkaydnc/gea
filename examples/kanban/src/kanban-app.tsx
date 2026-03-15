import { Component } from 'gea'
import kanbanStore from './kanban-store'
import KanbanColumn from './components/KanbanColumn'
import TaskModal from './components/TaskModal'

export default class KanbanApp extends Component {
  template() {
    const { columns } = kanbanStore

    return (
      <div class="kanban-app">
        <header class="kanban-header">
          <h1>Board</h1>
        </header>
        <div class="kanban-board">
          {columns.map((column) => (
            <KanbanColumn key={column.id} column={column} />
          ))}
        </div>
        {kanbanStore.selectedTaskId && <TaskModal />}
      </div>
    )
  }
}

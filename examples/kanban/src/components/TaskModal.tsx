import { Component } from 'gea'
import kanbanStore from '../kanban-store'

export default class TaskModal extends Component {
  template() {
    const task = kanbanStore.selectedTask
    if (!task) return null

    return (
      <div
        class="kanban-modal-backdrop"
        click={(e: MouseEvent) =>
          (e.target as HTMLElement).classList?.contains('kanban-modal-backdrop') && kanbanStore.closeTask()
        }
      >
        <div class="kanban-modal" click={(e: MouseEvent) => e.stopPropagation()}>
          <div class="kanban-modal-header">
            <h2 class="kanban-modal-title">{task.title}</h2>
            <button class="kanban-modal-close" click={kanbanStore.closeTask} aria-label="Close">
              ×
            </button>
          </div>
          <div class="kanban-modal-body">
            <div class="kanban-modal-field">
              <span class="kanban-modal-label">Description</span>
              <p class={`kanban-modal-value ${task.description ? '' : 'empty'}`}>
                {task.description || 'No description'}
              </p>
            </div>
            <div class="kanban-modal-field">
              <span class="kanban-modal-label">Priority</span>
              <p class="kanban-modal-value">{task.priority}</p>
            </div>
            {task.assignee && (
              <div class="kanban-modal-field">
                <span class="kanban-modal-label">Assignee</span>
                <p class="kanban-modal-value">{task.assignee}</p>
              </div>
            )}
          </div>
          <div class="kanban-modal-footer">
            <button class="kanban-btn kanban-btn-danger" click={() => kanbanStore.deleteTask(task.id)}>
              Delete
            </button>
            <button class="kanban-btn kanban-btn-ghost" click={kanbanStore.closeTask}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
}

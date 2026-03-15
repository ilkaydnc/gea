import { Component } from 'gea'
import kanbanStore from '../kanban-store'
import type { Column } from '../kanban-store'

interface KanbanColumnProps {
  column: Column
}

export default class KanbanColumn extends Component {
  declare props: KanbanColumnProps

  template({ column }: KanbanColumnProps) {
    const taskIds = column.taskIds
    const isDragOver = kanbanStore.dragOverColumnId === column.id
    const isAdding = kanbanStore.addingToColumnId === column.id

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      kanbanStore.setDragOver(column.id)
    }

    const handleDragLeave = (e: DragEvent) => {
      const related = e.relatedTarget as Node | null
      if (related && (e.currentTarget as HTMLElement).contains(related)) return
      kanbanStore.setDragOver(null)
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      kanbanStore.setDragOver(null)
      kanbanStore.setDragging(null)
      const raw = e.dataTransfer?.getData('application/json')
      if (!raw) return
      try {
        const { taskId, fromColumnId } = JSON.parse(raw)
        kanbanStore.moveTask(taskId, fromColumnId, column.id)
      } catch {
        /* ignore */
      }
    }

    return (
      <div
        class={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
        dragover={handleDragOver}
        dragleave={handleDragLeave}
        drop={handleDrop}
      >
        <div class="kanban-column-header">{column.title}</div>
        <div class="kanban-column-body">
          {taskIds.map((taskId: string) =>
            kanbanStore.tasks[taskId] ? (
              <div
                key={taskId}
                class={`kanban-card ${kanbanStore.draggingTaskId === taskId ? 'dragging' : ''}`}
                draggable="true"
                dragstart={(e: DragEvent) => {
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/json', JSON.stringify({ taskId, fromColumnId: column.id }))
                  }
                  kanbanStore.setDragging(taskId)
                }}
                dragend={() => {
                  kanbanStore.setDragging(null)
                  kanbanStore.setDragOver(null)
                }}
                click={() => kanbanStore.openTask(taskId)}
              >
                <div class="kanban-card-title">{kanbanStore.tasks[taskId].title}</div>
                <div class="kanban-card-meta">
                  <span class={`kanban-card-priority ${kanbanStore.tasks[taskId].priority}`} />
                  {kanbanStore.tasks[taskId].assignee && <span>{kanbanStore.tasks[taskId].assignee}</span>}
                </div>
              </div>
            ) : null,
          )}
          {isAdding ? (
            <div class="kanban-add-form">
              <input
                type="text"
                placeholder="Task title"
                value={kanbanStore.draftTitle}
                input={kanbanStore.setDraftTitle}
                keydown={(e: { key: string; preventDefault: () => void }) => {
                  if (e.key === 'Enter') kanbanStore.addTask(column.id)
                  if (e.key === 'Escape') kanbanStore.cancelAdding()
                }}
              />
              <div class="kanban-add-form-actions">
                <button class="kanban-btn kanban-btn-primary" click={() => kanbanStore.addTask(column.id)}>
                  Add
                </button>
                <button class="kanban-btn kanban-btn-ghost" click={kanbanStore.cancelAdding}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button class="kanban-add-task" click={() => kanbanStore.startAdding(column.id)}>
              + Add task
            </button>
          )}
        </div>
      </div>
    )
  }
}

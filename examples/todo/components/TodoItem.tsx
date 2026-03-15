import { Component } from 'gea'
import type { Todo } from '../todo-store'

interface TodoItemProps {
  todo: Todo
  onToggle: () => void
  onRemove: () => void
  onRename: (text: string) => void
}

interface TextInputEvent {
  target: {
    value: string
  }
}

interface KeyEventLike {
  key: string
}

export default class TodoItem extends Component {
  declare props: TodoItemProps

  editing = false
  editText = ''

  startEditing(): void {
    if (this.editing) return
    this.editing = true
    this.editText = this.props.todo.text
  }

  commit(): void {
    this.editing = false
    const val = this.editText.trim()
    if (val && val !== this.props.todo.text) this.props.onRename(val)
  }

  handleKeyDown(e: KeyEventLike): void {
    if (e.key === 'Enter') this.commit()
    if (e.key === 'Escape') {
      this.editText = this.props.todo.text
      this.editing = false
    }
  }

  handleEditInput(e: TextInputEvent): void {
    this.editText = e.target.value
  }

  template({ todo, onToggle, onRemove }: TodoItemProps) {
    const { editing, editText } = this

    return (
      <li class={`todo-item ${todo.done ? 'done' : ''} ${editing ? 'editing' : ''}`}>
        <input type="checkbox" checked={todo.done} change={onToggle} class="todo-checkbox" />
        <span class="todo-text" dblclick={this.startEditing}>
          {todo.text}
        </span>
        {editing && (
          <input
            class="todo-edit"
            type="text"
            value={editText}
            input={this.handleEditInput}
            blur={this.commit}
            keydown={this.handleKeyDown}
          />
        )}
        <button class="todo-remove" click={onRemove} aria-label="Remove">
          ×
        </button>
      </li>
    )
  }
}

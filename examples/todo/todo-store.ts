import { Store } from 'gea'

export type Filter = 'all' | 'active' | 'completed'

export interface Todo {
  id: string
  text: string
  done: boolean
}

function uid(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

class TodoStore extends Store {
  todos: Todo[] = []
  filter: Filter = 'all'
  draft = ''

  setDraft(e: { target: { value: string } }): void {
    this.draft = e.target.value
  }

  add(text?: string): void {
    const t = (text ?? this.draft).trim()
    if (!t) return
    this.draft = ''
    this.todos.push({ id: uid(), text: t, done: false })
  }

  toggle(id: string): void {
    const todo = this.todos.find((t) => t.id === id)
    if (todo) todo.done = !todo.done
  }

  remove(id: string): void {
    this.todos = this.todos.filter((t) => t.id !== id)
  }

  rename(id: string, text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const todo = this.todos.find((t) => t.id === id)
    if (todo) todo.text = trimmed
  }

  setFilter(filter: Filter): void {
    this.filter = filter
  }

  get filteredTodos(): Todo[] {
    const { todos, filter } = this
    if (filter === 'active') return todos.filter((t) => !t.done)
    if (filter === 'completed') return todos.filter((t) => t.done)
    return todos
  }

  get activeCount(): number {
    return this.todos.filter((t) => !t.done).length
  }

  get completedCount(): number {
    return this.todos.filter((t) => t.done).length
  }
}

export default new TodoStore()

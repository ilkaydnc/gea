import { Store } from 'gea'

class TodoStore extends Store {
  todos: Array<{ id: number; text: string; done: boolean }> = []
  filter: 'all' | 'active' | 'completed' = 'all'
  draft = ''
  nextId = 1

  add(text: string) {
    this.todos = [...this.todos, { id: this.nextId++, text, done: false }]
  }

  toggle(id: number) {
    const todo = this.todos.find((t) => t.id === id)
    if (todo) todo.done = !todo.done
  }

  remove(id: number) {
    this.todos = this.todos.filter((t) => t.id !== id)
  }

  setFilter(f: 'all' | 'active' | 'completed') {
    this.filter = f
  }

  get filteredTodos() {
    const { todos, filter } = this
    if (filter === 'active') return todos.filter((t) => !t.done)
    if (filter === 'completed') return todos.filter((t) => t.done)
    return todos
  }

  get activeCount() {
    return this.todos.filter((t) => !t.done).length
  }

  get completedCount() {
    return this.todos.filter((t) => t.done).length
  }
}

export default new TodoStore()

# Computed Values

Use **getters** on stores for derived state. Getters re-evaluate on every access — since the Vite plugin tracks which state paths the template reads, changes to the underlying data trigger a template update, which re-calls the getter and gets the new computed value.

## Basic Getters

```ts
import { Store } from 'gea'

class TodoStore extends Store {
  todos = []
  filter = 'all'
  draft = ''

  get filteredTodos() {
    const { todos, filter } = this
    if (filter === 'active') return todos.filter(t => !t.done)
    if (filter === 'completed') return todos.filter(t => t.done)
    return todos
  }

  get activeCount() {
    return this.todos.filter(t => !t.done).length
  }

  get completedCount() {
    return this.todos.filter(t => t.done).length
  }
}

export default new TodoStore()
```

## Using Computed Values in Templates

Access getters through the store instance, not through `state`:

```jsx
import todoStore from './todo-store'

export default class App extends Component {
  template() {
    const todos = todoStore.filteredTodos
    const count = todoStore.activeCount

    return (
      <div>
        <span>{count} items left</span>
        <ul>
          {todos.map(todo => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      </div>
    )
  }
}
```

## How It Works

Getters are not memoized. They re-evaluate every time they are accessed. This keeps the implementation simple and predictable.

The reactivity flow:

1. The template reads `todoStore.filteredTodos`, which internally reads `this.todos` and `this.filter`
2. The Vite plugin detects these state path accesses and generates `observe()` calls for `todos` and `filter`
3. When either path changes, the observer fires, the template patch re-evaluates the getter, and the DOM is updated with the new result

## Cross-Store Computed Values

Since stores are singletons, a getter in one store can read state from another:

```ts
import optionsStore from './options-store'

class FlightStore extends Store {
  step = 1

  get totalPrice() {
    return optionsStore.luggagePrice + optionsStore.seatPrice + optionsStore.mealPrice
  }
}
```

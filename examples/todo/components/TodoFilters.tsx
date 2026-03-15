import type { Filter } from '../todo-store'

interface TodoFiltersProps {
  filter: Filter
  activeCount: number
  completedCount: number
  onFilter: (filter: Filter) => void
}

export default function TodoFilters({ filter, activeCount, completedCount, onFilter }: TodoFiltersProps) {
  return (
    <div class="todo-filters">
      <span class="todo-count">
        {activeCount} {activeCount === 1 ? 'item' : 'items'} left
      </span>
      <div class="filter-buttons">
        <button class={`filter-btn ${filter === 'all' ? 'active' : ''}`} click={() => onFilter('all')}>
          All
        </button>
        <button class={`filter-btn ${filter === 'active' ? 'active' : ''}`} click={() => onFilter('active')}>
          Active
        </button>
        <button class={`filter-btn ${filter === 'completed' ? 'active' : ''}`} click={() => onFilter('completed')}>
          Completed
        </button>
      </div>
      {completedCount > 0 && <span class="todo-count completed">{completedCount} completed</span>}
    </div>
  )
}

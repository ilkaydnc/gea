interface TextInputEvent {
  target: {
    value: string
  }
}

interface KeyEventLike {
  key: string
}

interface TodoInputProps {
  draft: string
  onDraftChange: (event: TextInputEvent) => void
  onAdd: () => void
}

export default function TodoInput({ draft, onDraftChange, onAdd }: TodoInputProps) {
  const handleKeyDown = (e: KeyEventLike) => {
    if (e.key === 'Enter') onAdd()
  }

  return (
    <div class="todo-input-wrap">
      <input
        class="todo-input"
        type="text"
        placeholder="What needs to be done?"
        value={draft}
        input={onDraftChange}
        keydown={handleKeyDown}
      />
      <button class="btn btn-primary" click={onAdd}>
        Add
      </button>
    </div>
  )
}

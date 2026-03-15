# Rendering

## Conditional Rendering

Use `&&` for conditional blocks:

```jsx
{step === 1 && <StepOne onContinue={() => store.setStep(2)} />}
{step === 2 && <StepTwo onBack={() => store.setStep(1)} />}
```

Use ternary for either/or:

```jsx
{!paymentComplete
  ? <PaymentForm onPay={handlePay} />
  : <div class="success">Payment complete</div>
}
```

Under the hood, conditional children are compiled into `<template>` markers with swap logic — no wasted DOM nodes when the condition is false.

## List Rendering

Use `.map()` with a `key` prop to render arrays:

```jsx
<ul>
  {todos.map(todo => (
    <TodoItem
      key={todo.id}
      todo={todo}
      onToggle={() => store.toggle(todo.id)}
      onRemove={() => store.remove(todo.id)}
    />
  ))}
</ul>
```

The `key` prop is **required** for efficient list diffing. Gea uses `applyListChanges` internally to handle:

- **Append** — new items added to the end
- **Delete** — items removed from any position
- **Add** — items inserted at any position
- **Reorder** — items moved (e.g., after `sort`)
- **Swap** — two items exchanged positions

Only the DOM nodes that actually changed are touched — unchanged items stay in place.

Callbacks inside `.map()` use event delegation. The framework resolves which array item was targeted using `data-gea-item-id` attributes that the Vite plugin generates automatically.

## Initial Rendering

Components are instantiated with `new` and inserted into the DOM with `.render()`:

```ts
import App from './app'

const app = new App()
app.render(document.getElementById('app'))
```

The `render(rootEl, index?)` method:

1. Evaluates the `template()` method to produce an HTML string
2. Parses that string into a DOM element
3. Inserts it into the given parent element
4. Sets up reactive observers for all state paths used in the template

After the initial render, the component never re-renders its entire template. State changes trigger surgical patches — only the specific DOM nodes that depend on the changed state paths are updated.

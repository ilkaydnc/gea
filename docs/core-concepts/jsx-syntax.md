# JSX Syntax

Gea uses JSX that is close to standard HTML. The Vite plugin transforms it into HTML template strings at build time — there is no `createElement` or virtual DOM at runtime.

## Attributes

| Gea | HTML equivalent | Notes |
| --- | --- | --- |
| `class="foo"` | `class="foo"` | Use `class`, not `className` |
| `` class={`btn ${active ? 'on' : ''}`} `` | Dynamic class | Template literal for dynamic classes |
| `value={text}` | `value="..."` | For input elements |
| `checked={bool}` | `checked` | For checkboxes |
| `disabled={bool}` | `disabled` | For buttons/inputs |
| `aria-label="Close"` | `aria-label="Close"` | ARIA attributes pass through |

## Event Attributes

Both native-style (`click`, `change`) and React-style (`onClick`, `onChange`) event attribute names are supported. Native-style is preferred by convention.

```jsx
<button click={handleClick}>Click</button>
<input input={handleInput} />
<input change={handleChange} />
<input keydown={handleKeyDown} />
<input blur={handleBlur} />
<input focus={handleFocus} />
<span dblclick={handleDoubleClick}>Text</span>
```

Supported events: `click`, `dblclick`, `input`, `change`, `keydown`, `keyup`, `blur`, `focus`, `mousedown`, `mouseup`, `submit`, `dragstart`, `dragend`, `dragover`, `dragleave`, `drop`.

With `gea-mobile`: `tap`, `longTap`, `swipeRight`, `swipeUp`, `swipeLeft`, `swipeDown`.

Event handlers receive the native DOM event:

```jsx
const handleInput = e => {
  store.setName(e.target.value)
}
```

## Differences from React

| Feature | Gea | React |
| --- | --- | --- |
| CSS classes | `class="foo"` | `className="foo"` |
| Event handlers | `click={fn}` or `onClick={fn}` | `onClick={fn}` |
| Input events | `input={fn}` or `onInput={fn}` | `onChange={fn}` |
| Keyboard events | `keydown={fn}` or `onKeyDown={fn}` | `onKeyDown={fn}` |
| Checked inputs | `checked={bool}` + `change={fn}` | `checked={bool}` + `onChange={fn}` |

## Text Interpolation

Use curly braces for dynamic content:

```jsx
<span>{count}</span>
<span>{user.name}</span>
<span>{activeCount} {activeCount === 1 ? 'item' : 'items'} left</span>
```

## Component Tags

Components are referenced by their import name in PascalCase. The Vite plugin converts them to kebab-case custom elements internally and passes props via `data-prop-*` attributes.

```jsx
import TodoItem from './todo-item'

<TodoItem todo={todo} onToggle={() => store.toggle(todo.id)} />
```

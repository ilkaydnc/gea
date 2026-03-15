import Component from '../base/component'
import { router } from '../router'

export default class Link extends Component {
  template(props: { to: string; label: string; class?: string }) {
    const { to, label } = props
    return (
      <a
        href={to}
        class={props.class || ''}
        click={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          router.navigate(to)
        }}
      >
        {label}
      </a>
    )
  }
}

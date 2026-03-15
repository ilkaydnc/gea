import { Component } from 'gea'
import { cn } from '../utils/cn'

export default class Label extends Component {
  template(props: any) {
    return (
      <label
        class={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          props.class,
        )}
        for={props.htmlFor}
      >
        {props.children}
      </label>
    )
  }
}

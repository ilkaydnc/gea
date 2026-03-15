import { Component } from 'gea'
import { cn } from '../utils/cn'

export default class Separator extends Component {
  template(props: any) {
    const isVertical = props.orientation === 'vertical'

    return (
      <div
        class={cn(
          'shrink-0 bg-border',
          isVertical ? 'h-full w-[1px]' : 'h-[1px] w-full',
          props.class,
        )}
        role="separator"
        aria-orientation={props.orientation || 'horizontal'}
      ></div>
    )
  }
}

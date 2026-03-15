import { Component } from 'gea'
import { cn } from '../utils/cn'

export default class Skeleton extends Component {
  template(props: any) {
    return (
      <div class={cn('animate-pulse rounded-md bg-primary/10', props.class)}></div>
    )
  }
}

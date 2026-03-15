import { Component } from 'gea'
import { cn } from '../utils/cn'

export class Card extends Component {
  template(props: any) {
    return (
      <div class={cn('rounded-xl border bg-card text-card-foreground shadow', props.class)}>
        {props.children}
      </div>
    )
  }
}

export class CardHeader extends Component {
  template(props: any) {
    return (
      <div class={cn('flex flex-col space-y-1.5 p-6', props.class)}>
        {props.children}
      </div>
    )
  }
}

export class CardTitle extends Component {
  template(props: any) {
    return (
      <h3 class={cn('font-semibold leading-none tracking-tight', props.class)}>
        {props.children}
      </h3>
    )
  }
}

export class CardDescription extends Component {
  template(props: any) {
    return (
      <p class={cn('text-sm text-muted-foreground', props.class)}>
        {props.children}
      </p>
    )
  }
}

export class CardContent extends Component {
  template(props: any) {
    return (
      <div class={cn('p-6 pt-0', props.class)}>
        {props.children}
      </div>
    )
  }
}

export class CardFooter extends Component {
  template(props: any) {
    return (
      <div class={cn('flex items-center p-6 pt-0', props.class)}>
        {props.children}
      </div>
    )
  }
}

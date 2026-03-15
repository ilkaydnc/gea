import { Component } from 'gea'
import { cn } from '../utils/cn'

const variants: Record<string, string> = {
  default: 'bg-background text-foreground',
  destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
}

export class Alert extends Component {
  template(props: any) {
    const variant = variants[props.variant || 'default'] || variants.default

    return (
      <div
        class={cn(
          'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
          variant,
          props.class,
        )}
        role="alert"
      >
        {props.children}
      </div>
    )
  }
}

export class AlertTitle extends Component {
  template(props: any) {
    return (
      <h5 class={cn('mb-1 font-medium leading-none tracking-tight', props.class)}>
        {props.children}
      </h5>
    )
  }
}

export class AlertDescription extends Component {
  template(props: any) {
    return (
      <div class={cn('text-sm [&_p]:leading-relaxed', props.class)}>
        {props.children}
      </div>
    )
  }
}

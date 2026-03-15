import * as slider from '@zag-js/slider'
import { normalizeProps } from '@zag-js/vanilla'
import ZagComponent from '../primitives/zag-component'
import type { SpreadMap } from '../primitives/zag-component'

export default class Slider extends ZagComponent {
  value: number[] = [0]

  createMachine(_props: any): any {
    return slider.machine
  }

  getMachineProps(props: any) {
    return {
      id: this.id,
      value: props.value,
      defaultValue: props.defaultValue ?? [50],
      min: props.min ?? 0,
      max: props.max ?? 100,
      step: props.step ?? 1,
      orientation: props.orientation ?? 'horizontal',
      disabled: props.disabled,
      readOnly: props.readOnly,
      name: props.name,
      'aria-label': props['aria-label'],
      onValueChange: (details: slider.ValueChangeDetails) => {
        this.value = details.value
        props.onValueChange?.(details)
      },
      onValueChangeEnd: props.onValueChangeEnd,
    }
  }

  connectApi(service: any) {
    return slider.connect(service, normalizeProps)
  }

  getSpreadMap(): SpreadMap {
    return {
      '[data-part="root"]': 'getRootProps',
      '[data-part="label"]': 'getLabelProps',
      '[data-part="control"]': 'getControlProps',
      '[data-part="track"]': 'getTrackProps',
      '[data-part="range"]': 'getRangeProps',
      '[data-part="thumb"]': (api, el) => {
        const index = parseInt((el as HTMLElement).dataset.index || '0', 10)
        return api.getThumbProps({ index })
      },
      '[data-part="hidden-input"]': (api, el) => {
        const index = parseInt((el as HTMLElement).dataset.index || '0', 10)
        return api.getHiddenInputProps({ index })
      },
    }
  }

  syncState(api: any) {
    this.value = api.value
  }

  template(props: any) {
    const thumbCount = props.thumbCount ?? 1
    const thumbs = Array.from({ length: thumbCount }, (_, i) => i)
    return (
      <div data-part="root" class={props.class || ''}>
        {props.label && (
          <div class="flex justify-between mb-2">
            <label data-part="label" class="slider-label text-sm font-medium">{props.label}</label>
          </div>
        )}
        <div data-part="control" class="slider-control relative flex items-center">
          <div data-part="track" class="slider-track relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
            <div data-part="range" class="slider-range absolute h-full bg-primary"></div>
          </div>
          {thumbs.map((i: number) => (
            <div>
              <div data-part="thumb" data-index={String(i)} class="slider-thumb block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"></div>
              <input data-part="hidden-input" data-index={String(i)} type="hidden" />
            </div>
          ))}
        </div>
      </div>
    )
  }
}

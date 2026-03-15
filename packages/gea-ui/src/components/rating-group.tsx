import * as ratingGroup from '@zag-js/rating-group'
import { normalizeProps } from '@zag-js/vanilla'
import ZagComponent from '../primitives/zag-component'
import type { SpreadMap } from '../primitives/zag-component'

export default class RatingGroup extends ZagComponent {
  value = 0

  createMachine(_props: any): any {
    return ratingGroup.machine
  }

  getMachineProps(props: any) {
    return {
      id: this.id,
      value: props.value,
      defaultValue: props.defaultValue,
      count: props.count ?? 5,
      allowHalf: props.allowHalf ?? false,
      readOnly: props.readOnly,
      disabled: props.disabled,
      name: props.name,
      form: props.form,
      onValueChange: (details: ratingGroup.ValueChangeDetails) => {
        this.value = details.value
        props.onValueChange?.(details)
      },
    }
  }

  connectApi(service: any) {
    return ratingGroup.connect(service, normalizeProps)
  }

  getSpreadMap(): SpreadMap {
    return {
      '[data-part="root"]': 'getRootProps',
      '[data-part="label"]': 'getLabelProps',
      '[data-part="control"]': 'getControlProps',
      '[data-part="hidden-input"]': 'getHiddenInputProps',
      '[data-part="item"]': (api, el) => {
        const index = parseInt((el as HTMLElement).dataset.index || '0', 10)
        return api.getItemProps({ index })
      },
    }
  }

  syncState(api: any) {
    this.value = api.value
  }

  template(props: any) {
    const count = props.count ?? 5
    const items = Array.from({ length: count }, (_, i) => i + 1)
    return (
      <div data-part="root" class={props.class || ''}>
        {props.label && <label data-part="label" class="rating-group-label text-sm font-medium mb-1 block">{props.label}</label>}
        <div data-part="control" class="rating-group-control flex gap-0.5">
          {items.map((i: number) => (
            <span data-part="item" data-index={String(i)} class="rating-group-item cursor-pointer text-xl text-muted-foreground data-[highlighted]:text-yellow-400 data-[checked]:text-yellow-400">
              &#x2605;
            </span>
          ))}
        </div>
        <input data-part="hidden-input" type="hidden" />
      </div>
    )
  }
}

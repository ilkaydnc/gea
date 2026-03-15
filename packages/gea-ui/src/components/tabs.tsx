import * as tabs from '@zag-js/tabs'
import { normalizeProps } from '@zag-js/vanilla'
import ZagComponent from '../primitives/zag-component'
import type { SpreadMap } from '../primitives/zag-component'

export default class Tabs extends ZagComponent {
  value: string | null = null

  createMachine(_props: any): any {
    return tabs.machine
  }

  getMachineProps(props: any) {
    return {
      id: this.id,
      value: props.value,
      defaultValue: props.defaultValue,
      orientation: props.orientation ?? 'horizontal',
      activationMode: props.activationMode ?? 'automatic',
      loopFocus: props.loopFocus ?? true,
      onValueChange: (details: tabs.ValueChangeDetails) => {
        this.value = details.value
        props.onValueChange?.(details)
      },
      onFocusChange: props.onFocusChange,
    }
  }

  connectApi(service: any) {
    return tabs.connect(service, normalizeProps)
  }

  getSpreadMap(): SpreadMap {
    return {
      '[data-part="root"]': 'getRootProps',
      '[data-part="list"]': 'getListProps',
      '[data-part="indicator"]': 'getIndicatorProps',
      '[data-part="trigger"]': (api, el) =>
        api.getTriggerProps({ value: (el as HTMLElement).dataset.value }),
      '[data-part="content"]': (api, el) =>
        api.getContentProps({ value: (el as HTMLElement).dataset.value }),
    }
  }

  syncState(api: any) {
    this.value = api.value
  }

  template(props: any) {
    const items = props.items || []
    return (
      <div data-part="root" class={props.class || ''}>
        <div data-part="list" class="tabs-list flex border-b border-gray-200">
          {items.map((item: any) => (
            <button
              data-part="trigger"
              data-value={item.value}
              class="tabs-trigger px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent data-[selected]:border-blue-500 data-[selected]:text-blue-600"
            >
              {item.label}
            </button>
          ))}
          <div data-part="indicator" class="tabs-indicator"></div>
        </div>
        {items.map((item: any) => (
          <div
            data-part="content"
            data-value={item.value}
            class="tabs-content p-4"
          >
            {item.content}
          </div>
        ))}
      </div>
    )
  }
}

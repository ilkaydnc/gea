import View from '../../lib/view'
import ViewManager from '../../lib/view-manager'
import './tab-view.css'

interface TabItemEvent {
  targetEl: Element
}

export default class TabView extends View {
  vm: ViewManager | null
  views: View[]
  activeItemIndex: number | null

  constructor() {
    super()
    this.vm = null
    this.views = []
    this.activeItemIndex = null
  }

  onAfterRender(): void {
    super.onAfterRender()

    const $views = this.$(this.mappings.VIEWS)
    if (!$views) throw new Error('TabView template must have <views>')

    this.vm = new ViewManager($views as unknown as Element)
    this.activateItem(0)
  }

  onItemTap(e: TabItemEvent): void {
    const activeItem = this.$(this.mappings.ACTIVE_ITEM)
    if (activeItem && activeItem == e.targetEl) return

    const items = this.$(this.mappings.ITEMS)
    const itemIndex = [].indexOf.call(items && items.children, e.targetEl)

    this.activateItem(itemIndex)
  }

  activateItem(index: number): void {
    if (index < 0) return

    this.deactivateActiveItem()
    const item = this.$$(this.mappings.ITEM)[index]
    item && item.classList.add('active')

    if (this.views && this.views[index]) {
      this.vm!.setCurrentView(this.views[index], true)
      this.views[index].el.classList.add('active')
    }

    this.activeItemIndex = index
  }

  activateItemByName(name: string): void {
    const child = this.$(this.mappings.ITEM + '[data-view=' + name + ']')
    if (!child) return

    const items = this.$(this.mappings.ITEMS)
    const itemIndex = [].indexOf.call(items && items.children, child)

    this.activateItem(itemIndex)
  }

  deactivateActiveItem(): void {
    const activeThings = this.$$(this.mappings.ACTIVE)
    activeThings.forEach((el) => el.classList.remove('active'))
  }

  template() {
    return (
      <tab-view>
        {this.template_views()}
        <tab-bar>
          <tab-items>{this.template_items()}</tab-items>
        </tab-bar>
      </tab-view>
    )
  }

  template_views(): any {
    return <views></views>
  }

  template_items(): any {
    return null
  }

  get mappings() {
    return {
      ITEM: 'tab-item',
      ITEMS: 'tab-items',
      ACTIVE: '.active',
      ACTIVE_ITEM: 'tab-items .active',
      ACTIVE_VIEW: 'views .active',
      VIEWS: 'views',
    }
  }

  get events() {
    return {
      touchend: {
        [this.mappings.ITEM]: this.onItemTap,
      },
    }
  }
}

interface OptionItemProps {
  label: string
  description?: string
  price: number
  selected: boolean
  onSelect: () => void
}

export default function OptionItem({ label, description, price, selected, onSelect }: OptionItemProps) {
  return (
    <div class={`option-item ${selected ? 'selected' : ''}`} click={onSelect}>
      <div>
        <div class="label">{label}</div>
        {description && <div class="description">{description}</div>}
      </div>
      <span class={`price ${price === 0 ? 'free' : ''}`}>{price === 0 ? 'Included' : `+$${price}`}</span>
    </div>
  )
}

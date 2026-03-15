import type { FlightOption } from '../shared/flight-data'
import OptionItem from './OptionItem'
import StepHeader from './StepHeader'

interface OptionStepProps {
  stepNumber: number
  title: string
  options: FlightOption[]
  selectedId: string
  showBack: boolean
  nextLabel?: string
  onSelect: (id: string) => void
  onBack?: () => void
  onContinue: () => void
}

export default function OptionStep({
  stepNumber,
  title,
  options,
  selectedId,
  showBack,
  nextLabel = 'Continue',
  onSelect,
  onBack,
  onContinue,
}: OptionStepProps) {
  return (
    <section class="section-card">
      <StepHeader stepNumber={stepNumber} title={title} />
      <div class="option-grid">
        {options.map((opt) => (
          <OptionItem
            key={opt.id}
            label={opt.label}
            description={opt.description}
            price={opt.price}
            selected={selectedId === opt.id}
            onSelect={() => onSelect(opt.id)}
          />
        ))}
      </div>
      <div class="nav-buttons">
        {showBack && (
          <button class="btn btn-secondary" click={onBack}>
            Back
          </button>
        )}
        <button class="btn btn-primary" click={onContinue}>
          {nextLabel}
        </button>
      </div>
    </section>
  )
}

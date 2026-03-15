interface StepHeaderProps {
  stepNumber: number
  title: string
}

export default function StepHeader({ stepNumber, title }: StepHeaderProps) {
  return (
    <div class="step-header">
      <span class="step-number">{stepNumber}</span>
      <h2>{title}</h2>
    </div>
  )
}

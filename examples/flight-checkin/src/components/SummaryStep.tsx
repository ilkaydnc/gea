import PaymentForm from './PaymentForm'
import StepHeader from './StepHeader'

interface TextInputEvent {
  target: {
    value: string
  }
}

interface SummaryStepProps {
  basePrice: number
  luggagePrice: number
  seatPrice: number
  mealPrice: number
  totalPrice: number
  paymentComplete: boolean
  passengerName: string
  cardNumber: string
  expiry: string
  onPassengerNameChange: (event: TextInputEvent) => void
  onCardNumberChange: (event: TextInputEvent) => void
  onExpiryChange: (event: TextInputEvent) => void
  onPay: () => void
  onBack: () => void
  onViewBoardingPass: () => void
}

export default function SummaryStep({
  basePrice,
  luggagePrice,
  seatPrice,
  mealPrice,
  totalPrice,
  paymentComplete,
  passengerName,
  cardNumber,
  expiry,
  onPassengerNameChange,
  onCardNumberChange,
  onExpiryChange,
  onPay,
  onBack,
  onViewBoardingPass,
}: SummaryStepProps) {
  return (
    <section class="section-card">
      <StepHeader stepNumber={4} title="Review & Payment" />
      <div class="summary-row">
        <span>Base fare</span>
        <span>${basePrice}</span>
      </div>
      <div class="summary-row">
        <span>Luggage</span>
        <span>+${luggagePrice}</span>
      </div>
      <div class="summary-row">
        <span>Seat</span>
        <span>+${seatPrice}</span>
      </div>
      <div class="summary-row">
        <span>Meal</span>
        <span>+${mealPrice}</span>
      </div>
      <div class="summary-row summary-total">
        <span>Total</span>
        <span>${totalPrice}</span>
      </div>

      {!paymentComplete ? (
        <PaymentForm
          passengerName={passengerName}
          cardNumber={cardNumber}
          expiry={expiry}
          totalPrice={totalPrice}
          onPassengerNameChange={onPassengerNameChange}
          onCardNumberChange={onCardNumberChange}
          onExpiryChange={onExpiryChange}
          onPay={onPay}
        />
      ) : (
        <div class="nav-buttons">
          <button class="btn btn-secondary" click={onBack}>
            Back
          </button>
          <button class="btn btn-primary" click={onViewBoardingPass}>
            View Boarding Pass
          </button>
        </div>
      )}
    </section>
  )
}

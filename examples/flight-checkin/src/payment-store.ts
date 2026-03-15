import { Store } from 'gea'

class PaymentStore extends Store {
  passengerName = ''
  cardNumber = ''
  expiry = ''
  paymentComplete = false

  formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  }

  formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2)
    }
    return digits
  }

  setPassengerName(e: { target: { value: string } }): void {
    this.passengerName = e.target.value
  }

  setCardNumber(e: { target: { value: string } }): void {
    this.cardNumber = this.formatCardNumber(e.target.value)
  }

  setExpiry(e: { target: { value: string } }): void {
    this.expiry = this.formatExpiry(e.target.value)
  }

  processPayment(): void {
    if (!this.passengerName.trim()) {
      this.passengerName = 'JOHN DOE'
    }
    this.paymentComplete = true
  }

  reset(): void {
    this.passengerName = ''
    this.cardNumber = ''
    this.expiry = ''
    this.paymentComplete = false
  }
}

export default new PaymentStore()

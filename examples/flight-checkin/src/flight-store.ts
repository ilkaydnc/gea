import { Store } from 'gea'
import { generateBoardingPass } from './shared/flight-data'
import optionsStore from './options-store'
import paymentStore from './payment-store'

interface BoardingPass {
  passengerName: string
  seat: string
  gate: string
  boardingGroup: string
  confirmationCode: string
  flightNumber: string
  departure: string
  arrival: string
  departureTime: string
  arrivalTime: string
  date: string
  duration: string
}

class FlightStore extends Store {
  step = 1
  boardingPass: BoardingPass | null = null

  setStep(step: number): void {
    this.step = step
    if (step === 5 && !this.boardingPass) {
      this.boardingPass = generateBoardingPass({
        passengerName: paymentStore.passengerName || 'JOHN DOE',
      }) as BoardingPass
    }
  }

  startOver(): void {
    this.step = 1
    this.boardingPass = null
    optionsStore.reset()
    paymentStore.reset()
  }
}

export default new FlightStore()

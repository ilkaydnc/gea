import { Store } from 'gea'
import { LUGGAGE_OPTIONS, SEAT_OPTIONS, MEAL_OPTIONS } from './shared/flight-data'

type LuggageId = (typeof LUGGAGE_OPTIONS)[number]['id']
type SeatId = (typeof SEAT_OPTIONS)[number]['id']
type MealId = (typeof MEAL_OPTIONS)[number]['id']

class OptionsStore extends Store {
  luggage: LuggageId = 'carry-on'
  seat: SeatId = 'economy'
  meal: MealId = 'none'

  setLuggage(id: LuggageId): void {
    this.luggage = id
  }

  setSeat(id: SeatId): void {
    this.seat = id
  }

  setMeal(id: MealId): void {
    this.meal = id
  }

  reset(): void {
    this.luggage = 'carry-on'
    this.seat = 'economy'
    this.meal = 'none'
  }

  get luggagePrice(): number {
    return LUGGAGE_OPTIONS.find((o) => o.id === this.luggage)?.price ?? 0
  }

  get seatPrice(): number {
    return SEAT_OPTIONS.find((o) => o.id === this.seat)?.price ?? 0
  }

  get mealPrice(): number {
    return MEAL_OPTIONS.find((o) => o.id === this.meal)?.price ?? 0
  }
}

export default new OptionsStore()

export interface FlightOption {
  id: string
  label: string
  price: number
  description?: string
}

export interface FlightInfo {
  flightNumber: string
  departure: string
  arrival: string
  departureTime: string
  arrivalTime: string
  date: string
  duration: string
}

export interface BoardingPass extends FlightInfo {
  passengerName: string
  seat: string
  gate: string
  boardingGroup: string
  confirmationCode: string
}

export const LUGGAGE_OPTIONS = [
  { id: 'carry-on', label: 'Carry-on bag (included)', price: 0 },
  { id: 'checked-1', label: '1 checked bag (23kg)', price: 35 },
  { id: 'checked-2', label: '2 checked bags (23kg each)', price: 65 },
  { id: 'checked-3', label: '3 checked bags (23kg each)', price: 95 },
]

export const SEAT_OPTIONS = [
  { id: 'economy', label: 'Economy', price: 0, description: 'Standard legroom' },
  { id: 'economy-plus', label: 'Economy Plus', price: 45, description: 'Extra legroom' },
  { id: 'premium', label: 'Premium Economy', price: 120, description: 'Wider seat, priority boarding' },
  { id: 'business', label: 'Business Class', price: 350, description: 'Lie-flat seat, lounge access' },
]

export const MEAL_OPTIONS = [
  { id: 'none', label: 'No meal', price: 0 },
  { id: 'vegetarian', label: 'Vegetarian', price: 12 },
  { id: 'chicken', label: 'Chicken', price: 15 },
  { id: 'beef', label: 'Beef', price: 18 },
  { id: 'seafood', label: 'Seafood', price: 22 },
  { id: 'special', label: 'Special dietary', price: 25 },
]

export const BASE_TICKET_PRICE = 199

export const FLIGHT_INFO: FlightInfo = {
  flightNumber: 'SK 452',
  departure: 'CPH',
  arrival: 'JFK',
  departureTime: '08:45',
  arrivalTime: '11:30',
  date: 'March 15, 2025',
  duration: '8h 45m',
}

export function generateBoardingPass(booking: { passengerName?: string }): BoardingPass {
  const seatRow = Math.floor(Math.random() * 30) + 1
  const seatLetter = ['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)]
  const gate = String(Math.floor(Math.random() * 50) + 1)
  const boardingGroup = ['A', 'B', 'C'][Math.floor(Math.random() * 3)]

  return {
    ...FLIGHT_INFO,
    passengerName: booking.passengerName || 'JOHN DOE',
    seat: `${seatRow}${seatLetter}`,
    gate,
    boardingGroup,
    confirmationCode: `SK${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  }
}

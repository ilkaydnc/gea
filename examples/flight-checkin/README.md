# Flight Check-in App

A realistic flight check-in app built with **Gea**. Users select luggage, seats, and meals (each with additional prices), review the total, complete a fake payment, and receive a boarding pass.

## Features

- **Step 1: Luggage** – Carry-on (included) or checked bags ($35–$95)
- **Step 2: Seat** – Economy (included) to Business ($0–$350)
- **Step 3: Meal** – No meal to special dietary ($0–$25)
- **Step 4: Payment** – Summary, passenger name, fake card form, pay button
- **Step 5: Boarding Pass** – Generated pass with confirmation code, seat, gate, etc.

## Running the app

```bash
npm install && npm run dev
```

## E2E tests

Playwright tests cover the full check-in flow:

```bash
npm install
npm run test:e2e
```

Tests start the Gea dev server automatically (or reuse it if already running). They cover:

- Full check-in flow: luggage → seat → meal → payment → boarding pass
- Back navigation between steps
- Payment form validation
- Copy confirmation code feedback

## Structure

```
flight-checkin/
├── src/
│   ├── shared/
│   │   └── flight-data.ts    # Options, prices, flight info, boarding pass generator
│   ├── components/
│   │   ├── StepHeader.tsx
│   │   ├── OptionItem.tsx
│   │   ├── OptionStep.tsx
│   │   ├── SummaryStep.tsx
│   │   ├── PaymentForm.tsx
│   │   └── BoardingPass.tsx
│   ├── flight-checkin.tsx
│   ├── flight-store.ts
│   ├── options-store.ts
│   ├── payment-store.ts
│   └── ...
└── README.md
```

import { test, expect } from '@playwright/test'

test.describe('Flight Check-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('#app >> .flight-checkin', { timeout: 15000 })
  })

  test('completes full check-in flow: luggage → seat → meal → payment → boarding pass', async ({ page }) => {
    // Step 1: Luggage
    await expect(page.getByRole('heading', { name: 'Select Luggage' })).toBeVisible()
    await page.getByText('1 checked bag').nth(0).click()
    await page.locator('.nav-buttons .btn-primary').click()

    // Step 2: Seat
    await expect(page.getByRole('heading', { name: 'Select Seat' })).toBeVisible()
    await page.getByText('Economy Plus').nth(0).click()
    await page.locator('.nav-buttons .btn-primary').click()

    // Step 3: Meal
    await expect(page.getByRole('heading', { name: 'Select Meal' })).toBeVisible()
    await page.getByText('Chicken').nth(0).click()
    await page.locator('.nav-buttons .btn-primary:has-text("Review & Pay")').click()

    // Step 4: Payment
    await expect(page.getByRole('heading', { name: 'Review & Payment' })).toBeVisible()
    await page.getByPlaceholder('Passenger name').fill('Jane Smith')
    await page.getByPlaceholder(/Card number/).fill('4242424242424242')
    await page.getByPlaceholder('MM/YY').fill('1228')
    await page.locator('.payment-form .btn-primary:has-text("Pay")').click()

    // View Boarding Pass
    await page.locator('.nav-buttons .btn-primary:has-text("View Boarding Pass")').click()

    // Step 5: Boarding pass
    await expect(page.locator('.success-message')).toHaveText(/Check-in complete!/)
    await expect(page.locator('.confirmation-code')).toBeVisible()
    const confirmationCode = page.locator('.confirmation-code')
    await expect(confirmationCode).toContainText(/SK[A-Z0-9]{6}/)

    // New Check-in
    await page.getByRole('button', { name: 'New Check-in' }).click()

    // Back at step 1
    await expect(page.getByRole('heading', { name: 'Select Luggage' })).toBeVisible()
  })

  test('Back navigation works correctly', async ({ page }) => {
    // Step 1 → 2
    await page.getByText('2 checked bags').nth(0).click()
    await page.locator('.nav-buttons .btn-primary').click()
    await expect(page.getByRole('heading', { name: 'Select Seat' })).toBeVisible()

    // Step 2 → 1 (Back)
    await page.locator('.nav-buttons .btn-secondary').click()
    await expect(page.getByRole('heading', { name: 'Select Luggage' })).toBeVisible()
    await expect(page.getByText('2 checked bags').nth(0).locator('..').locator('..')).toHaveClass(/selected/)

    // Step 1 → 2 → 3
    await page.locator('.nav-buttons .btn-primary').click()
    await page.getByText('Premium Economy').nth(0).click()
    await page.locator('.nav-buttons .btn-primary').click()
    await expect(page.getByRole('heading', { name: 'Select Meal' })).toBeVisible()

    // Step 3 → 2 (Back)
    await page.locator('.nav-buttons .btn-secondary').click()
    await expect(page.getByRole('heading', { name: 'Select Seat' })).toBeVisible()
    await expect(page.getByText('Premium Economy').nth(0).locator('..').locator('..')).toHaveClass(/selected/)
  })

  test('payment form validation prevents invalid submit', async ({ page }) => {
    // Navigate to payment step
    await page.locator('.nav-buttons .btn-primary').click()
    await page.locator('.nav-buttons .btn-primary').click()
    await page.locator('.nav-buttons .btn-primary:has-text("Review & Pay")').click()

    await expect(page.getByRole('heading', { name: 'Review & Payment' })).toBeVisible()

    // Pay button should be disabled when form is empty
    const payButton = page.locator('.payment-form .btn-primary:has-text("Pay")')
    await expect(payButton).toBeDisabled()

    // Fill invalid data - Pay should still be disabled
    await page.getByPlaceholder('Passenger name').fill('A') // too short
    await expect(payButton).toBeDisabled()

    await page.getByPlaceholder('Passenger name').fill('Jane Smith')
    await page.getByPlaceholder(/Card number/).fill('1234') // too short
    await expect(payButton).toBeDisabled()

    // Fill valid data - Pay should be enabled
    await page.getByPlaceholder(/Card number/).fill('4242424242424242')
    await page.getByPlaceholder('MM/YY').fill('1228')
    await expect(payButton).toBeEnabled()
  })

  test('copy confirmation code shows feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Complete flow to boarding pass
    await page.locator('.nav-buttons .btn-primary').click()
    await page.locator('.nav-buttons .btn-primary').click()
    await page.locator('.nav-buttons .btn-primary:has-text("Review & Pay")').click()
    await page.getByPlaceholder('Passenger name').fill('Test User')
    await page.getByPlaceholder(/Card number/).fill('4242424242424242')
    await page.getByPlaceholder('MM/YY').fill('1228')
    await page.locator('.payment-form .btn-primary:has-text("Pay")').click()
    await page.locator('.nav-buttons .btn-primary:has-text("View Boarding Pass")').click()

    await expect(page.locator('.success-message')).toBeVisible()

    // Click copy button
    const copyButton = page.locator('.confirmation-copy-button')
    await copyButton.click()

    // Should show copied state (button gets .copied class)
    await expect(page.locator('.confirmation-copy-button.copied')).toBeVisible({ timeout: 3000 })
  })
})

import { expect, test, type Page } from '@playwright/test'

/**
 * The public side, under the new rules: one doctor, ten-minute slots, no choice of
 * clinician anywhere, and a
 * request that is never dressed up as a confirmed booking.
 */

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })
const choose = (page: Page, text: string | RegExp) =>
  page.locator('.opt', { hasText: text }).first().click()

const pickFirstOpening = async (page: Page): Promise<{ day: string; time: string }> => {
  const openDay = page.getByRole('button', { name: /— \d+ times free$/ }).first()
  await expect(openDay).toBeVisible({ timeout: 15_000 })
  const day = ((await openDay.getAttribute('aria-label')) ?? '').split('—')[0].trim()
  await openDay.click()
  await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.slot').first().click()
  const time = (await page.locator('.slot--on .slot__time').innerText()).trim()
  return { day, time }
}

const startBooking = async (
  page: Page,
  options: { service: string | RegExp; patient: RegExp; clinic: string }
): Promise<void> => {
  await page.goto('/book/visit')
  await choose(page, options.service)
  await choose(page, options.patient)
  await continueButton(page).click()
  await choose(page, options.clinic)
  await continueButton(page).click()
}

test.describe('asking for an appointment', () => {
  test('asks only for a clinic, and names nobody while doing it', async ({ page }) => {
    await page.goto('/book/visit')
    await choose(page, 'Internal medicine')
    await choose(page, /first appointment/)
    await continueButton(page).click()

    // Step two is clinics only.
    await expect(page.getByRole('heading', { name: 'Where would you like to be seen?' })).toBeVisible()
    // The step itself names nobody: it asks for a clinic and nothing else. (The summary
    // beside it still states the doctor as fixed information, which is deliberate.)
    const step = (await page.locator('.step__title').locator('xpath=..').innerText()).toLowerCase()
    expect(step).not.toContain('dr. lorba')
    expect(step).not.toContain('clinician')
    await expect(page.locator('.opt', { hasText: 'First available' })).toHaveCount(0)

    await choose(page, 'Downtown')
    await continueButton(page).click()
    await pickFirstOpening(page)

    // The doctor is stated in the summary, as fixed information rather than a choice.
    await expect(page.locator('.sum')).toContainText('Doctor')
    await expect(page.locator('.sum')).toContainText('Dr. Lorba')
    await expect(page.locator('.sum')).not.toContainText('Clinician')
  })

  test('presents the site as one doctor across three clinics', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.logo').first()).toContainText('Dr. Lorba')
    await expect(page.locator('h1')).toContainText("Welcome to Dr. Lorba's practice")
    await expect(page.locator('.hero__clinics')).toHaveText('Downtown · Northside · Westside')
    await expect(page.locator('.hero__body')).toContainText('any of our three locations')

    // The two calls to action the brief asks for.
    await expect(page.locator('.hero').getByRole('link', { name: 'Request an appointment' })).toBeVisible()
    await expect(page.locator('.hero').getByRole('link', { name: 'Meet Dr. Lorba' })).toBeVisible()

    // Nothing anywhere claims a practice brand or a second clinician.
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).not.toContain('lorba medical')
    expect(body).not.toContain('our team')
  })

  test('shows the consulting rota and keeps it apart from opening hours', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Meet Dr. Lorba' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Consulting hours' })).toBeVisible()
    // One profile, not three.
    await expect(page.locator('.person')).toHaveCount(1)

    await page.goto('/locations')
    await expect(page.locator('.clinic').first()).toContainText('Clinic opening hours')
    await expect(page.locator('.clinic').first()).toContainText('Dr. Lorba consults')
  })

  test('offers times on a ten-minute grid', async ({ page }) => {
    await startBooking(page, {
      service: 'Internal medicine',
      patient: /been here before/,
      clinic: 'Downtown'
    })
    const openDay = page.getByRole('button', { name: /— \d+ times free$/ }).first()
    await openDay.click()
    await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })

    const times = await page.locator('.slot__time').allInnerTexts()
    expect(times.length).toBeGreaterThan(4)
    for (const label of times) {
      const minutes = Number(label.split(':')[1].slice(0, 2))
      expect(minutes % 10).toBe(0)
    }
  })

  test('says the time is subject to confirmation before anything is sent', async ({ page }) => {
    await startBooking(page, {
      service: 'Internal medicine',
      patient: /first appointment/,
      clinic: 'Downtown'
    })
    await pickFirstOpening(page)
    await expect(page.locator('.when__subject')).toContainText(
      'subject to confirmation by the clinic'
    )

    await continueButton(page).click()
    await expect(page.locator('.review__subject')).toContainText('subject to confirmation')
    await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()
  })

  test('ends on a request, not a confirmed booking', async ({ page }) => {
    await startBooking(page, {
      service: 'Annual wellness',
      patient: /first appointment/,
      clinic: 'Northside'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()
    await page.getByRole('button', { name: 'Use sample details' }).click()
    await page.getByRole('button', { name: 'Send request' }).click()
    await page.waitForURL(/\/booking\//, { timeout: 20_000 })

    await expect(page.getByRole('heading', { name: 'Request received.' })).toBeVisible()
    await expect(page.getByText('will check availability and confirm')).toBeVisible()
    await expect(page.getByText('no email and no text message is sent')).toBeVisible()

    // No calendar file, and nothing that calls it confirmed or guaranteed.
    await expect(page.getByRole('button', { name: /Add to calendar/ })).toHaveCount(0)
    await expect(page.getByText('A calendar file is offered once the clinic has confirmed')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Appointment confirmed')
  })

  test('keeps what was entered when stepping back and forward', async ({ page }) => {
    await startBooking(page, {
      service: 'Internal medicine',
      patient: /first appointment/,
      clinic: 'Downtown'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()

    await page.getByLabel('First name').fill('Robin')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.locator('.slot--on')).toHaveCount(1)
    await continueButton(page).click()
    await expect(page.getByLabel('First name')).toHaveValue('Robin')
  })

  test('refuses to send without the required fields, and flags a bad email', async ({ page }) => {
    await startBooking(page, {
      service: 'Internal medicine',
      patient: /first appointment/,
      clinic: 'Downtown'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()

    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page).toHaveURL(/\/book\/details/)
    await expect(page.getByText('Enter a first name.')).toBeVisible()

    await page.getByLabel('First name').fill('Robin')
    await page.getByLabel('Last name').fill('Hale')
    await page.getByLabel('Email').fill('robin-at-example')
    await page.getByLabel('Last name').click()
    await expect(page.getByText('Enter an email address in the form name@example.com.')).toBeVisible()
  })

  test('carries the quick picker and a clinic link into the flow', async ({ page }) => {
    await page.goto('/')
    await page.locator('.quick__form select').first().selectOption('follow-up')
    await page.locator('.quick__form select').nth(1).selectOption('northside')
    await page.locator('.quick__form button[type=submit]').click()
    await expect(page.locator('.sum')).toContainText('Follow-up visit')
    await expect(page.locator('.sum')).toContainText('Northside')

    await page.goto('/locations')
    await page.locator('#westside').getByRole('link', { name: 'Book at this clinic' }).click()
    await expect(page.locator('.sum')).toContainText('Westside')
  })

  test('keeps the request across a reload and a language change', async ({ page }) => {
    await page.goto('/book/visit')
    await choose(page, 'Annual wellness')
    await choose(page, /been here before/)
    await continueButton(page).click()
    await choose(page, 'Northside')

    await page.reload()
    await expect(page.locator('.sum')).toContainText('Annual wellness')

    await page.locator('.header__end').getByRole('button', { name: /^ES/ }).click()
    await expect(page.locator('.sum')).toContainText('Revisión anual')
    await expect(page.locator('.sum')).toContainText('Northside')
  })

  test('the doctor page does not lead into booking him by name', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('link', { name: /Book with/ })).toHaveCount(0)
    // The portrait is declared a stand-in, and no credentials are claimed.
    await expect(page.locator('.illustrative').first()).toBeVisible()
    await expect(page.locator('.note')).toContainText('No qualifications, registrations')
  })
})

import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end cover of the journey a client would be walked through. Each test gets a
 * fresh browser context, so the demo schedule starts from its seeded state every time.
 */

const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })
const confirmButton = (page: Page) => page.getByRole('button', { name: 'Confirm booking' })

/** Clicks an option card by the text it shows — what a visitor actually does. */
const choose = (page: Page, text: string | RegExp) =>
  page.locator('.opt', { hasText: text }).first().click()

/**
 * Picks the earliest opening through the calendar. Each day button announces how many
 * openings it holds, which makes "the first day with any" unambiguous.
 */
const pickFirstOpening = async (page: Page): Promise<{ day: string }> => {
  const openDay = page.getByRole('button', { name: /— \d+ openings?$/ }).first()
  await expect(openDay).toBeVisible({ timeout: 15_000 })
  // The date part of the label, without the opening count, which changes as we book.
  const day = ((await openDay.getAttribute('aria-label')) ?? '').split('—')[0].trim()
  await openDay.click()
  await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.slot').first().click()
  return { day }
}

const fillDetailsAndConfirm = async (page: Page): Promise<string> => {
  await page.getByRole('button', { name: 'Use sample details' }).click()
  await confirmButton(page).click()
  await page.waitForURL(/\/booking\//, { timeout: 20_000 })
  return (await page.locator('.ticket__ref').innerText()).trim()
}

/** Steps 1 and 2 with whatever was asked for, leaving the calendar on screen. */
const startBooking = async (
  page: Page,
  options: { service: string | RegExp; patient: RegExp; clinic: string; clinician: string | RegExp }
): Promise<void> => {
  await page.goto('/book/visit')
  await choose(page, options.service)
  await choose(page, options.patient)
  await continueButton(page).click()
  await choose(page, options.clinic)
  await choose(page, options.clinician)
  await continueButton(page).click()
}

test.describe('booking journey', () => {
  test('books from the main call to action', async ({ page }) => {
    await page.goto('/')
    // The header CTA is a real link, with an href.
    const cta = page.locator('.header__end').getByRole('link', { name: 'Book an appointment' })
    await expect(cta).toHaveAttribute('href', '/book')
    await cta.click()
    await expect(page).toHaveURL(/\/book\/visit/)

    await choose(page, 'Primary care')
    await choose(page, /first appointment/)
    await continueButton(page).click()

    await choose(page, 'Downtown')
    await choose(page, 'First available')
    await continueButton(page).click()

    await pickFirstOpening(page)
    await continueButton(page).click()

    const reference = await fillDetailsAndConfirm(page)
    expect(reference).toMatch(/^LM-[A-Z0-9]{4}$/)
    await expect(page.getByRole('heading', { name: 'That time is held.' })).toBeVisible()
  })

  test('carries a clinic through from a location page', async ({ page }) => {
    await page.goto('/locations')
    await page.locator('#westside').getByRole('link', { name: 'Book at this clinic' }).click()
    await expect(page).toHaveURL(/\/book\//)
    await expect(page.locator('.sum')).toContainText('Westside')
  })

  test('every clinic shows a plan of its own surroundings', async ({ page }) => {
    await page.goto('/locations')

    // One plan per clinic, not one shared between them.
    await expect(page.locator('.locator')).toHaveCount(3)

    // Each plan is drawn for that clinic: the landmarks differ.
    await expect(page.locator('#downtown .locator')).toContainText('Harbour')
    await expect(page.locator('#northside .locator')).toContainText('Library')
    await expect(page.locator('#westside .locator')).toContainText('Park')

    // And each says plainly that it is not a map of a real place.
    for (const caption of await page.locator('.locator__caption').allInnerTexts()) {
      expect(caption).toContain('not a map of a real place')
    }
  })

  test('carries both quick-picker values into the flow', async ({ page }) => {
    await page.goto('/')
    await page.locator('.quick__form select').first().selectOption('follow-up')
    await page.locator('.quick__form select').nth(1).selectOption('northside')
    await page.locator('.quick__form button[type=submit]').click()

    await expect(page).toHaveURL(/\/book\//)
    await expect(page.locator('.sum')).toContainText('Follow-up visit')
    await expect(page.locator('.sum')).toContainText('Northside')
  })

  test('supports any location with the first available clinician', async ({ page }) => {
    await startBooking(page, {
      service: 'Non-emergency consultation',
      patient: /been here before/,
      clinic: 'Any location',
      clinician: 'First available'
    })
    await pickFirstOpening(page)
    // The chosen opening resolves to a real clinic and a real clinician.
    await expect(page.locator('.when__chosen')).toContainText(/at (Downtown|Northside|Westside)/)
  })

  test('drops a chosen time when the appointment type changes', async ({ page }) => {
    await startBooking(page, {
      service: 'Primary care',
      patient: /been here before/,
      clinic: 'Any location',
      clinician: 'First available'
    })
    await pickFirstOpening(page)
    await expect(page.locator('.sum')).toContainText('Date & time')

    await page.locator('.progress__btn', { hasText: 'Appointment' }).click()
    await choose(page, 'Annual wellness')
    await expect(page.locator('.sum')).not.toContainText('Date & time')
  })

  test('keeps what was entered when stepping back and forward', async ({ page }) => {
    await startBooking(page, {
      service: 'Primary care',
      patient: /first appointment/,
      clinic: 'Downtown',
      clinician: 'First available'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()

    await page.getByLabel('First name').fill('Robin')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.locator('.slot--on')).toHaveCount(1)
    await continueButton(page).click()
    await expect(page.getByLabel('First name')).toHaveValue('Robin')
  })

  test('refuses to submit without the required fields, and flags a bad email', async ({ page }) => {
    await startBooking(page, {
      service: 'Primary care',
      patient: /first appointment/,
      clinic: 'Downtown',
      clinician: 'First available'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()

    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/book\/details/)
    await expect(page.getByText('Enter a first name.')).toBeVisible()
    await expect(page.getByText('Enter an email address.')).toBeVisible()

    await page.getByLabel('First name').fill('Robin')
    await page.getByLabel('Last name').fill('Hale')
    await page.getByLabel('Email').fill('robin-at-example')
    await page.getByLabel('Last name').click()
    await expect(page.getByText('Enter an email address in the form name@example.com.')).toBeVisible()

    await page.getByLabel('Email').fill('robin@example.com')
    await expect(page.getByText('Enter an email address in the form name@example.com.')).toHaveCount(0)
  })

  test('offers the real next opening when a day has none', async ({ page }) => {
    await startBooking(page, {
      service: 'Annual wellness',
      patient: /been here before/,
      clinic: 'Northside',
      clinician: 'First available'
    })
    // Wait for the day to finish loading before judging whether it is empty.
    await expect(page.locator('.when__count')).not.toHaveText(/Checking|Consultando/)

    const jump = page.getByRole('button', { name: /^Next opening/ })
    if (!(await jump.count())) {
      // Today already has openings, so the shortcut is not offered — nothing to check.
      await expect(page.locator('.slot').first()).toBeVisible()
      return
    }

    const label = await jump.first().innerText()
    await jump.first().click()
    await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })

    // The day it jumped to is the one the button named.
    const time = label.split('·').pop()!.split(',').pop()!.trim()
    await expect(page.locator('.slot__time').first()).toHaveText(time)
  })

  test('keeps the booking across a reload, and across a language change', async ({ page }) => {
    await page.goto('/book/visit')
    await choose(page, 'Annual wellness')
    await choose(page, /been here before/)
    await continueButton(page).click()
    await choose(page, 'Northside')

    await page.reload()
    await expect(page.locator('.sum')).toContainText('Annual wellness')
    await expect(page.locator('.sum')).toContainText('Northside')

    await page.locator('.header__end').getByRole('button', { name: /^ES/ }).click()
    await expect(page.locator('.sum')).toContainText('Revisión anual')
    await expect(page.locator('.sum')).toContainText('Northside')
  })
})

test.describe('reception', () => {
  // The front desk is shown full screen; at 720px the detail panel scrolls internally.
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('shows a new booking, and that time stops being offered', async ({ page }) => {
    await startBooking(page, {
      service: 'Primary care',
      patient: /first appointment/,
      clinic: 'Downtown',
      clinician: 'Elena Sandoval'
    })
    const { day } = await pickFirstOpening(page)
    const chosenTime = (await page.locator('.slot--on .slot__time').innerText()).trim()
    await continueButton(page).click()
    const reference = await fillDetailsAndConfirm(page)

    // Reception reads the same schedule, not a second one.
    await page.goto(`/demo/reception?ref=${reference}`)
    await expect(page.locator('.panel__ref')).toHaveText(reference)
    await expect(page.locator('.panel')).toContainText('Sam Rivera')

    // Booking the same combination again no longer offers that time.
    await startBooking(page, {
      service: 'Primary care',
      patient: /first appointment/,
      clinic: 'Downtown',
      clinician: 'Elena Sandoval'
    })
    // Back to the very same day, where that time should no longer be on offer. The day
    // may now have nothing left at all, which is just as good an answer.
    const sameDay = page.getByRole('button', { name: new RegExp(`^${day} —`) })
    await expect(sameDay).toBeVisible({ timeout: 15_000 })
    await sameDay.click()
    await expect(page.locator('.when__count')).not.toHaveText(/Checking/)
    await expect(page.locator('.slot__time', { hasText: chosenTime })).toHaveCount(0)
  })

  test('cancels an appointment, and will not then move it', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /^List$/ }).click()
    await page.locator('.row').first().click()

    await page.getByRole('button', { name: 'Cancel appointment' }).click()
    await page.getByRole('button', { name: 'Yes, cancel it' }).click()
    await expect(page.locator('.panel .pill')).toHaveText('Cancelled')
    await expect(page.locator('.panel').getByRole('button', { name: 'Reschedule' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  test('moves an appointment to a genuinely free time', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /^List$/ }).click()
    await page.locator('.row').first().click()
    const reference = (await page.locator('.panel__ref').innerText()).trim()
    const whenRow = page
      .locator('.panel__rows > div')
      .filter({ hasText: 'Date & time' })
      .locator('dd')
    const before = (await whenRow.innerText()).trim()

    await page.getByRole('button', { name: 'Reschedule' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The clinician's own day may well be full; step forward until one has room.
    const dateInput = dialog.locator('input[type=date]')
    for (let offset = 1; offset <= 12; offset += 1) {
      if (await dialog.locator('.time').count()) break
      const next = new Date()
      next.setDate(next.getDate() + offset)
      await dateInput.fill(next.toISOString().slice(0, 10))
      await expect(dialog.locator('.muted')).toHaveCount(0, { timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(300)
    }
    await expect(dialog.locator('.time').first()).toBeVisible({ timeout: 10_000 })
    await dialog.locator('.time').first().click()
    await page.getByRole('button', { name: 'Move appointment' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.panel__ref')).toHaveText(reference)
    await expect(whenRow).not.toHaveText(before)
  })

  test('filters the agenda and restores the demo data', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /^List$/ }).click()
    const all = await page.locator('.row').count()
    expect(all).toBeGreaterThan(0)

    await page.locator('.bar__field select').first().selectOption('westside')
    expect(await page.locator('.row').count()).toBeLessThanOrEqual(all)
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.locator('.row')).toHaveCount(all)

    await page.locator('.bar__search input').fill('Margaret')
    await expect(page.locator('.row')).toHaveCount(1)
    await page.getByRole('button', { name: 'Clear filters' }).click()

    await page.getByRole('button', { name: 'Restore demo data' }).click()
    await page.getByRole('button', { name: 'Yes, restore it' }).click()
    await expect(page.getByText('Demo data restored.')).toBeVisible()
  })

  test('offers a DEMO calendar file written in clinic time', async ({ page }) => {
    await startBooking(page, {
      service: 'Follow-up visit',
      patient: /been here before/,
      clinic: 'Any location',
      clinician: 'First available'
    })
    await pickFirstOpening(page)
    await continueButton(page).click()
    await fillDetailsAndConfirm(page)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Add to calendar (.ics)' }).click()
    ])
    expect(download.suggestedFilename()).toMatch(/^lorba-medical-demo-LM-[A-Z0-9]{4}\.ics$/)

    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const ics = Buffer.concat(chunks).toString('utf8')

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('CATEGORIES:DEMO')
    expect(ics).toContain('[DEMO]')
    expect(ics).toContain('America/New_York')
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  })
})

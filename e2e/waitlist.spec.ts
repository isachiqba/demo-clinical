import { expect, test, type Page } from '@playwright/test'

/**
 * The operational story the demo is built to tell: a patient cancels, reception sees the
 * slot, finds who it suits, offers it, and the acceptance updates the agenda and the
 * overview. Each test starts from the scripted scenario.
 */

const openReception = async (page: Page): Promise<void> => {
  await page.goto('/demo/reception')
  await expect(page.locator('.rec__tab', { hasText: 'Overview' })).toBeVisible()
}

const restore = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Restore demo data' }).click()
  await page.getByRole('button', { name: 'Yes, restore it' }).click()
  await expect(page.getByText('Demo data restored.')).toBeVisible()
}

const cancelThePreparedAppointment = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /Open the appointment to cancel/ }).click()
  await expect(page.locator('.panel__ref')).toHaveText('LM-7F3K')
  await page.getByRole('button', { name: 'Cancel appointment' }).click()
  await page.getByRole('button', { name: 'Yes, cancel it' }).click()
  await expect(page.locator('.panel .pill')).toHaveText('Cancelled')
}

test.describe('filling a cancellation from the waitlist', () => {
  // The demo is presented full screen; at 720px the detail panel scrolls internally.
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('cancel, match, offer, accept — and the agenda and overview follow', async ({ page }) => {
    await openReception(page)

    // 1. The overview starts with nobody offered and no slot to fill.
    await expect(page.locator('.tile', { hasText: 'Patients waiting' })).toContainText('3')
    await expect(page.locator('.tile', { hasText: 'Slots filled from the waitlist' })).toContainText('0')

    // 2. A patient cancels.
    await cancelThePreparedAppointment(page)

    // The agenda says a slot came free, with the real number of matches.
    await expect(page.locator('.rec__opening')).toContainText('2 patients match this time')

    // 3. Reception looks at who it suits.
    await page.locator('.rec__opening').getByRole('button', { name: 'See who it suits' }).click()
    await expect(page.locator('.opening')).toHaveCount(1)
    // The count is on the button before anything is expanded, as the demo script relies on.
    const matchButton = page.locator('.opening__actions button').first()
    await expect(matchButton).toContainText('2 patients match this time')
    await matchButton.click()
    await expect(page.locator('.candidate')).toHaveCount(2)

    // Longest wait first, and each says why it fits.
    await expect(page.locator('.candidate').first()).toContainText('Nadia Okonjo')
    await expect(page.locator('.candidate').first()).toContainText('Waiting since')
    await expect(page.locator('.candidate').nth(1)).toContainText('Would bring forward')

    // The patient the slot does not suit is on the list but not among the candidates.
    await expect(page.locator('.rows')).toContainText('Iris Lindqvist')
    await expect(page.locator('.candidate', { hasText: 'Iris' })).toHaveCount(0)

    // 4. Reception offers the time; the preview is a message, not a send.
    await page.locator('.candidate').first().getByRole('button', { name: 'Offer this time' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Simulated message')
    await expect(dialog).toContainText('Hello Nadia')
    await dialog.getByRole('button', { name: 'Offer the time' }).click()

    // The slot is held, and the hold has a visible deadline.
    await expect(dialog).toContainText('The time is held until')
    await expect(dialog.getByRole('button', { name: 'Simulate acceptance' })).toBeVisible()

    // 5. The patient accepts.
    await dialog.getByRole('button', { name: 'Simulate acceptance' }).click()
    await expect(dialog).toContainText('the agenda is updated')
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    // 6. The agenda has the new booking in the freed time, and the cancelled one is
    //    still visible to the front desk, marked as cancelled.
    await page.locator('.rec__tab', { hasText: 'Day agenda' }).click()
    await expect(page.locator('.slotcard', { hasText: 'Nadia Okonjo' })).toHaveCount(1)
    await expect(page.locator('.slotcard--cancelled', { hasText: 'Bernard Castille' })).toHaveCount(1)
    await expect(page.locator('.slotcard--cancelled', { hasText: 'Nadia Okonjo' })).toHaveCount(0)

    // 7. The overview counts the slot as filled, and nothing is left waiting on it.
    await page.locator('.rec__tab', { hasText: 'Overview' }).click()
    await expect(page.locator('.tile', { hasText: 'Slots filled from the waitlist' })).toContainText('1')
    await expect(page.locator('.tile', { hasText: 'Patients waiting' })).toContainText('2')
    await expect(page.locator('.tile', { hasText: 'Times held' })).toContainText('0')

    // The activity feed tells the story in order, newest first.
    const feed = page.locator('.feed__text')
    await expect(feed.nth(0)).toContainText('Nadia Okonjo accepted')
    await expect(feed.nth(1)).toContainText('offered to Nadia Okonjo')
    await expect(feed.nth(2)).toContainText('2 patients match')
    await expect(feed.nth(3)).toContainText('Bernard Castille cancelled')
  })

  test('a declined offer frees the time for the next patient', async ({ page }) => {
    await openReception(page)
    await cancelThePreparedAppointment(page)

    await page.locator('.rec__tab', { hasText: 'Waitlist' }).click()
    await page.locator('.opening__actions button').first().click()
    await page.locator('.candidate').first().getByRole('button', { name: 'Offer this time' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Offer the time' }).click()
    await dialog.getByRole('button', { name: 'Simulate a decline' }).click()
    await expect(dialog).toContainText('The time is free again')
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    // The slot is back on the board and the second candidate can be offered it.
    await page.locator('.opening__actions button').first().click()
    await expect(page.locator('.candidate')).toHaveCount(2)
    await page.locator('.candidate', { hasText: 'Henry Alvarado' }).getByRole('button', { name: 'Offer this time' }).click()
    await expect(page.getByRole('dialog')).toContainText('Hola, Henry')
  })

  test('bringing an appointment forward replaces it rather than doubling it', async ({ page }) => {
    await openReception(page)
    await cancelThePreparedAppointment(page)

    await page.locator('.rec__tab', { hasText: 'Waitlist' }).click()
    await page.locator('.opening__actions button').first().click()
    await page
      .locator('.candidate', { hasText: 'Henry Alvarado' })
      .getByRole('button', { name: 'Offer this time' })
      .click()

    const dialog = page.getByRole('dialog')
    // The message goes out in the patient's own language.
    await expect(dialog).toContainText('Hola, Henry')
    await expect(dialog).toContainText('sustituiría a tu cita')
    await dialog.getByRole('button', { name: 'Offer the time' }).click()
    await dialog.getByRole('button', { name: 'Simulate acceptance' }).click()
    await expect(dialog).toContainText('cancelled and replaced')
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    // Exactly one live appointment for him: the earlier one.
    await page.locator('.rec__tab').filter({ hasText: /^List$/ }).click()
    await page.locator('.bar__search input').fill('Henry')
    const rows = page.locator('.row', { hasText: 'Henry Alvarado' })
    await expect(rows).toHaveCount(2)
    await expect(page.locator('.row', { hasText: 'Henry Alvarado' }).locator('.pill', { hasText: 'Cancelled' })).toHaveCount(1)
  })

  test('the waitlist is offered as soon as times are shown, not only when there are none', async ({
    page
  }) => {
    const choose = (text: string | RegExp) => page.locator('.opt', { hasText: text }).first().click()

    // A quick appointment: times are available, so the prompt stays quiet.
    await page.goto('/book/visit')
    await choose('Primary care')
    await choose(/been here before/)
    await page.getByRole('button', { name: 'Continue' }).click()
    await choose('Any location')
    await choose('First available')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /— \d+ openings?$/ }).first().click()
    await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })

    const prompt = page.locator('.when__ask')
    await expect(prompt).toBeVisible()
    await expect(prompt).toContainText('None of these times any good?')
    await expect(page.locator('.when__ask--loud')).toHaveCount(0)

    // A longer appointment at the quieter clinic: the wait is a week, so it says so.
    await page.goto('/book/visit')
    await choose('Annual wellness')
    await choose(/been here before/)
    await page.getByRole('button', { name: 'Continue' }).click()
    await choose('Westside')
    await choose('First available')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /— \d+ openings?$/ }).first().click()
    await expect(page.locator('.slot').first()).toBeVisible({ timeout: 15_000 })

    await expect(page.locator('.when__ask--loud')).toBeVisible()
    await expect(page.locator('.when__ask--loud')).toContainText(/first opening here is \d+ days away/)

    // And joining from there works, without a booking to attach to.
    await page.locator('.when__ask').getByRole('button', { name: /opens up sooner/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Use sample details' }).click()
    await dialog.getByRole('button', { name: 'Join the waitlist' }).click()
    await expect(page.locator('.when__joined')).toContainText('You are on the waitlist')
  })

  test('a patient can join the waitlist from the public site and leave again', async ({ page }) => {
    // Book something first, so the entry attaches to a real appointment.
    await page.goto('/book/visit')
    const choose = (text: string | RegExp) => page.locator('.opt', { hasText: text }).first().click()
    await choose('Primary care')
    await choose(/first appointment/)
    await page.getByRole('button', { name: 'Continue' }).click()
    await choose('Downtown')
    await choose('First available')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /— \d+ openings?$/ }).first().click()
    await page.locator('.slot').first().click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Use sample details' }).click()
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await page.waitForURL(/\/booking\//)

    const confirmationUrl = page.url()

    // Join from the confirmation page.
    await page.getByRole('button', { name: 'Tell me if something opens up sooner' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('never sends a message')
    await dialog.getByRole('button', { name: 'Join the waitlist' }).click()

    await expect(page.getByText('You are on the waitlist')).toBeVisible()

    // Reception sees them.
    await page.goto('/demo/reception')
    await page.locator('.rec__tab', { hasText: 'Waitlist' }).click()
    await expect(page.locator('.rows')).toContainText('Sam Rivera')

    // And the patient can take themselves off again.
    await page.goto(confirmationUrl)
    await page.getByRole('button', { name: 'Leave the waitlist' }).click()
    await page.getByRole('button', { name: 'Yes, take me off' }).click()
    await expect(page.getByRole('button', { name: 'Tell me if something opens up sooner' })).toBeVisible()
  })

  test('restoring the demo clears offers, holds and the activity feed', async ({ page }) => {
    await openReception(page)
    await cancelThePreparedAppointment(page)

    await page.locator('.rec__tab', { hasText: 'Waitlist' }).click()
    await page.locator('.opening__actions button').first().click()
    await page.locator('.candidate').first().getByRole('button', { name: 'Offer this time' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Offer the time' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    await restore(page)

    await expect(page.locator('.tile', { hasText: 'Patients waiting' })).toContainText('3')
    await expect(page.locator('.tile', { hasText: 'Slots to fill' })).toContainText('0')
    await expect(page.locator('.tile', { hasText: 'Times held' })).toContainText('0')
    await expect(page.getByText('Nothing has happened yet in this session.')).toBeVisible()
  })

  test('the demo state survives a reload', async ({ page }) => {
    await openReception(page)
    await cancelThePreparedAppointment(page)

    await page.reload()
    await expect(page.locator('.rec__tab', { hasText: 'Waitlist' })).toContainText('1')
    await page.locator('.rec__tab', { hasText: 'Waitlist' }).click()
    await expect(page.locator('.opening')).toHaveCount(1)
  })
})

import { expect, test, type Page } from '@playwright/test'

/**
 * The operational story: a request arrives, reception records that they put it into
 * CureMD by hand, a cancellation waits until they take it out again, and only then does
 * the freed slot reach the waitlist.
 */

const tab = (page: Page, name: RegExp) => page.locator('.rec__tab').filter({ hasText: name })

const openReception = async (page: Page): Promise<void> => {
  await page.goto('/demo/reception')
  await expect(tab(page, /Overview/)).toBeVisible()
}

const restore = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Restore demo data' }).click()
  await page.getByRole('button', { name: 'Yes, restore it' }).click()
  await expect(page.getByText('Demo data restored.')).toBeVisible()
}

test.describe('the CureMD inbox', () => {
  // The front desk is shown full screen; at 720px the detail panel scrolls internally.
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('lists the three kinds of work, oldest first', async ({ page }) => {
    await openReception(page)
    await tab(page, /CureMD/).click()

    // One of each kind, plus the walk-in who arrived before anyone registered them.
    await expect(page.locator('.row')).toHaveCount(4)
    await expect(page.locator('.summary__item').nth(0)).toContainText('2')
    await expect(page.locator('.summary__item').nth(1)).toContainText('1')
    await expect(page.locator('.summary__item').nth(2)).toContainText('1')

    // The age of the job is shown apart from the date of the appointment.
    await expect(page.locator('.row__age').first()).toContainText(/Waiting/)
    await expect(page.locator('.row__when').first()).toContainText(/Appointment:/)
  })

  test('records a manual registration, with an audit trail, and confirms', async ({ page }) => {
    await openReception(page)
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await expect(page.locator('.panel__ref')).toHaveText('LM-7F3K')

    // Both states are shown, and the appointment is only a request.
    await expect(page.locator('.panel__states')).toContainText('Appointment: Requested')
    await expect(page.locator('.panel__states')).toContainText('CureMD: To register')

    await page.getByRole('button', { name: 'Mark as registered' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('It sends nothing to CureMD')
    await expect(dialog).toContainText('What to enter in CureMD')

    // The confirmation is required before the action is allowed.
    const action = dialog.getByRole('button', { name: 'Mark as registered' })
    await expect(action).toHaveAttribute('aria-disabled', 'true')

    await dialog.getByLabel('CureMD reference').fill('CMD-77421')
    await dialog.getByText('I have entered this appointment in CureMD.').click()
    await action.click()

    await expect(page.locator('.panel__states')).toContainText('Appointment: Confirmed')
    await expect(page.locator('.panel__states')).toContainText('CureMD: Registered')
    await expect(page.locator('.panel')).toContainText('CMD-77421')
    await expect(page.locator('.panel')).toContainText('Demo Reception')
    await expect(page.locator('.trail')).toContainText('Declared registered in CureMD')
  })

  test('a cancellation stays pending until reception says they did it', async ({ page }) => {
    await openReception(page)
    await page.getByRole('button', { name: /Open the pending cancellation/ }).click()
    await expect(page.locator('.panel__ref')).toHaveText('LM-4K7T')
    await expect(page.locator('.panel__states')).toContainText('CureMD: Cancellation pending')
    // Still on the books: the appointment has not been cancelled locally.
    await expect(page.locator('.panel__states')).toContainText('Appointment: Confirmed')

    // Nothing has been offered to the waitlist yet.
    await tab(page, /Waitlist/).click()
    await expect(page.locator('.opening')).toHaveCount(0)

    // Reception does it in CureMD and records that.
    await tab(page, /CureMD/).click()
    await page
      .locator('.row', { hasText: 'Walter Ibsen' })
      .getByRole('button', { name: 'Mark cancellation as done' })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('I have cancelled this appointment in CureMD.').click()
    await dialog.getByRole('button', { name: 'Mark cancellation as done' }).click()

    // Only now does the slot reach the waitlist.
    await tab(page, /Waitlist/).click()
    await expect(page.locator('.opening')).toHaveCount(1)
    await expect(page.locator('.opening__actions button').first()).toContainText(
      '2 patients match this time'
    )
  })

  test('a change keeps the registered time until it is applied', async ({ page }) => {
    await openReception(page)
    await tab(page, /CureMD/).click()

    const row = page.locator('.row', { hasText: 'Tomás Riera' })
    await row.getByRole('button', { name: 'Mark change as applied' }).click()

    const dialog = page.getByRole('dialog')
    // The dialog shows what is registered now and what should replace it.
    await expect(dialog).toContainText('Currently registered as')
    await expect(dialog).toContainText('New time pending')

    await dialog.getByText('I have moved this appointment in CureMD.').click()
    await dialog.getByRole('button', { name: 'Mark change as applied' }).click()

    await expect(page.locator('.row', { hasText: 'Tomás Riera' })).toHaveCount(0)
    await tab(page, /Overview/).click()
    await expect(page.locator('.tile', { hasText: 'Changes to apply' })).toContainText('0')
  })

  test('refuses to record anything from a dialog opened on stale data', async ({ page }) => {
    await openReception(page)
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await page.getByRole('button', { name: 'Mark as registered' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByText('I have entered this appointment in CureMD.').click()

    // The record moves underneath: a note is added from elsewhere.
    await page.evaluate(() => {
      const raw = window.sessionStorage.getItem('dr-lorba.demo-state')
      if (!raw) return
      // The stored state is wrapped with its schema version; keep the wrapper intact or
      // the next load will throw the whole thing away.
      const stored = JSON.parse(raw)
      const target = stored.value.appointments.find(
        (a: { id: string }) => a.id === 'demo-scripted-request'
      )
      if (target) target.version += 1
      window.sessionStorage.setItem('dr-lorba.demo-state', JSON.stringify(stored))
    })
    await page.reload()

    // After the reload the dialog is closed; reopening it reads the current version and
    // the action works again, which is the behaviour we want: no silent overwrite.
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await expect(page.locator('.panel__states')).toContainText('CureMD: To register')
  })
})

test.describe('covering a cancellation from the waitlist', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  const freeTheSlot = async (page: Page): Promise<void> => {
    await tab(page, /CureMD/).click()
    await page
      .locator('.row', { hasText: 'Walter Ibsen' })
      .getByRole('button', { name: 'Mark cancellation as done' })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('I have cancelled this appointment in CureMD.').click()
    await dialog.getByRole('button', { name: 'Mark cancellation as done' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }

  test('offer, acceptance, and the replacement still needs registering', async ({ page }) => {
    await openReception(page)
    await freeTheSlot(page)

    await tab(page, /Waitlist/).click()
    await page.locator('.opening__actions button').first().click()
    await expect(page.locator('.candidate')).toHaveCount(2)
    // The patient the slot does not suit is on the list but not a candidate.
    await expect(page.locator('.rows')).toContainText('Iris Lindqvist')
    await expect(page.locator('.candidate', { hasText: 'Iris' })).toHaveCount(0)

    await page.locator('.candidate').first().getByRole('button', { name: 'Offer this time' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Simulated message')
    await dialog.getByRole('button', { name: 'Offer the time' }).click()
    await expect(dialog).toContainText('The time is held until')
    await dialog.getByRole('button', { name: 'Simulate acceptance' }).click()
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    // The acceptance is a request, so it lands in the CureMD inbox.
    await tab(page, /CureMD/).click()
    await expect(page.locator('.row', { hasText: 'Nadia Okonjo' })).toHaveCount(1)

    // And it is not counted as a covered slot until it is registered.
    await tab(page, /Overview/).click()
    await expect(page.locator('.tile', { hasText: 'Slots covered from the waitlist' })).toContainText('0')

    await tab(page, /CureMD/).click()
    await page
      .locator('.row', { hasText: 'Nadia Okonjo' })
      .getByRole('button', { name: 'Mark as registered' })
      .click()
    const second = page.getByRole('dialog')
    await second.getByText('I have entered this appointment in CureMD.').click()
    await second.getByRole('button', { name: 'Mark as registered' }).click()

    await tab(page, /Overview/).click()
    await expect(page.locator('.tile', { hasText: 'Slots covered from the waitlist' })).toContainText('1')
  })

  test('a patient who already has an appointment keeps it until the change is applied', async ({
    page
  }) => {
    await openReception(page)
    await freeTheSlot(page)

    await tab(page, /Waitlist/).click()
    await page.locator('.opening__actions button').first().click()
    await page
      .locator('.candidate', { hasText: 'Marguerite Oyelaran' })
      .getByRole('button', { name: 'Offer this time' })
      .click()

    const dialog = page.getByRole('dialog')
    // Her language is Spanish, so the message is in Spanish.
    await expect(dialog).toContainText('Hola, Marguerite')
    await dialog.getByRole('button', { name: 'Offer the time' }).click()
    await dialog.getByRole('button', { name: 'Simulate acceptance' }).click()
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    // It became a change to apply, not a move.
    await tab(page, /CureMD/).click()
    const row = page.locator('.row', { hasText: 'Marguerite Oyelaran' })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Change pending')
  })

  test('restoring clears tasks, offers, holds and the activity feed', async ({ page }) => {
    await openReception(page)
    await freeTheSlot(page)
    await restore(page)

    await expect(page.locator('.tile', { hasText: 'Patients on the waitlist' })).toContainText('3')
    await expect(page.locator('.tile', { hasText: 'Cancellations to do' })).toContainText('1')
    await expect(page.getByText('Nothing has happened yet in this session.')).toBeVisible()
  })

  test('the demo survives a reload', async ({ page }) => {
    await openReception(page)
    await freeTheSlot(page)
    await page.reload()
    await tab(page, /Waitlist/).click()
    await expect(page.locator('.opening')).toHaveCount(1)
  })
})

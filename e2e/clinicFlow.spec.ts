import { expect, test, type Page } from '@playwright/test'

/**
 * The front desk's part of the visit: check the patient in with a room, print the slip,
 * finish the visit.
 */

const tab = (page: Page, name: RegExp) => page.locator('.rec__tab').filter({ hasText: name })

const openFloor = async (page: Page): Promise<void> => {
  await page.goto('/demo/reception')
  await expect(tab(page, /Overview/)).toBeVisible()
  await tab(page, /Patients in clinic/).click()
}

test.describe('the clinic floor', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('shows only what the desk needs, with two actions', async ({ page }) => {
    await openFloor(page)
    await expect(page.locator('.floor__lede')).toHaveText(
      'Record the arrival, assign a room and print the care slip.'
    )

    const person = page.locator('.person').first()
    await expect(person).toContainText(/appointment \d/)
    await expect(person).toContainText(/arrived \d/)
    await expect(person.locator('.stage')).toHaveText('In clinic')
    await expect(person.locator('.room')).toBeVisible()

    // The appointment and CureMD marks stay separate from the visit state.
    await expect(person.locator('.pill')).toHaveCount(2)

    // Two actions, and the correction tucked behind the menu.
    await expect(person.getByRole('button', { name: 'Print slip' })).toBeVisible()
    await expect(person.getByRole('button', { name: 'Finish visit' })).toBeVisible()
    await expect(person.getByRole('button', { name: 'Correct the room' })).toHaveCount(0)

    // None of the stage machinery survives.
    const text = await page.locator('.floor').innerText()
    for (const gone of [
      'Start vitals',
      'Finish vitals',
      'Start consultation',
      'Finish consultation',
      'Waiting for the doctor',
      'With the doctor',
      'With Dr. Lorba'
    ]) {
      expect(text).not.toContain(gone)
    }
  })

  test('checks a patient in and gives them a room in one dialog', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await expect(page.locator('.panel__states')).toContainText('CureMD: To register')

    await page.locator('.panel').getByRole('button', { name: 'Record arrival' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Check this is the person at the desk')
    await expect(dialog).toContainText('LM-7F3K')
    await expect(dialog).toContainText('still waiting to be entered in CureMD')

    // The rooms live in this dialog, which is where the choice is made.
    await expect(dialog.getByRole('heading', { name: 'Room' })).toBeVisible()
    const room = dialog.locator('.room:not([disabled])').first()
    const roomName = (await room.innerText()).trim()
    await room.click()

    await dialog.getByRole('button', { name: 'Record arrival' }).click()

    // It confirms, and offers the slip rather than making you go and find it.
    await expect(dialog).toContainText('arrived at')
    await expect(dialog).toContainText(`Room: ${roomName}`)
    await expect(dialog.getByRole('button', { name: 'Print the care slip' })).toBeVisible()
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    const person = page.locator('.person', { hasText: 'Bernard Castille' })
    await expect(person.locator('.stage')).toHaveText('In clinic')
    await expect(person.locator('.room')).toContainText(roomName)

    // And the CureMD task is still a task.
    await tab(page, /CureMD/).click()
    await expect(page.locator('.row', { hasText: 'Bernard Castille' })).toHaveCount(1)
  })

  test('will not offer a room that is already in use at that clinic', async ({ page }) => {
    // The scripted request to register is at Downtown, and room names repeat across
    // clinics, so the comparison has to be made within one clinic.
    await openFloor(page)
    await page.locator('.filters__field select').selectOption('downtown')
    const inUse: string[] = []
    for (const room of await page.locator('.person .room').all()) {
      const name = (await room.innerText()).trim()
      if (name !== 'To be assigned') inUse.push(name)
    }

    await page.goto('/demo/reception')
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await page.locator('.panel').getByRole('button', { name: 'Record arrival' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.room')).not.toHaveCount(0)

    for (const name of inUse) {
      const entry = dialog.locator('.room', { hasText: name })
      await expect(entry.first()).toBeDisabled()
      await expect(entry.first()).toContainText('taken')
    }
    // And the ones nobody is in are offered.
    expect(await dialog.locator('.room:not([disabled])').count()).toBeGreaterThan(0)
  })

  test('can record an arrival now and decide the room later', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await page.locator('.panel').getByRole('button', { name: 'Record arrival' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Decide the room later' }).click()
    await dialog.getByRole('button', { name: 'Record arrival' }).click()
    await expect(dialog).toContainText('No room yet')
    await dialog.locator('.dialog__actions').getByRole('button', { name: 'Close' }).click()

    await expect(
      page.locator('.person', { hasText: 'Bernard Castille' }).locator('.room')
    ).toContainText('To be assigned')
  })

  test('corrects a room from the secondary menu, freeing the first', async ({ page }) => {
    await openFloor(page)

    const person = page.locator('.person', { hasText: 'In clinic' }).first()
    const who = (await person.locator('.person__name').innerText()).trim()
    const was = (await person.locator('.room').innerText()).trim()

    await person.getByRole('button', { name: 'More actions' }).click()
    await person.getByRole('button', { name: 'Correct the room' }).click()

    // A different free room, not the one they are already in.
    const other = person
      .locator('.picker__room:not([disabled]):not(.picker__room--on)')
      .filter({ hasNotText: 'No room yet' })
      .first()
    const now = (await other.innerText()).trim()
    await other.click()

    const updated = page.locator('.person', { hasText: who })
    await expect(updated.locator('.room')).toContainText(now)
    expect(now).not.toBe(was)

    // The correction is recorded as a correction.
    await updated.locator('.person__name').click()
    await expect(page.locator('.trail')).toContainText('Room corrected')
  })

  test('finishes a visit: departure recorded, room freed, appointment completed', async ({
    page
  }) => {
    await openFloor(page)

    const person = page.locator('.person', { hasText: 'In clinic' }).first()
    const who = (await person.locator('.person__name').innerText()).trim()
    const room = (await person.locator('.room').innerText()).trim()

    await person.getByRole('button', { name: 'Finish visit' }).click()

    // Gone from the in-clinic list, and in the finished one with a leaving time.
    await expect(page.locator('.person', { hasText: who })).toHaveCount(0)
    await page.locator('.toggle__btn', { hasText: 'Visit finished' }).click()
    const done = page.locator('.person', { hasText: who })
    await expect(done.locator('.stage')).toHaveText('Visit finished')
    await expect(done).toContainText(/left \d/)
    // A finished visit holds no room.
    await expect(done.locator('.room')).toHaveCount(0)

    // The room is free for the next arrival.
    await page.goto('/demo/reception')
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await page.locator('.panel').getByRole('button', { name: 'Record arrival' }).click()
    const offered = page.getByRole('dialog').locator('.room', { hasText: room })
    if (await offered.count()) await expect(offered.first()).toBeEnabled()
  })

  test('finishing leaves a CureMD task exactly where it was', async ({ page }) => {
    await page.goto('/demo/reception')
    await tab(page, /Patients in clinic/).click()

    // The sample includes somebody who arrived before anyone registered them.
    const person = page.locator('.person', { hasText: 'To register' }).first()
    const who = (await person.locator('.person__name').innerText()).trim()
    await person.getByRole('button', { name: 'Finish visit' }).click()

    await tab(page, /CureMD/).click()
    await expect(page.locator('.row', { hasText: who })).toHaveCount(1)
  })

  test('offers only a new appointment once the visit is finished', async ({ page }) => {
    await openFloor(page)
    const person = page.locator('.person', { hasText: 'In clinic' }).first()
    const who = (await person.locator('.person__name').innerText()).trim()
    await person.getByRole('button', { name: 'Finish visit' }).click()

    await page.locator('.toggle__btn', { hasText: 'Visit finished' }).click()
    await page.locator('.person', { hasText: who }).locator('.person__name').click()

    const actions = page.locator('.panel__actions').first()
    await expect(actions.getByRole('link', { name: 'Book another appointment' })).toBeVisible()
    await expect(actions.locator('a, button')).toHaveCount(1)
    await expect(page.locator('.panel')).toContainText('This visit is over')
  })

  test('keeps the record clear of the CureMD disclaimer, which lives in the inbox', async ({
    page
  }) => {
    await page.goto('/demo/reception')
    await page.getByRole('button', { name: /Open the request to register/ }).click()
    await expect(page.locator('.panel')).not.toContainText('does not verify or sync')

    // The point is still made, in the place the work is actually done.
    await page.locator('.rec__tab').filter({ hasText: /CureMD/ }).click()
    await expect(page.locator('.inbox__lede')).toContainText('This application never contacts it')
  })

  test('keeps the whole record inside its own card, and scrolls it', async ({ page }) => {
    // A short viewport, so the record is certainly taller than the card.
    await page.setViewportSize({ width: 1440, height: 760 })
    await openFloor(page)
    await page.locator('.person__name').first().click()

    const panel = page.locator('.panel')
    await expect(panel).toHaveCSS('display', 'flex')
    await expect(panel).toHaveCSS('overflow', 'hidden')

    // The body scrolls rather than the record spilling out of the card.
    const scrolls = await page.locator('.panel__scroll').evaluate(
      (el) => el.scrollHeight > el.clientHeight
    )
    expect(scrolls).toBe(true)

    // Everything stays within the card's box, at the top and at the bottom of the scroll.
    const fits = async () =>
      page.evaluate(() => {
        const box = document.querySelector('.panel')!.getBoundingClientRect()
        return [...document.querySelectorAll('.panel__scroll > *')].every((el) => {
          const r = el.getBoundingClientRect()
          // Either inside the card, or scrolled out of view — never painted beyond it.
          return r.top >= box.top - 1 || r.bottom <= box.bottom + 1
        })
      })
    expect(await fits()).toBe(true)

    await page.locator('.panel__scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    expect(await fits()).toBe(true)

    // And the actions are reachable at the bottom, inside the card.
    const reachable = await page.evaluate(() => {
      const box = document.querySelector('.panel')!.getBoundingClientRect()
      const buttons = [...document.querySelectorAll('.panel__actions a, .panel__actions button')]
      return buttons.length > 0 && buttons.every((b) => {
        const r = b.getBoundingClientRect()
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1
      })
    })
    expect(reachable).toBe(true)
  })

  test('shows the visit block as proper rows once an arrival is recorded', async ({ page }) => {
    await openFloor(page)
    await page.locator('.person__name').first().click()

    // It used to render with browser default <dl> styling: labels and values on separate,
    // indented lines. It must read like every other block in the panel.
    const rows = page.locator('.panel__rows').last()
    await expect(rows).toHaveCSS('display', 'grid')
    await expect(rows).toContainText('Visit')
    await expect(rows).toContainText('In clinic')
    await expect(rows).toContainText('Room')
    await expect(rows.locator('dd').first()).toHaveCSS('margin-inline-start', '0px')
  })

  test('filters by clinic and between in-clinic and finished', async ({ page }) => {
    await openFloor(page)
    const inClinic = await page.locator('.person').count()
    expect(inClinic).toBeGreaterThan(0)

    await page.locator('.toggle__btn', { hasText: 'Visit finished' }).click()
    await expect(page.locator('.person').first().locator('.stage')).toHaveText('Visit finished')

    await page.locator('.toggle__btn', { hasText: 'In clinic' }).click()
    await expect(page.locator('.person')).toHaveCount(inClinic)

    await page.locator('.filters__field select').selectOption('westside')
    const shown = await page.locator('.person').count()
    expect(shown).toBeLessThanOrEqual(inClinic)
  })
})

test.describe('the day agenda', () => {
  test.use({ viewport: { width: 1500, height: 1000 } })

  test('gives every status its own colour, and names them', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /Day agenda/ }).click()

    // The legend names each colour, so nothing is decoded from hue alone.
    await expect(page.locator('.legend__item')).toHaveCount(6)
    for (const name of [
      'Requested',
      'Confirmed',
      'Arrived',
      'Completed',
      'Cancelled',
      'Not available'
    ]) {
      await expect(page.locator('.legend')).toContainText(name)
    }

    // Each status renders a different background on the board.
    const colours = await page.evaluate(() => {
      const seen: Record<string, string> = {}
      for (const el of document.querySelectorAll('.legend__swatch')) {
        const status = [...el.classList].find((c) => c.startsWith('card--'))!
        seen[status] = getComputedStyle(el).backgroundColor
      }
      return seen
    })
    const values = Object.values(colours)
    expect(new Set(values).size).toBe(values.length)

    // Finished visits are the red one.
    expect(colours['card--completed']).toBe('rgb(250, 233, 230)')
  })

  test('gives whoever is in the building a bigger card, with their room on it', async ({
    page
  }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /Day agenda/ }).click()

    const present = page.locator('.card--present')
    expect(await present.count()).toBeGreaterThan(0)
    await expect(present.first().locator('.card__room')).toBeVisible()

    const sizes = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.card')]
      const tall = cards.filter((c) => c.classList.contains('card--present'))
      const compact = cards.filter((c) => !c.classList.contains('card--present'))
      return {
        tall: Math.min(...tall.map((c) => (c as HTMLElement).offsetHeight)),
        compact: Math.max(...compact.map((c) => (c as HTMLElement).offsetHeight))
      }
    })
    expect(sizes.tall).toBeGreaterThan(sizes.compact)

    // Only the patients who are in the clinic get it.
    const names = await present.locator('.card__name').allTextContents()
    await page.locator('.rec__tab').filter({ hasText: /Patients in clinic/ }).click()
    const inClinic = await page.locator('.person__name').allTextContents()
    for (const name of names) {
      expect(inClinic.map((n) => n.trim())).toContain(name.trim())
    }
  })

  test('never lets a card spill over the appointment after it', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /Day agenda/ }).click()

    const overlaps = await page.evaluate(() => {
      const byColumn = new Map<Element, { top: number; bottom: number }[]>()
      for (const card of document.querySelectorAll('.card')) {
        const column = card.closest('.board__col')!
        const el = card as HTMLElement
        if (!byColumn.has(column)) byColumn.set(column, [])
        byColumn.get(column)!.push({ top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight })
      }
      let clashes = 0
      for (const list of byColumn.values()) {
        list.sort((a, b) => a.top - b.top)
        for (let i = 1; i < list.length; i += 1) {
          if (list[i - 1].bottom > list[i].top) clashes += 1
        }
      }
      return clashes
    })
    expect(overlaps).toBe(0)
  })

  test('keeps a long name on one line instead of cutting it in half', async ({ page }) => {
    await page.goto('/demo/reception')
    await page.locator('.rec__tab').filter({ hasText: /Day agenda/ }).click()

    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll('.card')].filter((card) => {
        const name = card.querySelector('.card__name') as HTMLElement
        return name.scrollHeight > card.clientHeight
      }).length
    )
    expect(overflowing).toBe(0)
  })
})

test.describe('the care slip', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('shows every field it needs, and no contact details', async ({ page }) => {
    await openFloor(page)

    const person = page.locator('.person').first()
    const who = (await person.locator('.person__name').innerText()).trim()
    await person.getByRole('button', { name: 'Print slip' }).click()

    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('Dr. Lorba')
    await expect(sheet).toContainText('Care slip')
    await expect(sheet).toContainText('DEMO — FICTIONAL DATA')
    await expect(sheet).toContainText(who)
    await expect(sheet).toContainText('Arrival time')
    await expect(sheet).toContainText('Appointment type')

    for (const label of [
      'Blood pressure',
      'Heart rate',
      'Respiratory rate',
      'Temperature',
      'Oxygen saturation',
      'Weight',
      'Height',
      'Notes',
      'Taken by'
    ]) {
      await expect(sheet).toContainText(label)
    }
    await expect(sheet).toContainText('to be filled in by hand')

    const text = await sheet.innerText()
    expect(text).not.toContain('@')
    expect(text.toLowerCase()).not.toContain('insurance')
    expect(text).not.toMatch(/\(\d{3}\)/)
    expect(text).not.toMatch(/\d+\s*\/\s*\d+\s*mmHg/)
    expect(text.toLowerCase()).not.toContain('normal range')
  })

  test('says "to be assigned" when there is no room yet', async ({ page }) => {
    await openFloor(page)
    const person = page.locator('.person', { hasText: 'To be assigned' }).first()
    await person.getByRole('button', { name: 'Print slip' }).click()
    await expect(page.locator('.sheet')).toContainText('To be assigned')
  })

  test('prints in the other language without touching the appointment', async ({ page }) => {
    await openFloor(page)
    const person = page.locator('.person').first()
    const who = (await person.locator('.person__name').innerText()).trim()
    await person.getByRole('button', { name: 'Print slip' }).click()

    await expect(page.locator('.sheet')).toContainText('Care slip')
    await page.locator('.chrome__lang', { hasText: 'ES' }).click()
    await expect(page.locator('.sheet')).toContainText('Volante de atención')
    await expect(page.locator('.sheet')).toContainText('DEMO — DATOS FICTICIOS')
    await expect(page.locator('.sheet')).toContainText(who)

    await page.locator('.slip-overlay__chrome').getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('.floor__title')).toContainText('In the clinic')
  })

  test('reprinting records a request and changes nothing', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {}
    })
    await openFloor(page)

    const person = page.locator('.person').first()
    const who = (await person.locator('.person__name').innerText()).trim()
    const stageBefore = (await person.locator('.stage').innerText()).trim()
    const roomBefore = (await person.locator('.room').innerText()).trim()

    const row = page.locator('.person', { hasText: who })
    for (let i = 0; i < 2; i += 1) {
      await row.getByRole('button', { name: 'Print slip' }).click()
      await page.getByRole('button', { name: 'Open the print dialog' }).click()
      await page.locator('.slip-overlay__chrome').getByRole('button', { name: 'Close' }).click()
    }

    await expect(row.locator('.stage')).toHaveText(stageBefore)
    await expect(row.locator('.room')).toHaveText(roomBefore)

    await row.locator('.person__name').click()
    await expect(page.locator('.panel')).toContainText('Requested 2 times')
    await expect(page.locator('.trail')).toContainText('Care slip print requested')
  })
})

/**
 * Walks the booking journey and photographs each step, then the confirmation and the
 * reception view showing the same appointment. Used for design review.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4178'
const OUT = process.argv[2] ?? 'shots-flow'
const WIDTH = Number(process.env.WIDTH ?? 1280)
const HEIGHT = Number(process.env.HEIGHT ?? 1000)
const LOCALE = process.env.LOCALE ?? 'en'

const run = async () => {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })
  const page = await context.newPage()
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  if (LOCALE === 'es') {
    await page.getByRole('button', { name: /^ES/ }).first().click()
    await page.waitForTimeout(200)
  }

  // Quick booking shortcut carries its two choices into the flow.
  await page.locator('.quick__form select').first().selectOption('annual-wellness')
  await page.locator('.quick__form select').nth(1).selectOption('northside')
  await page.locator('.quick__form button[type=submit]').click()
  await page.waitForURL(/\/book\//)
  await page.waitForTimeout(400)
  await shot('01-visit')

  await page.locator('.opt', { hasText: /first appointment|primera cita/i }).first().click()
  await page.getByRole('button', { name: /Continue|Continuar/ }).click()
  await page.waitForTimeout(900)
  await shot('02-place')

  await page.locator('.opt', { hasText: /First available|primero disponible/i }).first().click()
  await page.getByRole('button', { name: /Continue|Continuar/ }).click()
  await page.waitForTimeout(1200)
  await shot('03-when')

  // Today may be closed; the empty state offers the real next opening.
  const jump = page.getByRole('button', { name: /Next opening|Próximo hueco/ })
  if (await jump.count()) {
    await jump.first().click()
    await page.waitForTimeout(1200)
    await shot('03a-when-jumped')
  }

  await page.locator('.slot').first().click()
  await page.waitForTimeout(250)
  await shot('03b-when-chosen')

  await page.getByRole('button', { name: /Continue|Continuar/ }).click()
  await page.waitForTimeout(400)
  await shot('04-details-empty')

  await page.getByRole('button', { name: /Confirm booking|Confirmar la reserva/ }).click()
  await page.waitForTimeout(300)
  await shot('04b-details-errors')

  await page.getByRole('button', { name: /Use sample details|datos de ejemplo/ }).click()
  await page.waitForTimeout(300)
  await shot('05-details-filled')

  await page.getByRole('button', { name: /Confirm booking|Confirmar la reserva/ }).click()
  await page.waitForURL(/\/booking\//, { timeout: 15000 })
  await page.waitForTimeout(600)
  await shot('06-confirmation')

  const reference = (await page.locator('.ticket__ref').innerText()).trim()

  await page.goto(`${BASE}/demo/reception?ref=${reference}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/07-reception-detail.png` })

  await page.locator('.rec__tab').first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/08-reception-agenda.png` })

  console.log('reference:', reference)
  await browser.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

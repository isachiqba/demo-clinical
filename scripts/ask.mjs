import { chromium } from 'playwright'
const out = process.argv[2]
const browser = await chromium.launch()

/** Two searches: one with a near opening, one where the wait is long. */
const run = async (name, service, clinic, clinician, width = 1280) => {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  const choose = (t) => page.locator('.opt', { hasText: t }).first().click()
  await page.goto('http://127.0.0.1:4178/book/visit', { waitUntil: 'networkidle' })
  await choose(service)
  await choose(/been here before/)
  await page.getByRole('button', { name: 'Continue' }).click()
  await choose(clinic)
  await page.waitForTimeout(700)
  await choose(clinician)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(1600)
  const day = page.getByRole('button', { name: /— \d+ openings?$/ }).first()
  if (await day.count()) await day.click()
  await page.waitForTimeout(900)
  const ask = page.locator('.when__ask')
  console.log(name, '| prompt:', await ask.count(), '| loud:', await page.locator('.when__ask--loud').count(),
    '|', (await ask.innerText().catch(() => '')).replace(/\n/g, ' / '))
  await page.locator('.when__day').screenshot({ path: `${out}/${name}.png` }).catch(() => {})
  await page.close()
}

await run('near', 'Primary care', 'Any location', 'First available')
await run('far', 'Annual wellness', 'Westside', 'First available')
await browser.close()

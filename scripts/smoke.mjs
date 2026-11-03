import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const issues = new Set()
page.on('console', (m) => {
  const text = m.text()
  if (/Not found|intlify|\[Vue warn\]/i.test(text)) issues.add(text.slice(0, 160))
})
page.on('pageerror', (e) => issues.add('PAGEERROR ' + e.message.slice(0, 160)))

for (const path of ['/', '/care', '/team', '/locations', '/patient-information', '/book/visit', '/demo/reception']) {
  await page.goto(`http://127.0.0.1:4178${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
}

// Walk the reception tabs.
for (const tab of [/CureMD/, /Day agenda/, /^List$/, /Waitlist/, /Overview/]) {
  await page.locator('.rec__tab').filter({ hasText: tab }).click()
  await page.waitForTimeout(600)
}

// Open the scripted request and its dialog.
await page.locator('.rec__tab').filter({ hasText: /CureMD/ }).click()
await page.waitForTimeout(400)
console.log('inbox rows:', await page.locator('.row').count())
if (await page.locator('.row__action').count()) {
  await page.locator('.row__action').first().click()
  await page.waitForTimeout(600)
  console.log('dialog open:', await page.getByRole('dialog').count())
}

console.log(issues.size ? '--- ISSUES ---\n' + [...issues].join('\n') : 'no console issues')
await browser.close()

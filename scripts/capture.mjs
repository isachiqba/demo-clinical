/**
 * Screenshot sweep used for design review. Captures every page at the four widths the
 * brief calls out, plus a couple of interaction states.
 *
 *   node scripts/capture.mjs [outDir]
 *
 * Expects a preview server on http://127.0.0.1:4178.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4178'
const OUT = process.argv[2] ?? 'shots'

const widths = [
  { name: '375', width: 375, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 }
]

const pages = [
  { name: 'home', path: '/' },
  { name: 'care', path: '/care' },
  { name: 'team', path: '/team' },
  { name: 'locations', path: '/locations' },
  { name: 'info', path: '/patient-information' },
  { name: 'book-visit', path: '/book/visit' },
  { name: 'reception', path: '/demo/reception' }
]

const only = process.env.ONLY ? process.env.ONLY.split(',') : null

const run = async () => {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()

  for (const size of widths) {
    if (only && !only.includes(size.name)) continue
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1
    })
    const page = await context.newPage()

    const overflow = []

    for (const target of pages) {
      await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle' })
      // Scroll the whole page so lazy images decode before the shot.
      await page.evaluate(async () => {
        const step = window.innerHeight
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        window.scrollTo(0, 0)
        await Promise.all(
          [...document.images].filter((img) => !img.complete).map((img) => img.decode().catch(() => {}))
        )
      })
      await page.waitForTimeout(500)
      await page.screenshot({
        path: `${OUT}/${target.name}-${size.name}.png`,
        fullPage: target.name !== 'reception'
      })

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }))
      if (metrics.scrollWidth > metrics.clientWidth + 1) {
        overflow.push(`${target.name}@${size.name}: ${metrics.scrollWidth} > ${metrics.clientWidth}`)
      }
    }

    if (overflow.length) console.log('HORIZONTAL OVERFLOW:', overflow.join(' | '))
    else console.log(`no horizontal overflow at ${size.name}px`)

    await context.close()
  }

  await browser.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

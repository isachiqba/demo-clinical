/**
 * Films the two-minute commercial walkthrough of the demo, in one continuous take.
 *
 *   node scripts/film.mjs            (expects a preview server on 127.0.0.1:4178)
 *
 * There is no video editor in this environment, so the "edit" happens live in the page:
 * an injected overlay draws the English captions and the section fades, and the zooms are
 * a CSS transform on the app root. What comes out is already cut together.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4178'

/**
 * Two cuts of the same walkthrough. "annotated" names every simulated step as it happens;
 * "commercial" leaves that to the application's own DEMO banners and the closing card, and
 * spends the captions on what the software does instead.
 */
const VARIANT = process.env.VARIANT ?? 'commercial'
const LOCALE = process.env.LOCALE ?? 'en'
/** English cuts keep their plain names; a translated cut gets the language appended. */
const TAG = LOCALE === 'en' ? VARIANT : `${VARIANT}-${LOCALE}`

/**
 * Everything the run clicks on, by the text the interface actually shows. Taken from
 * src/i18n/locales/*.ts, not translated by hand, so a wording change in the app surfaces
 * here as a failed step rather than a silently wrong film.
 */
const UI = {
  en: {
    loadScenario: 'Load sample scenario',
    scenarioLoaded: 'Sample scenario loaded.',
    openPrepared: /Open the appointment to cancel/,
    service: 'Primary care',
    firstVisit: /first appointment/,
    continue: 'Continue',
    anyLocation: 'Any location',
    firstAvailable: 'First available',
    openDay: /— \d+ openings?$/,
    sampleDetails: 'Use sample details',
    confirmBooking: 'Confirm booking',
    cancelAppointment: 'Cancel appointment',
    yesCancel: 'Yes, cancel it',
    seeWhoItSuits: 'See who it suits',
    offerThisTime: 'Offer this time',
    offerTheTime: 'Offer the time',
    simulateAcceptance: 'Simulate acceptance',
    close: 'Close',
    tabAgenda: 'Day agenda',
    tabOverview: 'Overview'
  },
  es: {
    loadScenario: 'Cargar escenario de ejemplo',
    scenarioLoaded: 'Escenario de ejemplo cargado.',
    openPrepared: /Abrir la cita preparada para anular/,
    service: 'Medicina general',
    firstVisit: /primera cita/,
    continue: 'Continuar',
    anyLocation: 'Cualquier sede',
    firstAvailable: 'El primero disponible',
    openDay: /— \d+ huecos$/,
    sampleDetails: 'Usar datos de ejemplo',
    confirmBooking: 'Confirmar la reserva',
    cancelAppointment: 'Anular la cita',
    yesCancel: 'Sí, anularla',
    seeWhoItSuits: 'Ver a quién le encaja',
    offerThisTime: 'Ofrecer este horario',
    offerTheTime: 'Ofrecer el horario',
    simulateAcceptance: 'Simular aceptación',
    close: 'Cerrar',
    tabAgenda: 'Agenda del día',
    tabOverview: 'Resumen'
  }
}
const ui = UI[LOCALE]
if (!ui) throw new Error(`unknown locale: ${LOCALE}`)

const COPY = {
  annotated: {
    open: ['Dr. Lorba', 'One doctor, three clinics, one appointment book'],
    practice: ['A fictional primary care doctor', 'Every name, clinic and appointment in this demo is invented'],
    clinics: ['Care across three neighbourhood clinics'],
    booking: ['Booking an appointment', 'Four short steps'],
    onebook: ['One book across all three clinics', 'Any location searches every clinic at once'],
    availability: ['Real availability, drawn from the same book'],
    details: ['Patient details', 'Sample details — nothing here is a real person'],
    confirmed: ['Confirmed', 'Booking reference'],
    desk: ['The same booking, at the front desk', 'One shared schedule — not a second system'],
    cancel: ['Elsewhere in the day, a patient cancels', 'The slot would normally go to waste'],
    matched: ['The freed time is matched against the waitlist'],
    suits: ['Only the patients the time actually suits', 'Longest wait first, each with the reason it fits'],
    offer: ['The offer message is simulated', 'This demo never sends an email, a text or a notification'],
    held: ['The time is held while the patient decides', 'Simulated hold, with a visible deadline'],
    accepted: ['Acceptance is simulated too', 'The agenda updates the moment it lands'],
    filled: ['The freed time is filled', 'The cancellation stays on the board, marked cancelled'],
    overview: ['One view over all three clinics'],
    perClinic: ['Occupancy, held time and free time, per clinic'],
    close: ['Dr. Lorba', 'Demonstration build — invented data throughout'],
    badge: true
  },
  commercial: {
    open: ['Dr. Lorba', 'One doctor, three clinics, one appointment book'],
    practice: ['Primary care, close to home', 'One doctor, consulting at three neighbourhood clinics'],
    clinics: ['Care across three neighbourhood clinics'],
    booking: ['Booking an appointment', 'Four short steps'],
    onebook: ['One book across all three clinics', 'Any location searches every clinic at once'],
    availability: ['Live availability, drawn from the same book'],
    details: ['Patient details', 'Just the essentials — no symptoms, no documents'],
    confirmed: ['Confirmed on the spot', 'Booking reference'],
    desk: ['The same booking, at the front desk', 'One shared schedule — not a second system'],
    cancel: ['Elsewhere in the day, a patient cancels', 'The slot would normally go to waste'],
    matched: ['The freed time goes straight to the waitlist'],
    suits: ['Only the patients the time actually suits', 'Longest wait first, each with the reason it fits'],
    offer: ['Reception offers the time', 'With the message already written, in their language'],
    held: ['The time is held while the patient decides', 'With a deadline everyone can see'],
    accepted: ['The patient accepts', 'The agenda updates the moment it lands'],
    filled: ['The freed time is filled', 'The cancellation stays on the board'],
    overview: ['One view over all three clinics'],
    perClinic: ['Occupancy, held time and free time, per clinic'],
    close: ['Dr. Lorba', 'A product demonstration, shown with sample data'],
    badge: false
  },
  'commercial-es': {
    open: ['Dr. Lorba', 'Un médico, tres clínicas, una sola agenda'],
    practice: ['Atención primaria, cerca de casa', 'Un solo médico, que pasa consulta en tres clínicas de barrio'],
    clinics: ['Atención en tres clínicas de barrio'],
    booking: ['Pedir cita', 'Cuatro pasos breves'],
    onebook: ['Una sola agenda para las tres clínicas', '«Cualquier sede» busca en todas a la vez'],
    availability: ['Disponibilidad real, de esa misma agenda'],
    details: ['Datos del paciente', 'Lo imprescindible: ni síntomas ni documentos'],
    confirmed: ['Confirmada al momento', 'Referencia'],
    desk: ['La misma cita, en recepción', 'Una agenda compartida, no un segundo sistema'],
    cancel: ['En otro punto del día, un paciente anula', 'Ese hueco se perdería'],
    matched: ['El hueco libre pasa directo a la lista de espera'],
    suits: ['Solo los pacientes a quienes les encaja', 'Primero quien más ha esperado, con el motivo'],
    offer: ['Recepción ofrece el horario', 'Con el mensaje ya escrito, en su idioma'],
    held: ['El horario queda reservado mientras decide', 'Con un plazo visible para todos'],
    accepted: ['El paciente acepta', 'La agenda se actualiza al instante'],
    filled: ['El hueco queda cubierto', 'La anulación sigue visible en el tablero'],
    overview: ['Una vista de las tres clínicas'],
    perClinic: ['Ocupación, tiempo reservado y tiempo libre, por clínica'],
    close: ['Dr. Lorba', 'Demostración de producto con datos de ejemplo'],
    badge: false
  }
}

const c = COPY[TAG]
if (!c) throw new Error(`no caption copy for: ${TAG}`)

const OUT = process.env.OUT ?? `video/raw-${TAG}`
const W = 1920
const H = 1080

/** Everything the overlay needs, defined before any app code runs on every page. */
const overlay = () => {
  const style = `
    #film { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
            font-family: Inter, system-ui, sans-serif; }
    #film .veil { position: absolute; inset: 0; background: #06231f; opacity: 0;
            transition: opacity 600ms ease; }
    #film .cap { position: absolute; left: 50%; bottom: 54px; transform: translateX(-50%) translateY(10px);
            opacity: 0; transition: opacity 420ms ease, transform 420ms ease;
            background: rgba(6,35,31,.92); color: #f4f1e9; border-radius: 10px;
            padding: 15px 26px; max-width: 1180px; text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,.28); }
    #film .cap.on { opacity: 1; transform: translateX(-50%) translateY(0); }
    #film .cap b { display: block; font-size: 29px; font-weight: 600; letter-spacing: -.01em; }
    #film .cap i { display: block; font-style: normal; font-size: 18px; font-weight: 500;
            opacity: .72; margin-top: 5px; }
    #film .tag { position: absolute; right: 42px; top: 34px; opacity: 0;
            transition: opacity 400ms ease; background: #b4472e; color: #fff;
            font-size: 16px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
            padding: 8px 15px; border-radius: 6px; }
    #film .tag.on { opacity: 1; }
    #film .card { position: absolute; inset: 0; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 16px; background: #06231f;
            color: #f4f1e9; opacity: 0; transition: opacity 650ms ease; }
    #film .card.on { opacity: 1; }
    #film .card b { font-family: Newsreader, Georgia, serif; font-size: 72px; font-weight: 500; }
    #film .card i { font-style: normal; font-size: 25px; opacity: .74; }
    #app { transform-origin: 0 0; }
  `
  const build = () => {
    if (document.getElementById('film')) return
    const el = document.createElement('style')
    el.textContent = style
    document.head.appendChild(el)
    const root = document.createElement('div')
    root.id = 'film'
    root.innerHTML =
      '<div class="veil"></div><div class="card"><b></b><i></i></div>' +
      '<div class="cap"><b></b><i></i></div><div class="tag">Simulated</div>'
    document.body.appendChild(root)
  }

  const q = (s) => document.querySelector('#film ' + s)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  window.film = {
    build,
    async say(text, note) {
      build()
      const cap = q('.cap')
      cap.querySelector('b').textContent = text
      cap.querySelector('i').textContent = note ?? ''
      cap.querySelector('i').style.display = note ? 'block' : 'none'
      cap.classList.add('on')
    },
    async hide() {
      q('.cap')?.classList.remove('on')
    },
    async tag(on) {
      build()
      q('.tag').classList.toggle('on', on)
    },
    async card(title, sub) {
      build()
      const card = q('.card')
      card.querySelector('b').textContent = title
      card.querySelector('i').textContent = sub ?? ''
      card.classList.add('on')
    },
    async uncard() {
      q('.card')?.classList.remove('on')
    },
    async veil(on) {
      build()
      q('.veil').style.opacity = on ? '1' : '0'
    },
    /**
     * Brings `sel` to the middle of the screen, then scales the app around that point.
     * Centring first matters: scaling around something near the foot of the page drags
     * the footer into shot and leaves a gap.
     */
    async zoom(sel, scale, ms = 1400) {
      const app = document.getElementById('app')
      const node = document.querySelector(sel)
      if (!app || !node) return false

      const box = node.getBoundingClientRect()
      const pageY = box.top + box.height / 2 + window.scrollY
      const wanted = Math.max(0, Math.min(pageY - window.innerHeight / 2,
        document.documentElement.scrollHeight - window.innerHeight))
      if (Math.abs(wanted - window.scrollY) > 8) await window.film.glide(wanted, 900)

      const after = node.getBoundingClientRect()
      const x = after.left + after.width / 2 + window.scrollX
      const y = after.top + after.height / 2 + window.scrollY
      app.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`
      app.style.transformOrigin = `${x}px ${y}px`
      app.style.transform = `scale(${scale})`
      return true
    },
    async unzoom(ms = 1100) {
      const app = document.getElementById('app')
      if (!app) return
      app.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`
      app.style.transform = 'scale(1)'
    },
    /** A slow, even scroll — the page's own smooth scrolling is too brisk to read. */
    async glide(to, ms) {
      const from = window.scrollY
      const start = performance.now()
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
      return new Promise((done) => {
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms)
          window.scrollTo(0, from + (to - from) * ease(t))
          t < 1 ? requestAnimationFrame(step) : done()
        }
        requestAnimationFrame(step)
      })
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build)
  else build()
}

const run = async () => {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] })

  // The scripted scenario is not in a fresh tab: the front desk has to load it, and that
  // click does not belong on camera. So it is loaded in a throwaway tab and the resulting
  // state is handed to the recorded one, which then opens with the demo already set up.
  const scenario = await (async () => {
    const setup = await browser.newContext({ viewport: { width: W, height: H } })
    const page = await setup.newPage()
    await page.goto(`${BASE}/demo/reception`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: UI.en.loadScenario }).click()
    await page.getByText(UI.en.scenarioLoaded).waitFor({ timeout: 10_000 })
    const state = await page.evaluate(() => sessionStorage.getItem('lorba-medical.demo-state'))
    await setup.close()
    if (!state) throw new Error('the scripted scenario did not save')
    console.log('  · scripted scenario loaded')
    return state
  })()

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
    locale: LOCALE === 'es' ? 'es-ES' : 'en-US',
    timezoneId: 'Europe/Madrid',
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference'
  })
  // Only ever seeds an empty tab, so the booking made on camera is not rolled back by the
  // next navigation.
  await ctx.addInitScript(([state, locale]) => {
    try {
      const key = 'lorba-medical.demo-state'
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, state)
      // The app picks its language up from here, so it is already in place on first paint
      // and no language switch has to happen on camera.
      sessionStorage.setItem('lorba-medical.locale', JSON.stringify(locale))
    } catch {
      /* the demo keeps working in memory only */
    }
  }, [scenario, LOCALE])
  await ctx.addInitScript(overlay)
  const page = await ctx.newPage()

  // Recording starts with the page, so cue times are taken from here. They are written out
  // as a subtitle track, since the captions are burnt in and cannot be translated later.
  const t0 = Date.now()
  const cues = []
  const at = () => (Date.now() - t0) / 1000

  const ms = (n) => page.waitForTimeout(n)
  const film = (fn, ...args) => page.evaluate(fn, ...args)
  const say = async (t, n) => {
    cues.push({ start: at(), end: null, text: t, note: n ?? '' })
    return film(([t, n]) => window.film.say(t, n), [t, n])
  }
  const hide = () => {
    const open = cues.filter((cue) => cue.end === null).pop()
    if (open) open.end = at()
    return film(() => window.film.hide())
  }
  const tag = (on) => film((on) => window.film.tag(on), on)
  const card = async (t, s) => {
    cues.push({ start: at(), end: null, text: t, note: s ?? '' })
    return film(([t, s]) => window.film.card(t, s), [t, s])
  }
  const uncard = () => {
    const open = cues.filter((cue) => cue.end === null).pop()
    if (open) open.end = at()
    return film(() => window.film.uncard())
  }
  const zoom = async (sel, scale, dur = 1400) => {
    const hit = await film(([sel, scale, dur]) => window.film.zoom(sel, scale, dur), [sel, scale, dur])
    if (!hit) throw new Error(`nothing to zoom on: ${sel}`)
  }
  const unzoom = (dur = 1100) => film((dur) => window.film.unzoom(dur), dur)
  const glide = (to, dur) => film(([to, dur]) => window.film.glide(to, dur), [to, dur])

  const beat = (name) => console.log(`  · ${name}`)

  // ---------------------------------------------------------------- 1. the practice
  beat('opening')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await ms(600)
  await card(...c.open)
  await ms(2600)
  await uncard()
  await ms(900)
  await say(...c.practice)
  await ms(3800)
  await glide(620, 3200)
  await say(...c.clinics)
  await ms(2600)
  await glide(1850, 3400)
  await hide()
  await ms(400)

  // ---------------------------------------------------------------- 2. booking
  beat('booking')
  await page.goto(`${BASE}/book/visit`, { waitUntil: 'networkidle' })
  await ms(700)
  await say(...c.booking)
  await ms(2400)
  await page.locator('.opt', { hasText: ui.service }).first().click()
  await ms(1100)
  await page.locator('.opt', { hasText: ui.firstVisit }).first().click()
  await ms(1200)
  await page.getByRole('button', { name: ui.continue }).click()
  await ms(1400)

  await say(...c.onebook)
  await ms(1200)
  await zoom('.group__grid', 1.26, 1500)
  await ms(2200)
  await page.locator('.opt', { hasText: ui.anyLocation }).first().click()
  await ms(1400)
  await unzoom(1000)
  await ms(1100)
  await page.locator('.opt', { hasText: ui.firstAvailable }).first().click()
  await ms(1000)
  await page.getByRole('button', { name: ui.continue }).click()
  await ms(1800)

  await say(...c.availability)
  const day = page.getByRole('button', { name: ui.openDay }).first()
  await day.waitFor({ state: 'visible', timeout: 20_000 })
  await ms(1200)
  await day.click()
  await page.locator('.slot').first().waitFor({ state: 'visible', timeout: 20_000 })
  await ms(1200)
  await zoom('.slots', 1.3, 1500)
  await ms(1800)
  await page.locator('.slot').first().click()
  await ms(1500)
  await unzoom(1000)
  await ms(900)
  await page.getByRole('button', { name: ui.continue }).click()
  await ms(1400)

  await say(...c.details)
  await page.getByRole('button', { name: ui.sampleDetails }).click()
  await ms(2200)
  await hide()
  await page.getByRole('button', { name: ui.confirmBooking }).click()
  await page.waitForURL(/\/booking\//, { timeout: 25_000 })
  await ms(1400)
  const reference = (await page.locator('.ticket__ref').innerText()).trim()
  console.log('  reference:', reference)
  await say(c.confirmed[0], `${c.confirmed[1]} ${reference}`)
  await ms(1000)
  await zoom('.ticket', 1.3, 1500)
  await ms(2600)
  await unzoom(900)
  await ms(900)
  await hide()
  await ms(600)

  // ---------------------------------------------------------------- 3. at reception
  beat('reception sees it')
  await page.goto(`${BASE}/demo/reception?ref=${reference}`, { waitUntil: 'networkidle' })
  await ms(1500)
  await say(...c.desk)
  await ms(1200)
  await zoom('.panel', 1.2, 1500)
  await ms(3200)
  await unzoom(1000)
  await ms(1000)
  await hide()
  await ms(500)

  // ---------------------------------------------------------------- 4. cancel + match
  beat('cancellation')
  await page.getByRole('button', { name: ui.openPrepared }).click()
  await ms(1300)
  const onScreen = (await page.locator('.panel__ref').innerText()).trim()
  if (onScreen !== 'LM-7F3K') throw new Error(`the scripted appointment did not open: ${onScreen}`)
  await ms(900)
  await say(...c.cancel)
  await ms(1800)
  await page.getByRole('button', { name: ui.cancelAppointment }).click()
  await ms(1200)
  await page.getByRole('button', { name: ui.yesCancel }).click()
  await ms(1800)

  await say(...c.matched)
  await ms(1200)
  await page.locator('.rec__opening').getByRole('button', { name: ui.seeWhoItSuits }).click()
  await ms(1600)
  await page.locator('.opening__actions button').first().click()
  await ms(1600)
  const matches = await page.locator('.candidate').count()
  if (matches < 2) throw new Error(`expected the scripted two candidates, found ${matches}`)
  console.log(`  matches: ${matches}`)
  await zoom('.candidate', 1.25, 1500)
  await say(...c.suits)
  await ms(3400)
  await unzoom(1000)
  await ms(900)

  // ---------------------------------------------------------------- 5. offer + accept
  beat('offer and acceptance')
  await page.locator('.candidate').first().getByRole('button', { name: ui.offerThisTime }).click()
  await ms(1500)
  await tag(c.badge)
  await zoom('.dialog', 1.3, 1500)
  await say(...c.offer)
  await ms(3600)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: ui.offerTheTime }).click()
  await ms(1800)
  await say(...c.held)
  await ms(2600)
  await dialog.getByRole('button', { name: ui.simulateAcceptance }).click()
  await ms(2000)
  await say(...c.accepted)
  await ms(3000)
  await dialog.locator('.dialog__actions').getByRole('button', { name: ui.close }).click()
  await ms(1200)
  await unzoom(900)
  await tag(false)
  await ms(700)

  await page.locator('.rec__tab', { hasText: ui.tabAgenda }).click()
  await ms(1600)
  await say(...c.filled)
  await ms(3400)
  await hide()
  await ms(600)

  // ---------------------------------------------------------------- 6. three clinics
  beat('three-clinic panel')
  await page.locator('.rec__tab', { hasText: ui.tabOverview }).click()
  await ms(1600)
  await say(...c.overview)
  await ms(1200)
  await zoom('.tiles--quiet', 1.2, 1500)
  await ms(2800)
  await unzoom(1000)
  await ms(900)
  await glide(700, 2600)
  await say(...c.perClinic)
  await ms(3200)
  await hide()
  await ms(800)

  await card(...c.close)
  await ms(3000)

  const video = page.video()
  const total = at()
  await ctx.close()
  await browser.close()
  const path = await video.path()

  // Any cue still open ran to the end of its beat; close it against the next one's start.
  cues.forEach((cue, index) => {
    if (cue.end === null) cue.end = index + 1 < cues.length ? cues[index + 1].start : total
  })
  const clock = (seconds) => {
    const whole = Math.max(0, seconds)
    const h = String(Math.floor(whole / 3600)).padStart(2, '0')
    const m = String(Math.floor((whole % 3600) / 60)).padStart(2, '0')
    const sec = String(Math.floor(whole % 60)).padStart(2, '0')
    const milli = String(Math.round((whole % 1) * 1000)).padStart(3, '0')
    return `${h}:${m}:${sec},${milli}`
  }
  const srt = cues
    .map((cue, index) =>
      `${index + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n` +
      `${cue.text}${cue.note ? `\n${cue.note}` : ''}\n`
    )
    .join('\n')
  await writeFile(`video/lorba-medical-demo.${TAG}.srt`, srt, 'utf8')
  // The narration script reads these, so the voice lands on the beat it belongs to.
  await writeFile(`video/cues.${TAG}.json`, JSON.stringify({ length: total, cues }, null, 2), 'utf8')

  console.log('\nfilmed:', path)
  console.log(`subtitles: video/lorba-medical-demo.${TAG}.srt`)
  console.log('length:', total.toFixed(1), 's')
}

run().catch(async (error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})

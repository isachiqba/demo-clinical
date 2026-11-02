import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import es from '@/i18n/locales/es'

/**
 * Every message is compiled at least once. vue-i18n treats `@`, `|` and `{` as syntax,
 * so a stray one in ordinary prose throws at render time and takes the component with
 * it — which is exactly how the email-format message broke the details step once.
 */
const paths = (value: unknown, prefix = ''): { key: string; text: string }[] => {
  if (typeof value === 'string') return [{ key: prefix, text: value }]
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key)
  )
}

const sampleParams = {
  count: 2,
  zone: 'America/New_York',
  name: 'Example Name',
  when: 'Monday, 9:00 AM',
  service: 'Primary care',
  location: 'Downtown',
  provider: 'Example Name',
  clinics: 'Downtown · Northside',
  time: '9:00 AM',
  patient: 'Sam Rivera',
  language: 'English',
  step: 'Appointment',
  email: 'someone@example.com',
  current: 1,
  total: 4,
  code: 'LM-AC34'
}

describe('every message compiles and renders', () => {
  for (const [locale, messages] of [
    ['en', en],
    ['es', es]
  ] as const) {
    it(`renders all ${locale} messages`, () => {
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } })
      const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string

      for (const { key, text } of paths(messages)) {
        expect(() => t(key, sampleParams), `${locale}: ${key}`).not.toThrow()
        const rendered = t(key, sampleParams)
        expect(rendered.length, `${locale}: ${key} rendered empty`).toBeGreaterThan(0)
        // A leftover placeholder means the sample params missed one.
        expect(rendered, `${locale}: ${key} has an unfilled placeholder`).not.toMatch(/\{\w+\}/)
        // Raw source should never leak a stray linked-message marker.
        if (text.includes('@')) expect(text).toMatch(/\{'@'\}/)
      }
    })
  }
})

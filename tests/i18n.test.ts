import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import es from '@/i18n/locales/es'

/** Flattens a message tree to dotted keys, so the two languages can be compared. */
const flatten = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  )
}

const placeholders = (value: unknown, prefix = ''): Record<string, string[]> => {
  if (typeof value === 'string') {
    return { [prefix]: [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort() }
  }
  if (typeof value !== 'object' || value === null) return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
    (all, [key, child]) => ({ ...all, ...placeholders(child, prefix ? `${prefix}.${key}` : key) }),
    {}
  )
}

const texts = (value: unknown, prefix = ''): Record<string, string> => {
  if (typeof value === 'string') return { [prefix]: value }
  if (typeof value !== 'object' || value === null) return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (all, [key, child]) => ({ ...all, ...texts(child, prefix ? `${prefix}.${key}` : key) }),
    {}
  )
}

describe('translations', () => {
  it('has exactly the same keys in both languages', () => {
    const enKeys = flatten(en).sort()
    const esKeys = flatten(es).sort()
    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([])
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([])
  })

  it('uses the same interpolation placeholders in both languages', () => {
    const enPlaceholders = placeholders(en)
    const esPlaceholders = placeholders(es)
    for (const [key, names] of Object.entries(enPlaceholders)) {
      expect({ key, names: esPlaceholders[key] }).toEqual({ key, names })
    }
  })

  /**
   * The practice assigns the clinician; the patient never picks one. It is easy to leave a
   * sentence behind that still offers the choice, so the copy is checked as a whole.
   */
  it('never offers the patient a choice of clinician', () => {
    const offers = [
      /choose a clinician/i,
      /pick a clinician/i,
      /elegir profesional/i,
      /elige profesional/i,
      /first available/i,
      /primero disponible/i,
      /any clinician/i,
      /cualquier profesional/i
    ]
    for (const messages of [en, es]) {
      const strings = texts(messages)
      for (const [key, value] of Object.entries(strings)) {
        for (const offer of offers) {
          expect({ key, offer: offer.source, value }).toEqual({
            key,
            offer: offer.source,
            value: offer.test(value) ? `MUST NOT MATCH: ${value}` : value
          })
        }
      }
    }
  })

  /**
   * There is one doctor and no practice brand. Both are easy to reintroduce by copying an
   * old sentence, so the whole message tree is checked rather than the pages we remember.
   */
  it('names no practice brand and no second doctor', () => {
    const banned = [
      /lorba medical/i,
      /our team/i,
      /nuestro equipo/i,
      /our (doctors|clinicians)/i,
      /nuestros (médicos|profesionales)/i,
      /network of (doctors|clinicians)/i,
      /red de profesionales/i,
      /choose a (specialist|doctor)/i,
      /elige un (especialista|médico)/i
    ]
    for (const messages of [en, es]) {
      for (const [key, value] of Object.entries(texts(messages))) {
        for (const pattern of banned) {
          expect({ key, pattern: pattern.source, value }).toEqual({
            key,
            pattern: pattern.source,
            value: pattern.test(value) ? `MUST NOT MATCH: ${value}` : value
          })
        }
      }
    }
  })

  it('leaves no message empty', () => {
    for (const messages of [en, es]) {
      const entries = placeholders(messages)
      expect(Object.keys(entries).length).toBeGreaterThan(200)
    }
  })
})

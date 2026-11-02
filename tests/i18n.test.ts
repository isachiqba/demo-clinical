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

  it('leaves no message empty', () => {
    for (const messages of [en, es]) {
      const entries = placeholders(messages)
      expect(Object.keys(entries).length).toBeGreaterThan(200)
    }
  })
})

import { createI18n } from 'vue-i18n'
import { STORAGE_KEYS, storage } from '@/services/storage'
import type { Locale, Localized } from '@/types'
import en from './locales/en'
import es from './locales/es'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es']

/** English is the demo's starting language; Spanish is the alternative. */
export const DEFAULT_LOCALE: Locale = 'en'

const initialLocale = (): Locale => {
  const saved = storage.read<Locale | null>(STORAGE_KEYS.locale, null)
  return saved && SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, es }
})

export const currentLocale = (): Locale => i18n.global.locale.value as Locale

/**
 * Switching language only changes the language. Every selection the visitor has made
 * lives in the Pinia stores, which this never touches.
 */
export const setLocale = (locale: Locale): void => {
  i18n.global.locale.value = locale
  storage.write(STORAGE_KEYS.locale, locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

/** Reads the active language out of a `Localized` record. */
export const localized = (value: Localized | undefined): string =>
  value ? value[currentLocale()] ?? value.en : ''

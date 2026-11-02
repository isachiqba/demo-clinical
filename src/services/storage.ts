/**
 * sessionStorage wrapper. Demo bookings survive a reload but never leave the tab, and
 * every access is guarded: private windows and blocked site data throw rather than
 * returning null.
 */

export const STORAGE_KEYS = {
  /** The whole demo — appointments, waitlist, offers, openings and activity. */
  demoState: 'lorba-medical.demo-state',
  draft: 'lorba-medical.booking-draft',
  locale: 'lorba-medical.locale'
} as const

const available = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export const storage = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = available()?.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },

  write(key: string, value: unknown): void {
    try {
      available()?.setItem(key, JSON.stringify(value))
    } catch {
      /* the demo keeps working in memory only */
    }
  },

  remove(key: string): void {
    try {
      available()?.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/**
 * sessionStorage wrapper. Demo bookings survive a reload but never leave the tab, and
 * every access is guarded: private windows and blocked site data throw rather than
 * returning null.
 */

/**
 * Bumped whenever the shape of the stored demo state changes.
 *
 * A tab that has been open across a deployment holds the old shape, and loading it back
 * produces a demo that is quietly broken in ways nobody can explain — a visit stuck in a
 * stage that no longer exists, a field read as `undefined`. Reading a version that is not
 * this one throws the stored state away and rebuilds the sample, which costs the person
 * nothing: it is demo data, and restoring it is a button they already have.
 */
export const SCHEMA_VERSION = 3

export const STORAGE_KEYS = {
  /** The whole demo — appointments, waitlist, offers, openings and activity. */
  demoState: 'dr-lorba.demo-state',
  draft: 'dr-lorba.booking-draft',
  locale: 'dr-lorba.locale'
} as const

const available = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

interface Versioned<T> {
  version: number
  value: T
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

  /**
   * Reads something written by `writeVersioned`. Anything written by an older build — or
   * by a build before versioning existed — is discarded rather than half-understood.
   */
  readVersioned<T>(key: string, fallback: T): T {
    try {
      const raw = available()?.getItem(key)
      if (!raw) return fallback
      const parsed = JSON.parse(raw) as Partial<Versioned<T>>
      if (parsed?.version !== SCHEMA_VERSION || parsed.value === undefined) return fallback
      return parsed.value as T
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

  writeVersioned(key: string, value: unknown): void {
    try {
      available()?.setItem(key, JSON.stringify({ version: SCHEMA_VERSION, value }))
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

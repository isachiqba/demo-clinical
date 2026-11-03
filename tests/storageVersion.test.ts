import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, STORAGE_KEYS, storage } from '@/services/storage'
import { createDemoSchedulingApi } from '@/services/schedulingApi'
import { isPresent } from '@/services/careFlow'
import { CARE_STAGES } from '@/types'

/**
 * A tab left open across a change of shape used to load its old state back and produce a
 * demo that was quietly wrong: visits sitting in a stage that no longer existed, missing
 * from the clinic list, and rendering a raw translation key. Versioning the stored state
 * fixes that, and this is the test that would have caught it.
 *
 * The suite runs in Node, where there is no `window` at all — which is exactly why none of
 * the existing tests could have caught it. These stand one up, so the persistence path is
 * actually exercised rather than skipped.
 */

const fakeStorage = () => {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear()
  }
}

let session: ReturnType<typeof fakeStorage>

beforeEach(() => {
  session = fakeStorage()
  ;(globalThis as { window?: unknown }).window = { sessionStorage: session }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('stored demo state', () => {
  it('ignores state written by an older build and rebuilds the sample', async () => {
    // Exactly what the previous version wrote: a visit in a stage that is gone.
    session.setItem(
      STORAGE_KEYS.demoState,
      JSON.stringify({
        version: SCHEMA_VERSION - 1,
        value: {
          appointments: [
            {
              id: 'stale',
              reference: 'LM-OLD1',
              visit: { stage: 'waiting', roomId: null, arrivedAtWall: '2026-01-01T09:00' }
            }
          ],
          waitlist: [],
          offers: [],
          openings: [],
          activity: []
        }
      })
    )

    const api = createDemoSchedulingApi({ simulateLatency: false })
    const state = await api.getState()

    expect(state.appointments.find((item) => item.id === 'stale')).toBeUndefined()
    expect(state.appointments.length).toBeGreaterThan(1)
  })

  it('ignores unversioned state, which is what builds before this wrote', async () => {
    session.setItem(
      STORAGE_KEYS.demoState,
      JSON.stringify({ appointments: [], waitlist: [], offers: [], openings: [], activity: [] })
    )

    const api = createDemoSchedulingApi({ simulateLatency: false })
    const state = await api.getState()
    expect(state.appointments.length).toBeGreaterThan(0)
  })

  it('keeps state this build wrote itself', async () => {
    const first = createDemoSchedulingApi({ simulateLatency: false })
    const before = await first.getState()
    const someone = before.appointments.find(isPresent)!
    await first.finishVisit(someone.id)

    // A reload: a second instance reads what the first persisted.
    const second = createDemoSchedulingApi({ simulateLatency: false })
    const after = await second.getState()
    const same = after.appointments.find((item) => item.id === someone.id)!
    expect(same.visit!.stage).toBe('finished')
  })

  it('leaves every visit in a stage the interface can name', async () => {
    const api = createDemoSchedulingApi({ simulateLatency: false })
    const state = await api.getState()
    for (const appointment of state.appointments) {
      if (!appointment.visit) continue
      expect(CARE_STAGES).toContain(appointment.visit.stage)
    }
  })

  it('survives storage that refuses to co-operate', () => {
    session.getItem = () => {
      throw new Error('blocked')
    }
    expect(storage.readVersioned(STORAGE_KEYS.demoState, 'fallback')).toBe('fallback')
  })

  it('writes its own version, so the next build can tell', async () => {
    const api = createDemoSchedulingApi({ simulateLatency: false })
    const live = await api.getState()
    await api.addNote(live.appointments[0].id, 'anything')

    const raw = session.getItem(STORAGE_KEYS.demoState)!
    expect(JSON.parse(raw).version).toBe(SCHEMA_VERSION)
  })
})

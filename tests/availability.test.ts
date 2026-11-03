import { describe, expect, it } from 'vitest'
import {
  LEAD_TIME_MINUTES,
  dayCapacity,
  firstAvailable,
  gridFor,
  isSlotOpen,
  searchDay,
  slotCounts,
  slotsForDay,
  takenAt
} from '@/services/availability'
import { locationById } from '@/data/locations'
import { minutesOf, minutesUntilWall, weekdayOfKey } from '@/services/clinicTime'
import { SLOT_MINUTES } from '@/types'
import type { Appointment, LocationId } from '@/types'

/** A Monday well clear of "now", so the lead-time rule never interferes. */
const MONDAY = '2026-06-01'
const NOW = new Date('2026-05-01T12:00:00.000Z')

const empty = { appointments: [] as Appointment[], offers: [] }

const base = {
  serviceId: 'primary-care' as const,
  locationId: 'downtown' as LocationId,
  dateKey: MONDAY,
  state: empty,
  now: NOW
}

const appointmentAt = (
  locationId: LocationId,
  startWall: string,
  overrides: Partial<Appointment> = {}
): Appointment => ({
  id: `a-${locationId}-${startWall}`,
  reference: 'LM-TEST',
  serviceId: 'primary-care',
  locationId,
  startWall,
  patientType: 'existing',
  patient: { firstName: 'A', lastName: 'B', email: 'a@example.com', phone: '', coverage: 'self-pay' },
  status: 'confirmed',
  curemd: {
    status: 'registered',
    reference: null,
    registered: { startWall, locationId, serviceId: 'primary-care', patientName: 'A B' },
    declaredAtWall: '2026-05-01T09:00',
    operator: 'Demo Reception'
  },
  pendingChange: null,
  proposal: null,
  version: 1,
  createdAtWall: '2026-05-01T09:00',
  audit: [],
  ...overrides
})

describe('the ten-minute grid', () => {
  it('offers starts every ten minutes', () => {
    const grid = gridFor('downtown', MONDAY)
    expect(grid.length).toBeGreaterThan(10)
    for (let index = 1; index < grid.length; index += 1) {
      const gap = minutesOf(grid[index]) - minutesOf(grid[index - 1])
      // Ten minutes apart, except for the jump over the lunch hour.
      expect(gap === SLOT_MINUTES || gap > SLOT_MINUTES).toBe(true)
    }
    expect(grid.every((start) => minutesOf(start) % SLOT_MINUTES === 0)).toBe(true)
  })

  it("stays inside the clinic's opening hours and skips lunch", () => {
    const clinic = locationById('downtown')!
    const hours = clinic.hours.find((entry) => entry.weekday === weekdayOfKey(MONDAY))!
    for (const start of gridFor('downtown', MONDAY)) {
      const minutes = minutesOf(start)
      expect(minutes).toBeGreaterThanOrEqual(hours.opensAt!)
      expect(minutes + SLOT_MINUTES).toBeLessThanOrEqual(hours.closesAt!)
      expect(minutes >= 12 * 60 && minutes < 13 * 60).toBe(false)
    }
  })

  it('offers nothing on a day the clinic is closed', () => {
    // 2026-06-07 is a Sunday; Westside is also closed on Saturdays.
    expect(gridFor('downtown', '2026-06-07')).toHaveLength(0)
    expect(gridFor('westside', '2026-06-06')).toHaveLength(0)
  })

  it('never offers a past time, nor one inside the lead-time window', () => {
    const slots = slotsForDay({ ...base, dateKey: '2026-06-01', now: new Date('2026-06-01T17:00:00.000Z') })
    for (const slot of slots) {
      const ahead = minutesUntilWall(slot.startWall, new Date('2026-06-01T17:00:00.000Z'))
      expect(ahead).toBeGreaterThanOrEqual(LEAD_TIME_MINUTES)
    }
  })
})

describe('capacity', () => {
  it('is one patient per slot by default, and comes from the clinic', () => {
    expect(locationById('downtown')!.slotCapacity).toBe(1)
    expect(dayCapacity('downtown', MONDAY)).toBe(gridFor('downtown', MONDAY).length)
  })

  it('counts a booking, a request and a pending move against the slot', () => {
    const [first, second] = gridFor('downtown', MONDAY)

    const booked = { appointments: [appointmentAt('downtown', first)], offers: [] }
    expect(takenAt('downtown', first, booked)).toBe(1)
    expect(isSlotOpen({ locationId: 'downtown', startWall: first }, booked, NOW)).toBe(false)

    // A request holds the slot locally too, so the demo cannot take it twice.
    const requested = {
      appointments: [
        appointmentAt('downtown', first, {
          status: 'requested',
          curemd: {
            status: 'pending-registration',
            reference: null,
            registered: null,
            declaredAtWall: null,
            operator: null
          }
        })
      ],
      offers: []
    }
    expect(isSlotOpen({ locationId: 'downtown', startWall: first }, requested, NOW)).toBe(false)

    // A move that reception has not yet applied holds the *new* time as well as the old.
    const moving = {
      appointments: [
        appointmentAt('downtown', first, {
          curemd: {
            status: 'change-pending',
            reference: null,
            registered: {
              startWall: first,
              locationId: 'downtown',
              serviceId: 'primary-care',
              patientName: 'A B'
            },
            declaredAtWall: '2026-05-01T09:00',
            operator: 'Demo Reception'
          },
          pendingChange: {
            startWall: second,
            locationId: 'downtown',
            requestedAtWall: '2026-05-01T10:00',
            source: 'reception',
            offerId: null
          }
        })
      ],
      offers: []
    }
    expect(isSlotOpen({ locationId: 'downtown', startWall: first }, moving, NOW)).toBe(false)
    expect(isSlotOpen({ locationId: 'downtown', startWall: second }, moving, NOW)).toBe(false)
  })

  it('frees the slot again once an appointment is cancelled', () => {
    const [first] = gridFor('downtown', MONDAY)
    const cancelled = {
      appointments: [
        appointmentAt('downtown', first, {
          status: 'cancelled',
          curemd: {
            status: 'cancelled',
            reference: null,
            registered: null,
            declaredAtWall: null,
            operator: null
          }
        })
      ],
      offers: []
    }
    expect(isSlotOpen({ locationId: 'downtown', startWall: first }, cancelled, NOW)).toBe(true)
  })

  it('keeps the slot taken while a cancellation is only pending in CureMD', () => {
    const [first] = gridFor('downtown', MONDAY)
    const pending = {
      appointments: [
        appointmentAt('downtown', first, {
          status: 'confirmed',
          curemd: {
            status: 'cancellation-pending',
            reference: 'CMD-1',
            registered: {
              startWall: first,
              locationId: 'downtown',
              serviceId: 'primary-care',
              patientName: 'A B'
            },
            declaredAtWall: '2026-05-01T09:00',
            operator: 'Demo Reception'
          }
        })
      ],
      offers: []
    }
    expect(isSlotOpen({ locationId: 'downtown', startWall: first }, pending, NOW)).toBe(false)
  })

  it("does not count another clinic's booking against this one", () => {
    const [first] = gridFor('downtown', MONDAY)
    const elsewhere = { appointments: [appointmentAt('northside', first)], offers: [] }
    expect(takenAt('downtown', first, elsewhere)).toBe(0)
  })
})

describe('searching', () => {
  it('returns every clinic in order when none is chosen', () => {
    const slots = searchDay({ ...base, locationId: 'any' })
    const starts = slots.map((slot) => slot.startWall)
    expect(starts).toEqual([...starts].sort())
    expect(new Set(slots.map((slot) => slot.locationId)).size).toBeGreaterThan(1)
  })

  it('counts what it would list for each day', () => {
    const counts = slotCounts({ ...base, locationId: 'any', fromKey: MONDAY, days: 4 })
    for (const [dateKey, count] of Object.entries(counts)) {
      expect(searchDay({ ...base, locationId: 'any', dateKey }).length).toBe(count)
    }
  })

  it('finds the first opening from the data, not a fixed date', () => {
    const slot = firstAvailable({ ...base, locationId: 'any', fromKey: MONDAY })
    expect(slot).not.toBeNull()
    const counts = slotCounts({ ...base, locationId: 'any', fromKey: MONDAY, days: 10 })
    const firstDay = Object.keys(counts)
      .sort()
      .find((key) => counts[key] > 0)
    expect(slot!.startWall.slice(0, 10)).toBe(firstDay)
  })
})

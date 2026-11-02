import { describe, expect, it } from 'vitest'
import {
  LEAD_TIME_MINUTES,
  firstAvailable,
  isSlotOpen,
  providerDayWindow,
  slotCounts,
  slotsForDay,
  slotsForProviderDay
} from '@/services/availability'
import { locationById } from '@/data/locations'
import { minutesOf, weekdayOfKey, wallToInstant } from '@/services/clinicTime'
import type { Appointment, Slot } from '@/types'

/** A Monday well clear of "now", so lead time never interferes. */
const MONDAY = '2026-06-01'
const NOW = new Date('2026-05-01T12:00:00.000Z')

const base = {
  serviceId: 'primary-care' as const,
  locationId: 'downtown' as const,
  providerId: 'ap-elena-sandoval',
  appointments: [] as Appointment[],
  now: NOW
}

const appointmentFrom = (slot: Slot, overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  reference: 'LM-TEST',
  serviceId: slot.serviceId,
  providerId: slot.providerId,
  locationId: slot.locationId,
  startWall: slot.startWall,
  durationMinutes: slot.durationMinutes,
  patientType: 'existing',
  patient: { firstName: 'A', lastName: 'B', email: 'a@example.com', phone: '', coverage: 'self-pay' },
  status: 'confirmed',
  createdAtWall: '2026-05-01T09:00',
  ...overrides
})

describe('availability generation', () => {
  it('is deterministic for the same provider, clinic and day', () => {
    const first = slotsForProviderDay({ ...base, dateKey: MONDAY })
    const second = slotsForProviderDay({ ...base, dateKey: MONDAY })
    expect(first.map((slot) => slot.id)).toEqual(second.map((slot) => slot.id))
    expect(first.length).toBeGreaterThan(0)
  })

  it('never returns a slot outside the clinics opening hours', () => {
    const clinic = locationById('downtown')!
    const hours = clinic.hours.find((entry) => entry.weekday === weekdayOfKey(MONDAY))!
    for (const slot of slotsForProviderDay({ ...base, dateKey: MONDAY })) {
      const start = minutesOf(slot.startWall)
      expect(start).toBeGreaterThanOrEqual(hours.opensAt!)
      expect(start + slot.durationMinutes).toBeLessThanOrEqual(hours.closesAt!)
    }
  })

  it('returns nothing on a day the clinic is closed', () => {
    // Westside is closed at weekends; 2026-06-06 is a Saturday.
    expect(
      slotsForProviderDay({
        ...base,
        locationId: 'westside',
        providerId: 'ap-marcus-feld',
        dateKey: '2026-06-06'
      })
    ).toHaveLength(0)
  })

  it('returns nothing for a clinician who does not work at that clinic', () => {
    // Howard Brennan works at Northside and Westside, not Downtown.
    expect(
      slotsForProviderDay({ ...base, providerId: 'ap-howard-brennan', dateKey: MONDAY })
    ).toHaveLength(0)
  })

  it('never offers a past time, nor one inside the lead-time window', () => {
    const slots = slotsForProviderDay({ ...base, dateKey: '2026-06-01', now: new Date('2026-06-01T17:00:00.000Z') })
    for (const slot of slots) {
      const minutesAhead = (wallToInstant(slot.startWall).getTime() - Date.parse('2026-06-01T17:00:00.000Z')) / 60_000
      expect(minutesAhead).toBeGreaterThanOrEqual(LEAD_TIME_MINUTES)
    }
  })

  it('removes a slot once it is booked, and gives it back when cancelled', () => {
    const open = slotsForProviderDay({ ...base, dateKey: MONDAY })
    const target = open[1]

    const booked = slotsForProviderDay({
      ...base,
      dateKey: MONDAY,
      appointments: [appointmentFrom(target)]
    })
    expect(booked.map((slot) => slot.startWall)).not.toContain(target.startWall)
    expect(booked).toHaveLength(open.length - 1)

    const cancelled = slotsForProviderDay({
      ...base,
      dateKey: MONDAY,
      appointments: [appointmentFrom(target, { status: 'cancelled' })]
    })
    expect(cancelled.map((slot) => slot.startWall)).toContain(target.startWall)
    expect(cancelled).toHaveLength(open.length)
  })

  it('blocks an overlapping appointment, not only an identical start time', () => {
    const open = slotsForProviderDay({ ...base, dateKey: MONDAY })
    const target = open[0]
    // A 45-minute appointment starting 10 minutes earlier straddles the slot.
    const straddling = appointmentFrom(target, {
      startWall: `${target.startWall.slice(0, 14)}${String(Number(target.startWall.slice(14, 16)) - 10).padStart(2, '0')}`,
      durationMinutes: 45
    })
    const after = slotsForProviderDay({ ...base, dateKey: MONDAY, appointments: [straddling] })
    expect(after.map((slot) => slot.startWall)).not.toContain(target.startWall)
  })

  it('leaves the lunch hour alone', () => {
    for (const slot of slotsForProviderDay({ ...base, dateKey: MONDAY })) {
      const start = minutesOf(slot.startWall)
      const end = start + slot.durationMinutes
      expect(start < 13 * 60 && end > 12 * 60).toBe(false)
    }
  })

  it('offers each time once when searching across clinicians', () => {
    const slots = slotsForDay({ ...base, providerId: 'any', dateKey: MONDAY })
    const starts = slots.map((slot) => slot.startWall)
    expect(new Set(starts).size).toBe(starts.length)
    expect(starts).toEqual([...starts].sort())
  })

  it('finds more across any clinic than at one of them', () => {
    const one = slotsForDay({ ...base, providerId: 'any', dateKey: MONDAY })
    const all = slotsForDay({ ...base, locationId: 'any', providerId: 'any', dateKey: MONDAY })
    expect(all.length).toBeGreaterThanOrEqual(one.length)
  })

  it('computes first availability from the data, not a fixed date', () => {
    const slot = firstAvailable({ ...base, fromKey: MONDAY })
    expect(slot).not.toBeNull()
    expect(slot!.startWall >= MONDAY).toBe(true)

    // It is genuinely the earliest: every earlier day holds nothing.
    const counts = slotCounts({ ...base, fromKey: MONDAY, days: 14 })
    const firstDayWithSlots = Object.keys(counts)
      .sort()
      .find((key) => counts[key] > 0)
    expect(slot!.startWall.slice(0, 10)).toBe(firstDayWithSlots)
  })

  it('counts the openings it would list for each day', () => {
    const counts = slotCounts({ ...base, fromKey: MONDAY, days: 5 })
    for (const [dateKey, count] of Object.entries(counts)) {
      expect(slotsForDay({ ...base, dateKey }).length).toBe(count)
    }
  })

  it('validates a single slot against the live appointments', () => {
    const slot = slotsForProviderDay({ ...base, dateKey: MONDAY })[0]
    expect(isSlotOpen(slot, [], [], NOW)).toBe(true)
    expect(isSlotOpen(slot, [appointmentFrom(slot)], [], NOW)).toBe(false)
    expect(isSlotOpen(slot, [appointmentFrom(slot, { status: 'cancelled' })], [], NOW)).toBe(true)
  })

  it('treats a held slot as taken, and frees it when the hold goes', () => {
    const open = slotsForProviderDay({ ...base, dateKey: MONDAY })
    const held = open[1]

    expect(isSlotOpen(held, [], [held], NOW)).toBe(false)
    expect(isSlotOpen(held, [], [], NOW)).toBe(true)

    const withHold = slotsForProviderDay({ ...base, dateKey: MONDAY, holds: [held] })
    expect(withHold.map((slot) => slot.startWall)).not.toContain(held.startWall)
    expect(withHold).toHaveLength(open.length - 1)
  })

  it('measures the minutes a clinician offers at a clinic on a day', () => {
    const window = providerDayWindow('ap-elena-sandoval', 'downtown', MONDAY)
    expect(window).not.toBeNull()
    expect(window!.minutes).toBeGreaterThan(0)
    // The lunch hour is not capacity.
    expect(window!.minutes).toBeLessThanOrEqual(window!.endMinutes - window!.startMinutes)

    // A clinician who does not work there offers nothing.
    expect(providerDayWindow('ap-howard-brennan', 'downtown', MONDAY)).toBeNull()
    // Nor does anyone on a Sunday.
    expect(providerDayWindow('ap-elena-sandoval', 'downtown', '2026-06-07')).toBeNull()
  })
})

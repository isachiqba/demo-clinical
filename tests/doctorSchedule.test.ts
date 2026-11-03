import { describe, expect, it } from 'vitest'
import { TRAVEL_BUFFER_MINUTES, blocksOnWeekday, doctor } from '@/data/doctor'
import { locationById, locations } from '@/data/locations'
import { createDemoSchedulingApi } from '@/services/schedulingApi'
import {
  conflictsElsewhere,
  dayCapacity,
  dayGrid,
  gridFor,
  isSlotOpen,
  searchDay,
  slotCapacityOf
} from '@/services/availability'
import { addDaysToKey, dateKeyOf, minutesOf, todayKey, weekdayOfKey } from '@/services/clinicTime'
import { SLOT_MINUTES } from '@/types'
import type { DemoState } from '@/types'

/**
 * There is one doctor. These are the rules that follow from that, and they are the ones
 * worth guarding, because every one of them is easy to break by editing the timetable.
 */

const WEEK = [0, 1, 2, 3, 4, 5, 6]

describe('the consulting timetable', () => {
  it('never puts him in two clinics at once', () => {
    for (const weekday of WEEK) {
      const blocks = blocksOnWeekday(weekday)
      for (let i = 1; i < blocks.length; i += 1) {
        expect({ weekday, overlap: blocks[i].startsAt < blocks[i - 1].endsAt }).toEqual({
          weekday,
          overlap: false
        })
      }
    }
  })

  it('leaves him time to travel between clinics on the same day', () => {
    for (const weekday of WEEK) {
      const blocks = blocksOnWeekday(weekday)
      for (let i = 1; i < blocks.length; i += 1) {
        if (blocks[i].locationId === blocks[i - 1].locationId) continue
        const gap = blocks[i].startsAt - blocks[i - 1].endsAt
        expect({ weekday, enough: gap >= TRAVEL_BUFFER_MINUTES }).toEqual({
          weekday,
          enough: true
        })
      }
    }
  })

  it('only ever seats him while the clinic is open', () => {
    for (const block of doctor.blocks) {
      const location = locationById(block.locationId)!
      const opening = location.hours.find((entry) => entry.weekday === block.weekday)!
      expect({
        clinic: block.locationId,
        weekday: block.weekday,
        inside:
          opening.opensAt !== null &&
          opening.closesAt !== null &&
          block.startsAt >= opening.opensAt &&
          block.endsAt <= opening.closesAt
      }).toEqual({ clinic: block.locationId, weekday: block.weekday, inside: true })
    }
  })

  it('keeps every block a whole number of ten-minute slots wide', () => {
    for (const block of doctor.blocks) {
      expect((block.endsAt - block.startsAt) % SLOT_MINUTES).toBe(0)
    }
  })
})

describe('the grid that comes out of it', () => {
  /** The next date whose weekday is the one asked for. */
  const next = (weekday: number): string => {
    for (let offset = 0; offset < 8; offset += 1) {
      const key = addDaysToKey(todayKey(), offset)
      if (weekdayOfKey(key) === weekday) return key
    }
    throw new Error('unreachable')
  }

  it('offers times only where he actually is', () => {
    // Tuesday: Northside in the morning, Westside in the afternoon, Downtown not at all.
    const tuesday = next(2)
    expect(gridFor('downtown', tuesday)).toEqual([])
    expect(gridFor('northside', tuesday).length).toBeGreaterThan(0)
    expect(gridFor('westside', tuesday).length).toBeGreaterThan(0)
  })

  it('never offers the same minute at two clinics', () => {
    for (let offset = 0; offset < 14; offset += 1) {
      const dateKey = addDaysToKey(todayKey(), offset)
      const starts = dayGrid(dateKey).map((slot) => slot.startWall)
      expect({ dateKey, duplicated: starts.length !== new Set(starts).size }).toEqual({
        dateKey,
        duplicated: false
      })
    }
  })

  it('skips the breaks he takes inside a block', () => {
    const monday = next(1)
    const northside = gridFor('northside', monday).map(minutesOf)
    // Monday afternoon runs 14:00–18:00 with a break at 16:00–16:20.
    expect(northside).toContain(15 * 60 + 50)
    expect(northside).not.toContain(16 * 60)
    expect(northside).not.toContain(16 * 60 + 10)
    expect(northside).toContain(16 * 60 + 20)
  })

  it('does not multiply his capacity by the number of clinics', () => {
    for (let offset = 0; offset < 14; offset += 1) {
      const dateKey = addDaysToKey(todayKey(), offset)
      const perClinic = locations.reduce(
        (total, location) => total + dayCapacity(location.id, dateKey),
        0
      )
      const minutes = blocksOnWeekday(weekdayOfKey(dateKey)).reduce(
        (total, block) =>
          total +
          (block.endsAt - block.startsAt) -
          (block.pause ? block.pause[1] - block.pause[0] : 0),
        0
      )
      // His whole day, counted once, at one patient per slot.
      expect({ dateKey, perClinic }).toEqual({
        dateKey,
        perClinic: (minutes / SLOT_MINUTES) * slotCapacityOf('downtown')
      })
    }
  })
})

describe('booking against the one agenda', () => {
  const freshState = async (): Promise<{ api: ReturnType<typeof createDemoSchedulingApi>; state: DemoState }> => {
    const api = createDemoSchedulingApi({ simulateLatency: false })
    const state = await api.reset()
    return { api, state }
  }

  it('"any clinic" returns his genuinely soonest time, wherever it is', async () => {
    const { api } = await freshState()
    const soonest = await api.getFirstAvailable({
      serviceId: 'primary-care',
      locationId: 'any',
      fromKey: todayKey()
    })
    expect(soonest).not.toBeNull()

    // Nothing anywhere is earlier than it.
    const earlier = await api.getDaySlots({
      serviceId: 'primary-care',
      locationId: 'any',
      dateKey: dateKeyOf(soonest!.startWall)
    })
    expect(earlier[0].startWall).toBe(soonest!.startWall)
  })

  it('an appointment at one clinic blocks a conflicting time at another', async () => {
    const { api } = await freshState()
    const slot = (await api.getFirstAvailable({
      serviceId: 'primary-care',
      locationId: 'any',
      fromKey: addDaysToKey(todayKey(), 3)
    }))!

    const booked = await api.requestAppointment({
      serviceId: 'primary-care',
      locationId: slot.locationId,
      slot,
      patientType: 'new',
      patient: {
        firstName: 'Ada',
        lastName: 'Keel',
        email: 'ada.keel@example.com',
        phone: '',
        coverage: 'self-pay'
      }
    })
    expect(booked.ok).toBe(true)

    const state = await api.getState()
    const others = locations.map((l) => l.id).filter((id) => id !== slot.locationId)
    for (const other of others) {
      expect({
        clinic: other,
        blocked: conflictsElsewhere(other, slot.startWall, state)
      }).toEqual({ clinic: other, blocked: true })
    }
  })

  it('offers nothing at another clinic inside the travel buffer', async () => {
    const { api } = await freshState()
    const state = await api.getState()

    // Every open slot in the next fortnight, checked against every other clinic.
    for (let offset = 0; offset < 14; offset += 1) {
      const dateKey = addDaysToKey(todayKey(), offset)
      const open = searchDay({
        serviceId: 'primary-care',
        locationId: 'any',
        dateKey,
        state
      })
      for (const slot of open) {
        const tooClose = open.filter(
          (other) =>
            other.locationId !== slot.locationId &&
            Math.abs(minutesOf(other.startWall) - minutesOf(slot.startWall)) <
              TRAVEL_BUFFER_MINUTES + SLOT_MINUTES
        )
        expect({ slot: slot.id, tooClose: tooClose.map((o) => o.id) }).toEqual({
          slot: slot.id,
          tooClose: []
        })
      }
    }
  })

  it('frees the time across every clinic once a cancellation is done in CureMD', async () => {
    const { api } = await freshState()
    const slot = (await api.getFirstAvailable({
      serviceId: 'primary-care',
      locationId: 'any',
      fromKey: addDaysToKey(todayKey(), 3)
    }))!

    const booked = await api.requestAppointment({
      serviceId: 'primary-care',
      locationId: slot.locationId,
      slot,
      patientType: 'new',
      patient: {
        firstName: 'Ada',
        lastName: 'Keel',
        email: 'ada.keel@example.com',
        phone: '',
        coverage: 'self-pay'
      }
    })
    if (!booked.ok) throw new Error('setup failed')

    await api.declareRegistration(booked.appointment.id, { confirmNow: true })
    await api.requestCancellation(booked.appointment.id)

    // Still his, as far as CureMD knows, so the time is not given away.
    let state = await api.getState()
    expect(isSlotOpen(slot, state)).toBe(false)

    await api.declareCancellationDone(booked.appointment.id)
    state = await api.getState()
    expect(isSlotOpen(slot, state)).toBe(true)

    // And it is his whole day that frees up, not one clinic's copy of it: no other clinic
    // was ever offering that minute in the first place.
    for (const other of locations.map((l) => l.id).filter((id) => id !== slot.locationId)) {
      expect(gridFor(other, dateKeyOf(slot.startWall))).not.toContain(slot.startWall)
    }
  })
})

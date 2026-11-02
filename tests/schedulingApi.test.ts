import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, type SchedulingApi } from '@/services/schedulingApi'
import { addDaysToKey, todayKey } from '@/services/clinicTime'
import type { PatientDetails } from '@/types'

/**
 * These exercise the seam the UI talks to. A far-enough-ahead day keeps the lead-time
 * rule from making the fixtures flaky when the suite runs late in the day.
 */
const DAY = addDaysToKey(todayKey(), 9)

const patient: PatientDetails = {
  firstName: 'Sam',
  lastName: 'Rivera',
  email: 'sam.rivera@example.com',
  phone: '',
  coverage: 'insurance'
}

const search = {
  serviceId: 'primary-care' as const,
  locationId: 'downtown' as const,
  providerId: 'ap-elena-sandoval'
}

let api: SchedulingApi

beforeEach(() => {
  api = createDemoSchedulingApi({ simulateLatency: false })
})

describe('scheduling api', () => {
  it('starts from the seeded demo schedule', async () => {
    const appointments = await api.listAppointments()
    expect(appointments.length).toBeGreaterThan(5)
    expect(appointments.every((appointment) => appointment.reference.startsWith('LM-'))).toBe(true)
  })

  it('books a slot, and that slot is then gone', async () => {
    const before = await api.getDaySlots({ ...search, dateKey: DAY })
    const target = before[0]

    const result = await api.book({ ...search, slot: target, patientType: 'new', patient })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.appointment.status).toBe('confirmed')
    expect(result.appointment.reference).toMatch(/^LM-[A-Z0-9]{4}$/)

    const after = await api.getDaySlots({ ...search, dateKey: DAY })
    expect(after.map((slot) => slot.startWall)).not.toContain(target.startWall)
    expect(after).toHaveLength(before.length - 1)
  })

  it('refuses a slot that was taken while the form was open', async () => {
    const [target] = await api.getDaySlots({ ...search, dateKey: DAY })
    await api.book({ ...search, slot: target, patientType: 'new', patient })

    const second = await api.book({
      ...search,
      slot: target,
      patientType: 'new',
      patient: { ...patient, email: 'someone.else@example.com' }
    })
    expect(second).toEqual({ ok: false, reason: 'slot-taken' })
  })

  it('refuses the same person booking the same time twice', async () => {
    const [target] = await api.getDaySlots({ ...search, dateKey: DAY })
    await api.book({ ...search, slot: target, patientType: 'new', patient })

    // Free it so the slot check passes, then try the identical booking again.
    const appointments = await api.listAppointments()
    const created = appointments[appointments.length - 1]
    await api.setStatus(created.id, 'cancelled')

    const duplicate = await api.book({ ...search, slot: target, patientType: 'new', patient })
    expect(duplicate.ok).toBe(true)
  })

  it('frees the slot again when an appointment is cancelled', async () => {
    const before = await api.getDaySlots({ ...search, dateKey: DAY })
    const target = before[0]
    const booked = await api.book({ ...search, slot: target, patientType: 'new', patient })
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    await api.setStatus(booked.appointment.id, 'cancelled')

    const after = await api.getDaySlots({ ...search, dateKey: DAY })
    expect(after.map((slot) => slot.startWall)).toContain(target.startWall)
    expect(after).toHaveLength(before.length)
  })

  it('moves an appointment to a free slot and releases the old one', async () => {
    const slots = await api.getDaySlots({ ...search, dateKey: DAY })
    const booked = await api.book({ ...search, slot: slots[0], patientType: 'new', patient })
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    const open = await api.getDaySlots({ ...search, dateKey: DAY })
    const moved = await api.reschedule(booked.appointment.id, open[0])
    expect(moved.ok).toBe(true)
    if (!moved.ok) return

    expect(moved.appointment.startWall).toBe(open[0].startWall)

    const afterMove = await api.getDaySlots({ ...search, dateKey: DAY })
    // The original time is free again; the new one is not on offer.
    expect(afterMove.map((slot) => slot.startWall)).toContain(slots[0].startWall)
    expect(afterMove.map((slot) => slot.startWall)).not.toContain(open[0].startWall)
  })

  it('will not reschedule onto a time another patient holds', async () => {
    const slots = await api.getDaySlots({ ...search, dateKey: DAY })
    const first = await api.book({ ...search, slot: slots[0], patientType: 'new', patient })
    const second = await api.book({
      ...search,
      slot: slots[1],
      patientType: 'new',
      patient: { ...patient, email: 'other@example.com' }
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    const clash = await api.reschedule(second.appointment.id, slots[0])
    expect(clash).toEqual({ ok: false, reason: 'slot-taken' })
  })

  it('lets an appointment be rescheduled onto its own current time', async () => {
    const slots = await api.getDaySlots({ ...search, dateKey: DAY })
    const booked = await api.book({ ...search, slot: slots[0], patientType: 'new', patient })
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    const same = await api.reschedule(booked.appointment.id, slots[0])
    expect(same.ok).toBe(true)
  })

  it('walks the status sequence and reports a missing appointment', async () => {
    const slots = await api.getDaySlots({ ...search, dateKey: DAY })
    const booked = await api.book({ ...search, slot: slots[0], patientType: 'new', patient })
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    for (const status of ['arrived', 'completed', 'cancelled'] as const) {
      const result = await api.setStatus(booked.appointment.id, status)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.appointment.status).toBe(status)
    }

    expect(await api.setStatus('nope', 'arrived')).toEqual({ ok: false, reason: 'not-found' })
    expect(await api.reschedule('nope', slots[0])).toEqual({ ok: false, reason: 'not-found' })
  })

  it('restores the demo schedule, dropping anything booked in the session', async () => {
    const original = await api.listAppointments()
    const slots = await api.getDaySlots({ ...search, dateKey: DAY })
    await api.book({ ...search, slot: slots[0], patientType: 'new', patient })
    expect((await api.listAppointments()).length).toBe(original.length + 1)

    const restored = await api.reset()
    expect(restored.appointments.length).toBe(original.length)
    expect(restored.appointments.map((item) => item.id)).toEqual(original.map((item) => item.id))
    // A reset clears the waitlist's offers, holds and the activity feed too.
    expect(restored.offers).toEqual([])
    expect(restored.openings).toEqual([])
    expect(restored.activity).toEqual([])
  })

  it('reports first availability per clinician, and across all of them', async () => {
    const perProvider = await api.getProviderAvailability({
      serviceId: 'primary-care',
      locationId: 'any',
      fromKey: todayKey()
    })
    expect(perProvider).toHaveLength(3)
    expect(perProvider.every((entry) => entry.next !== null)).toBe(true)

    const anyone = await api.getFirstAvailable({
      serviceId: 'primary-care',
      locationId: 'any',
      providerId: 'any',
      fromKey: todayKey()
    })
    const earliest = perProvider
      .map((entry) => entry.next!.startWall)
      .sort()[0]
    expect(anyone!.startWall).toBe(earliest)
  })
})

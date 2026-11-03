import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, type SchedulingApi } from '@/services/schedulingApi'
import { SCRIPTED } from '@/data/demoScenario'
import { incoherences, pendingTaskOf } from '@/services/curemd'
import { gridFor, isSlotOpen } from '@/services/availability'
import { addDaysToKey, dateKeyOf, todayKey } from '@/services/clinicTime'
import type { Appointment, DemoState, PatientDetails } from '@/types'

/**
 * The manual CureMD flow: a request arrives, reception declares they entered it by hand,
 * and from then on every change and cancellation is a separate job in the other system.
 */

let api: SchedulingApi

const patient: PatientDetails = {
  firstName: 'Dana',
  lastName: 'Quist',
  email: 'dana.quist@example.com',
  phone: '',
  coverage: 'self-pay'
}

beforeEach(async () => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  await api.reset()
})

const state = (): Promise<DemoState> => api.getState()
const findIn = (s: DemoState, id: string): Appointment => s.appointments.find((a) => a.id === id)!

/**
 * A free slot well away from the scripted pieces. The doctor is only at Northside on some
 * weekdays, so this walks forward to the next day he actually consults there.
 */
const freeSlot = async (): Promise<{ locationId: 'northside'; startWall: string }> => {
  for (let offset = 9; offset < 30; offset += 1) {
    const dateKey = addDaysToKey(todayKey(), offset)
    const slots = await api.getDaySlots({
      serviceId: 'primary-care',
      locationId: 'northside',
      dateKey
    })
    if (slots.length) return { locationId: 'northside', startWall: slots[0].startWall }
  }
  throw new Error('no Northside slot within a month')
}

const makeRequest = async (): Promise<Appointment> => {
  const slot = await freeSlot()
  const result = await api.requestAppointment({
    serviceId: 'primary-care',
    locationId: 'northside',
    slot: { id: 'x', serviceId: 'primary-care', ...slot },
    patientType: 'new',
    patient
  })
  if (!result.ok) throw new Error(result.reason)
  return result.appointment
}

describe('a request from the public site', () => {
  it('arrives as a request that is not in CureMD', async () => {
    const appointment = await makeRequest()
    expect(appointment.status).toBe('requested')
    expect(appointment.curemd.status).toBe('pending-registration')
    expect(appointment.curemd.registered).toBeNull()
    expect(pendingTaskOf(appointment)).toBe('registration')
    expect(appointment.audit[0].kind).toBe('request-created')
    expect(incoherences(appointment)).toEqual([])
  })

  it('cannot be confirmed while it is still only a request', async () => {
    const appointment = await makeRequest()
    expect(await api.confirmAppointment(appointment.id)).toEqual({
      ok: false,
      reason: 'not-allowed'
    })
    expect(findIn(await state(), appointment.id).status).toBe('requested')
  })

  it('takes its slot locally, so the same time cannot be asked for twice', async () => {
    const appointment = await makeRequest()
    const again = await api.requestAppointment({
      serviceId: 'primary-care',
      locationId: 'northside',
      slot: {
        id: 'x',
        serviceId: 'primary-care',
        locationId: 'northside',
        startWall: appointment.startWall
      },
      patientType: 'new',
      patient: { ...patient, email: 'someone.else@example.com' }
    })
    expect(again).toEqual({ ok: false, reason: 'slot-taken' })
  })
})

describe('declaring the manual registration', () => {
  it('records who declared it, when, and what they say they entered', async () => {
    const appointment = await makeRequest()
    const result = await api.declareRegistration(appointment.id, {
      curemdReference: ' CMD-9001 ',
      confirmNow: true
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const saved = result.appointment
    expect(saved.curemd.status).toBe('registered')
    expect(saved.curemd.reference).toBe('CMD-9001')
    expect(saved.curemd.operator).toBe('Demo Reception')
    expect(saved.curemd.declaredAtWall).not.toBeNull()
    expect(saved.curemd.registered?.startWall).toBe(saved.startWall)
    // Confirmed in the same action, because the dialog asked for it.
    expect(saved.status).toBe('confirmed')
    expect(saved.audit.map((entry) => entry.kind)).toContain('registration-declared')
    expect(saved.audit.map((entry) => entry.kind)).toContain('appointment-confirmed')
    expect(incoherences(saved)).toEqual([])
  })

  it('leaves the appointment unconfirmed when reception does not confirm it', async () => {
    const appointment = await makeRequest()
    const result = await api.declareRegistration(appointment.id, { confirmNow: false })
    expect(result.ok && result.appointment.status).toBe('requested')
    expect(result.ok && result.appointment.curemd.status).toBe('registered')
    // Now it can be confirmed, because it is in CureMD.
    expect((await api.confirmAppointment(appointment.id)).ok).toBe(true)
  })

  it('is idempotent and refuses a stale declaration', async () => {
    const appointment = await makeRequest()
    const first = await api.declareRegistration(appointment.id, { curemdReference: 'CMD-1' })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const twice = await api.declareRegistration(appointment.id, { curemdReference: 'CMD-2' })
    expect(twice.ok).toBe(true)
    // Nothing changed the second time round.
    if (twice.ok) expect(twice.appointment.curemd.reference).toBe('CMD-1')

    expect(
      await api.declareRegistration(appointment.id, { expectedVersion: appointment.version })
    ).toEqual({ ok: false, reason: 'stale' })
  })
})

describe('changing an appointment', () => {
  it('before registration, the request simply moves and stays pending', async () => {
    const appointment = await makeRequest()
    const dateKey = addDaysToKey(todayKey(), 10)
    const slots = await api.getDaySlots({ serviceId: 'primary-care', locationId: 'northside', dateKey })

    const moved = await api.requestChange(appointment.id, slots[0])
    expect(moved.ok).toBe(true)
    if (!moved.ok) return

    expect(moved.appointment.startWall).toBe(slots[0].startWall)
    expect(moved.appointment.curemd.status).toBe('pending-registration')
    expect(moved.appointment.pendingChange).toBeNull()
    expect(pendingTaskOf(moved.appointment)).toBe('registration')
  })

  it('after registration, the old time stands and the new one only pends', async () => {
    const appointment = await makeRequest()
    await api.declareRegistration(appointment.id, { curemdReference: 'CMD-7', confirmNow: true })
    const before = findIn(await state(), appointment.id)

    const dateKey = addDaysToKey(todayKey(), 10)
    const slots = await api.getDaySlots({ serviceId: 'primary-care', locationId: 'northside', dateKey })
    const asked = await api.requestChange(appointment.id, slots[0])
    expect(asked.ok).toBe(true)
    if (!asked.ok) return

    const moving = asked.appointment
    expect(moving.curemd.status).toBe('change-pending')
    expect(moving.startWall).toBe(before.startWall)
    expect(moving.curemd.registered?.startWall).toBe(before.startWall)
    expect(moving.pendingChange?.startWall).toBe(slots[0].startWall)
    expect(pendingTaskOf(moving)).toBe('change')
    expect(incoherences(moving)).toEqual([])

    // Both times are held while this is outstanding.
    const live = await state()
    const occupancy = { appointments: live.appointments, offers: live.offers }
    expect(isSlotOpen({ locationId: 'northside', startWall: before.startWall }, occupancy)).toBe(false)
    expect(isSlotOpen({ locationId: 'northside', startWall: slots[0].startWall }, occupancy)).toBe(false)
  })

  it('applies the change only when reception says they did it in CureMD', async () => {
    const appointment = await makeRequest()
    await api.declareRegistration(appointment.id, { curemdReference: 'CMD-7', confirmNow: true })
    const original = findIn(await state(), appointment.id).startWall

    const dateKey = addDaysToKey(todayKey(), 10)
    const slots = await api.getDaySlots({ serviceId: 'primary-care', locationId: 'northside', dateKey })
    await api.requestChange(appointment.id, slots[0])

    const applied = await api.declareChangeApplied(appointment.id)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    const saved = applied.appointment
    expect(saved.startWall).toBe(slots[0].startWall)
    expect(saved.curemd.status).toBe('registered')
    expect(saved.curemd.registered?.startWall).toBe(slots[0].startWall)
    expect(saved.pendingChange).toBeNull()
    expect(saved.audit.map((entry) => entry.kind)).toContain('change-applied')

    // Only now is the old time free, and it is offered to the waitlist.
    const live = await state()
    expect(
      isSlotOpen(
        { locationId: 'northside', startWall: original },
        { appointments: live.appointments, offers: live.offers }
      )
    ).toBe(true)
    expect(live.openings.some((opening) => opening.slot.startWall === original)).toBe(true)
  })

  it('does not treat a local edit as having done the work in CureMD', async () => {
    const appointment = await makeRequest()
    await api.declareRegistration(appointment.id, { confirmNow: true })
    const dateKey = addDaysToKey(todayKey(), 10)
    const slots = await api.getDaySlots({ serviceId: 'primary-care', locationId: 'northside', dateKey })
    await api.requestChange(appointment.id, slots[0])

    const saved = findIn(await state(), appointment.id)
    expect(saved.curemd.status).toBe('change-pending')
    expect(pendingTaskOf(saved)).toBe('change')
  })
})

describe('cancelling', () => {
  it('a request that never reached CureMD needs nothing doing there', async () => {
    const appointment = await makeRequest()
    const cancelled = await api.requestCancellation(appointment.id)
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return

    expect(cancelled.appointment.status).toBe('cancelled')
    expect(cancelled.appointment.curemd.status).toBe('not-required')
    expect(pendingTaskOf(cancelled.appointment)).toBeNull()
    expect(incoherences(cancelled.appointment)).toEqual([])

    const live = await state()
    expect(
      isSlotOpen(
        { locationId: 'northside', startWall: appointment.startWall },
        { appointments: live.appointments, offers: live.offers }
      )
    ).toBe(true)
  })

  it('a registered appointment stays on the books until CureMD is updated', async () => {
    const appointment = await makeRequest()
    await api.declareRegistration(appointment.id, { curemdReference: 'CMD-4', confirmNow: true })

    const asked = await api.requestCancellation(appointment.id)
    expect(asked.ok).toBe(true)
    if (!asked.ok) return

    expect(asked.appointment.status).toBe('confirmed')
    expect(asked.appointment.curemd.status).toBe('cancellation-pending')
    expect(pendingTaskOf(asked.appointment)).toBe('cancellation')

    // The slot is not given away yet, and no opening is announced.
    const held = await state()
    expect(
      isSlotOpen(
        { locationId: 'northside', startWall: appointment.startWall },
        { appointments: held.appointments, offers: held.offers }
      )
    ).toBe(false)
    expect(held.openings).toHaveLength(0)

    const done = await api.declareCancellationDone(appointment.id)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.appointment.status).toBe('cancelled')
    expect(done.appointment.curemd.status).toBe('cancelled')
    // The CureMD reference survives for the record.
    expect(done.appointment.curemd.reference).toBe('CMD-4')

    const free = await state()
    expect(
      isSlotOpen(
        { locationId: 'northside', startWall: appointment.startWall },
        { appointments: free.appointments, offers: free.offers }
      )
    ).toBe(true)
    expect(free.openings).toHaveLength(1)
  })

  it('closes a request as not available when nothing can be agreed', async () => {
    const appointment = await makeRequest()
    const closed = await api.markUnavailable(appointment.id)
    expect(closed.ok).toBe(true)
    if (!closed.ok) return
    expect(closed.appointment.status).toBe('unavailable')
    expect(closed.appointment.curemd.status).toBe('not-required')
    expect(incoherences(closed.appointment)).toEqual([])
  })
})

describe('proposing another time', () => {
  it('changes nothing until the patient accepts, but holds the slot', async () => {
    const appointment = await makeRequest()
    // Another Northside day he consults on, after the one the request sits in.
    let alternative: { locationId: 'northside'; startWall: string } | null = null
    for (let offset = 12; offset < 30 && alternative === null; offset += 1) {
      const dateKey = addDaysToKey(todayKey(), offset)
      const [slot] = await api.getDaySlots({
        serviceId: 'primary-care',
        locationId: 'northside',
        dateKey
      })
      if (slot) alternative = { locationId: 'northside', startWall: slot.startWall }
    }
    expect(alternative).not.toBeNull()
    const slots = [alternative!]

    const proposed = await api.proposeAlternative(appointment.id, slots[0])
    expect(proposed.ok).toBe(true)
    if (!proposed.ok) return

    expect(proposed.appointment.startWall).toBe(appointment.startWall)
    expect(proposed.appointment.proposal?.startWall).toBe(slots[0].startWall)

    const held = await state()
    expect(
      isSlotOpen(
        { locationId: 'northside', startWall: slots[0].startWall },
        { appointments: held.appointments, offers: held.offers }
      )
    ).toBe(false)

    const accepted = await api.acceptProposal(appointment.id)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.appointment.startWall).toBe(slots[0].startWall)
    expect(accepted.appointment.proposal).toBeNull()
    expect(accepted.appointment.curemd.status).toBe('pending-registration')
  })
})

describe('the scripted scenario', () => {
  it('sets out one example of every state, across the three clinics', async () => {
    const live = await state()
    const byId = (id: string) => live.appointments.find((a) => a.id === id)!

    expect(byId(SCRIPTED.pendingRegistration).curemd.status).toBe('pending-registration')
    expect(byId(SCRIPTED.registered).curemd.status).toBe('registered')
    expect(byId(SCRIPTED.changePending).curemd.status).toBe('change-pending')
    expect(byId(SCRIPTED.cancellationPending).curemd.status).toBe('cancellation-pending')

    const clinics = new Set(Object.values(SCRIPTED).map((id) => byId(id).locationId))
    expect(clinics.size).toBe(3)

    // Every appointment in the scenario is internally coherent and on the real grid.
    for (const appointment of live.appointments) {
      expect(incoherences(appointment)).toEqual([])
      expect(gridFor(appointment.locationId, dateKeyOf(appointment.startWall))).toContain(
        appointment.startWall
      )
    }

    expect(live.waitlist).toHaveLength(3)
  })

  it('restores every part of the demo', async () => {
    const appointment = await makeRequest()
    await api.declareRegistration(appointment.id, { confirmNow: true })
    expect((await state()).activity.length).toBeGreaterThan(0)

    const restored = await api.reset()
    expect(restored.appointments.find((a) => a.id === appointment.id)).toBeUndefined()
    expect(restored.offers).toEqual([])
    expect(restored.openings).toEqual([])
    expect(restored.activity).toEqual([])
    expect(restored.waitlist.every((entry) => entry.status === 'waiting')).toBe(true)
  })
})

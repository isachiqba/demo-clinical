import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, type SchedulingApi } from '@/services/schedulingApi'
import { SCRIPTED } from '@/data/demoScenario'
import { candidatesForSlot, mismatchReasons } from '@/services/waitlist'
import { isSlotOpen } from '@/services/availability'
import { minutesUntilWall } from '@/services/clinicTime'
import { pendingTaskOf } from '@/services/curemd'
import type { Appointment, DemoState } from '@/types'

/**
 * The waitlist, under the new rules: no clinician preferences, and a slot is never
 * offered while its cancellation is still only pending in CureMD.
 */

let api: SchedulingApi

beforeEach(async () => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  await api.reset()
})

const state = (): Promise<DemoState> => api.getState()
const byId = (s: DemoState, id: string): Appointment => s.appointments.find((a) => a.id === id)!

/** Completes the scripted cancellation, which is what actually frees the slot. */
const freeTheScriptedSlot = async (): Promise<DemoState> => {
  await api.declareCancellationDone(SCRIPTED.cancellationPending)
  return state()
}

describe('matching', () => {
  it('has no rule about clinicians', async () => {
    const live = await state()
    for (const entry of live.waitlist) {
      expect(Object.keys(entry.preferences)).not.toContain('providerId')
    }
  })

  it('offers nothing while the cancellation is only pending in CureMD', async () => {
    const live = await state()
    const pending = byId(live, SCRIPTED.cancellationPending)
    expect(pendingTaskOf(pending)).toBe('cancellation')

    // No opening has been announced, and the slot is not free.
    expect(live.openings).toHaveLength(0)
    expect(
      isSlotOpen(
        { locationId: pending.locationId, startWall: pending.startWall },
        { appointments: live.appointments, offers: live.offers }
      )
    ).toBe(false)
  })

  it('finds the two compatible patients once the slot is genuinely free', async () => {
    const live = await freeTheScriptedSlot()
    expect(live.openings).toHaveLength(1)

    const candidates = await api.candidatesForOpening(live.openings[0].id)
    expect(candidates.map((candidate) => candidate.entry.id)).toEqual(['wl-nadia', 'wl-marguerite'])
    expect(candidates[0].reasons.some((reason) => reason.key === 'waitingSince')).toBe(true)
    expect(candidates[1].reasons.some((reason) => reason.key === 'bringsForward')).toBe(true)
  })

  it('leaves out the patient the slot does not suit, and says why', async () => {
    const live = await freeTheScriptedSlot()
    const slot = live.openings[0].slot
    const iris = live.waitlist.find((entry) => entry.id === 'wl-iris')!

    const reasons = mismatchReasons(iris, slot, { appointments: live.appointments })
    expect(reasons).toContain('service')
    expect(reasons).toContain('location')
  })

  it('never offers a time later than the one the patient already holds', async () => {
    const live = await freeTheScriptedSlot()
    const marguerite = live.waitlist.find((entry) => entry.id === 'wl-marguerite')!
    const later = byId(live, marguerite.linkedAppointmentId!)

    const tooLate = { ...live.openings[0].slot, startWall: `${later.startWall.slice(0, 11)}23:00` }
    expect(mismatchReasons(marguerite, tooLate, { appointments: live.appointments })).toContain(
      'not-earlier'
    )
  })

  it('matches nobody once the slot is taken again', async () => {
    const live = await freeTheScriptedSlot()
    const slot = live.openings[0].slot
    const taken: Appointment[] = [
      ...live.appointments,
      { ...byId(live, SCRIPTED.registered), id: 'other', startWall: slot.startWall, locationId: slot.locationId }
    ]
    expect(
      isSlotOpen(slot, { appointments: taken, offers: [] })
    ).toBe(false)
    expect(
      candidatesForSlot(live.waitlist, slot, { appointments: live.appointments })
    ).toHaveLength(2)
  })
})

describe('offering and accepting', () => {
  const offerToTop = async () => {
    const live = await freeTheScriptedSlot()
    const opening = live.openings[0]
    const candidates = await api.candidatesForOpening(opening.id)
    const offer = await api.offerOpening(opening.id, candidates[0].entry.id)
    return { opening, candidates, offer }
  }

  it('holds the slot while the offer is out, and says until when', async () => {
    const { opening, offer } = await offerToTop()
    expect(offer.ok).toBe(true)
    if (!offer.ok) return

    expect(minutesUntilWall(offer.offer.holdUntilWall)).toBeGreaterThan(10)

    const slots = await api.getDaySlots({
      serviceId: opening.slot.serviceId,
      locationId: opening.slot.locationId,
      dateKey: opening.slot.startWall.slice(0, 10)
    })
    expect(slots.map((slot) => slot.startWall)).not.toContain(opening.slot.startWall)
  })

  it('turns an acceptance into a request, not a confirmed appointment', async () => {
    const { offer } = await offerToTop()
    if (!offer.ok) return

    const accepted = await api.respondToOffer(offer.offer.id, 'accept')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok || !accepted.appointment) return

    expect(accepted.appointment.status).toBe('requested')
    expect(accepted.appointment.curemd.status).toBe('pending-registration')
    expect(pendingTaskOf(accepted.appointment)).toBe('registration')
  })

  it('turns an acceptance by a registered patient into a pending change', async () => {
    const live = await freeTheScriptedSlot()
    const opening = live.openings[0]
    const marguerite = live.waitlist.find((entry) => entry.id === 'wl-marguerite')!
    const linkedId = marguerite.linkedAppointmentId!
    const before = byId(live, linkedId)

    const offer = await api.offerOpening(opening.id, marguerite.id)
    expect(offer.ok).toBe(true)
    if (!offer.ok) return

    const accepted = await api.respondToOffer(offer.offer.id, 'accept')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    const after = byId(await state(), linkedId)
    // Her original appointment is untouched until reception does the work in CureMD.
    expect(after.startWall).toBe(before.startWall)
    expect(after.status).toBe('confirmed')
    expect(after.curemd.status).toBe('change-pending')
    expect(after.pendingChange?.startWall).toBe(opening.slot.startWall)
    expect(after.pendingChange?.source).toBe('waitlist')
    expect(pendingTaskOf(after)).toBe('change')
  })

  it('counts the slot as covered only once the replacement is registered', async () => {
    const live = await freeTheScriptedSlot()
    const opening = live.openings[0]
    const candidates = await api.candidatesForOpening(opening.id)
    const offer = await api.offerOpening(opening.id, candidates[0].entry.id)
    if (!offer.ok) return
    const accepted = await api.respondToOffer(offer.offer.id, 'accept')
    if (!accepted.ok || !accepted.appointment) return

    const { overviewMetrics } = await import('@/services/metrics')
    const range = {
      fromKey: opening.slot.startWall.slice(0, 10),
      toKey: opening.slot.startWall.slice(0, 10),
      locationId: 'all' as const
    }
    expect(overviewMetrics(await state(), range).now.filledFromWaitlist).toBe(0)

    await api.declareRegistration(accepted.appointment.id, { confirmNow: true })
    expect(overviewMetrics(await state(), range).now.filledFromWaitlist).toBe(1)
  })

  it('releases the hold on a decline and lets the next candidate be offered', async () => {
    const { opening, candidates, offer } = await offerToTop()
    if (!offer.ok) return

    expect((await api.respondToOffer(offer.offer.id, 'decline')).ok).toBe(true)
    const live = await state()
    expect(live.waitlist.find((entry) => entry.id === candidates[0].entry.id)?.status).toBe('waiting')
    expect(live.openings[0].status).toBe('open')

    expect((await api.offerOpening(opening.id, candidates[1].entry.id)).ok).toBe(true)
  })

  it('cannot be accepted twice', async () => {
    const { offer } = await offerToTop()
    if (!offer.ok) return
    expect((await api.respondToOffer(offer.offer.id, 'accept')).ok).toBe(true)
    expect(await api.respondToOffer(offer.offer.id, 'accept')).toEqual({
      ok: false,
      reason: 'offer-closed'
    })
  })

  it('puts a patient back on the list if reception drops the change', async () => {
    const live = await freeTheScriptedSlot()
    const marguerite = live.waitlist.find((entry) => entry.id === 'wl-marguerite')!
    const offer = await api.offerOpening(live.openings[0].id, marguerite.id)
    if (!offer.ok) return
    await api.respondToOffer(offer.offer.id, 'accept')

    const dropped = await api.abandonChange(marguerite.linkedAppointmentId!)
    expect(dropped.ok).toBe(true)
    if (!dropped.ok) return

    expect(dropped.appointment.pendingChange).toBeNull()
    expect(dropped.appointment.curemd.status).toBe('registered')
    const after = await state()
    expect(after.waitlist.find((entry) => entry.id === marguerite.id)?.status).toBe('waiting')
  })
})

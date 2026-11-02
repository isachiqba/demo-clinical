import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, HOLD_MINUTES, type SchedulingApi } from '@/services/schedulingApi'
import { scenarioIds } from '@/data/demoScenario'
import { candidatesForSlot, mismatchReasons } from '@/services/waitlist'
import { minutesUntilWall } from '@/services/clinicTime'
import type { DemoState, PatientDetails, WaitlistPreferences } from '@/types'

let api: SchedulingApi

const fresh = async (): Promise<DemoState> => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  return api.reset()
}

beforeEach(async () => {
  await fresh()
})

const scriptedAppointment = (state: DemoState) =>
  state.appointments.find((item) => item.id === scenarioIds.openingAppointment)!

/** Cancels the scripted appointment and returns the opening it leaves behind. */
const cancelScripted = async (): Promise<DemoState> => {
  const before = await api.getState()
  await api.setStatus(scriptedAppointment(before).id, 'cancelled')
  return api.getState()
}

const samplePatient: PatientDetails = {
  firstName: 'Dana',
  lastName: 'Quist',
  email: 'dana.quist@example.com',
  phone: '',
  coverage: 'self-pay'
}

const samplePreferences = (state: DemoState): WaitlistPreferences => {
  const slot = scriptedAppointment(state)
  return {
    serviceId: slot.serviceId,
    locationIds: [slot.locationId],
    providerId: 'any',
    fromKey: slot.startWall.slice(0, 10),
    toKey: slot.startWall.slice(0, 10),
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    bands: ['morning', 'afternoon', 'evening'],
    language: 'en'
  }
}

describe('joining and leaving the waitlist', () => {
  it('adds an entry and lets the patient leave again', async () => {
    const state = await api.getState()
    const result = await api.joinWaitlist({
      patient: samplePatient,
      preferences: samplePreferences(state)
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.entry.status).toBe('waiting')
    expect(result.entry.reference).toMatch(/^WL-[A-Z0-9]{4}$/)
    expect((await api.getState()).waitlist).toHaveLength(state.waitlist.length + 1)

    const left = await api.withdrawFromWaitlist(result.entry.id)
    expect(left.ok).toBe(true)
    const after = (await api.getState()).waitlist.find((entry) => entry.id === result.entry.id)
    expect(after?.status).toBe('withdrawn')
  })

  it('refuses the same person twice for the same appointment type', async () => {
    const state = await api.getState()
    await api.joinWaitlist({ patient: samplePatient, preferences: samplePreferences(state) })
    const again = await api.joinWaitlist({
      patient: samplePatient,
      preferences: samplePreferences(state)
    })
    expect(again).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('attaches an entry to an existing booking', async () => {
    const state = await api.getState()
    const booking = scriptedAppointment(state)
    const result = await api.joinWaitlist({
      patient: samplePatient,
      preferences: samplePreferences(state),
      linkedAppointmentId: booking.id
    })
    expect(result.ok && result.entry.linkedAppointmentId).toBe(booking.id)
  })
})

describe('matching a freed slot', () => {
  it('records an opening when a future appointment is cancelled', async () => {
    const state = await cancelScripted()
    expect(state.openings).toHaveLength(1)
    expect(state.openings[0].source).toBe('cancellation')
    expect(state.openings[0].status).toBe('open')

    const detected = state.activity.find((event) => event.kind === 'opening-detected')
    expect(detected).toBeDefined()
    // The notification carries the real number of matches, not a guess.
    expect(detected!.detail.count).toBe(2)
  })

  it('finds the two compatible patients, longest wait first', async () => {
    const state = await cancelScripted()
    const candidates = await api.candidatesForOpening(state.openings[0].id)

    expect(candidates.map((candidate) => candidate.entry.id)).toEqual(['wl-nadia', 'wl-henry'])
    expect(candidates[0].reasons.some((reason) => reason.key === 'waitingSince')).toBe(true)
    // The one with a later appointment is shown as bringing it forward.
    expect(candidates[1].reasons.some((reason) => reason.key === 'bringsForward')).toBe(true)
  })

  it('leaves out the patient the slot does not suit, and says why', async () => {
    const state = await cancelScripted()
    const slot = state.openings[0].slot
    const iris = state.waitlist.find((entry) => entry.id === 'wl-iris')!

    const reasons = mismatchReasons(iris, slot, { appointments: state.appointments, holds: [] })
    expect(reasons).toContain('service')
    expect(reasons).toContain('location')
    expect(reasons).not.toHaveLength(0)
  })

  it('never offers a slot to someone whose own appointment is already earlier', async () => {
    const state = await cancelScripted()
    const henry = state.waitlist.find((entry) => entry.id === 'wl-henry')!
    const later = state.appointments.find((item) => item.id === henry.linkedAppointmentId)!

    const laterSlot = {
      ...state.openings[0].slot,
      startWall: later.startWall.slice(0, 11) + '23:00'
    }
    expect(
      mismatchReasons(henry, laterSlot, { appointments: state.appointments, holds: [] })
    ).toContain('not-earlier')
  })

  it('matches nobody once the slot is no longer free', async () => {
    const state = await cancelScripted()
    const slot = state.openings[0].slot
    expect(
      candidatesForSlot(state.waitlist, slot, { appointments: state.appointments, holds: [slot] })
    ).toHaveLength(0)
  })
})

describe('offering a slot', () => {
  const offerToTop = async () => {
    const state = await cancelScripted()
    const opening = state.openings[0]
    const candidates = await api.candidatesForOpening(opening.id)
    const result = await api.offerOpening(opening.id, candidates[0].entry.id)
    return { opening, candidates, result }
  }

  it('holds the slot while the offer is pending, and says until when', async () => {
    const { opening, result } = await offerToTop()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.offer.status).toBe('pending')
    const minutes = minutesUntilWall(result.offer.holdUntilWall)
    expect(minutes).toBeGreaterThan(HOLD_MINUTES - 2)
    expect(minutes).toBeLessThanOrEqual(HOLD_MINUTES)

    // While held, the slot is off the public calendar.
    const offered = await api.getDaySlots({
      serviceId: opening.slot.serviceId,
      locationId: opening.slot.locationId,
      providerId: opening.slot.providerId,
      dateKey: opening.slot.startWall.slice(0, 10)
    })
    expect(offered.map((slot) => slot.startWall)).not.toContain(opening.slot.startWall)

    const state = await api.getState()
    expect(state.waitlist.find((entry) => entry.id === result.offer.entryId)?.status).toBe('offered')
  })

  it('will not offer the same opening or the same patient twice over', async () => {
    const { opening, candidates } = await offerToTop()
    expect(await api.offerOpening(opening.id, candidates[1].entry.id)).toEqual({
      ok: false,
      reason: 'already-offered'
    })
  })

  it('refuses to offer a slot to someone it does not suit', async () => {
    const state = await cancelScripted()
    expect(await api.offerOpening(state.openings[0].id, 'wl-iris')).toEqual({
      ok: false,
      reason: 'no-match'
    })
  })
})

describe('responding to an offer', () => {
  const setUp = async () => {
    const cancelled = await cancelScripted()
    const opening = cancelled.openings[0]
    const candidates = await api.candidatesForOpening(opening.id)
    return { opening, candidates }
  }

  it('creates the booking on acceptance and fills the opening', async () => {
    const { opening, candidates } = await setUp()
    const nadia = candidates[0].entry
    const offered = await api.offerOpening(opening.id, nadia.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    const accepted = await api.respondToOffer(offered.offer.id, 'accept')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    expect(accepted.appointment).not.toBeNull()
    expect(accepted.appointment!.startWall).toBe(opening.slot.startWall)
    expect(accepted.appointment!.patient.email).toBe(nadia.patient.email)

    const state = await api.getState()
    expect(state.openings[0].status).toBe('filled')
    expect(state.waitlist.find((entry) => entry.id === nadia.id)?.status).toBe('accepted')
    expect(state.activity[0].kind).toBe('offer-accepted')
  })

  it('swaps a later appointment for the earlier one, atomically', async () => {
    const { opening, candidates } = await setUp()
    const henry = candidates.find((candidate) => candidate.entry.id === 'wl-henry')!.entry
    const before = await api.getState()
    const laterId = henry.linkedAppointmentId!
    const later = before.appointments.find((item) => item.id === laterId)!

    const offered = await api.offerOpening(opening.id, henry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    const accepted = await api.respondToOffer(offered.offer.id, 'accept')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    const state = await api.getState()
    const replaced = state.appointments.find((item) => item.id === laterId)!
    expect(replaced.status).toBe('cancelled')
    expect(accepted.appointment!.startWall < later.startWall).toBe(true)
    expect(accepted.offer.replacedAppointmentId).toBe(laterId)

    // Exactly one live appointment for that patient, not two.
    const live = state.appointments.filter(
      (item) =>
        item.patient.email === henry.patient.email && item.status !== 'cancelled'
    )
    expect(live).toHaveLength(1)
  })

  it('protects the held slot from being taken while the offer is out', async () => {
    const { opening, candidates } = await setUp()
    const offered = await api.offerOpening(opening.id, candidates[0].entry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    // Reception tries to move another appointment into the held time.
    const state = await api.getState()
    const other = state.appointments.find((item) => item.status === 'confirmed')!
    expect(await api.reschedule(other.id, opening.slot)).toEqual({ ok: false, reason: 'slot-taken' })

    const after = await api.getState()
    expect(after.appointments.find((item) => item.id === other.id)?.startWall).toBe(other.startWall)
  })

  it('will not accept a lapsed offer, and the patient keeps the appointment they had', async () => {
    const { opening, candidates } = await setUp()
    const henry = candidates.find((candidate) => candidate.entry.id === 'wl-henry')!.entry
    const laterId = henry.linkedAppointmentId!

    const offered = await api.offerOpening(opening.id, henry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    await api.respondToOffer(offered.offer.id, 'expire')
    expect(await api.respondToOffer(offered.offer.id, 'accept')).toEqual({
      ok: false,
      reason: 'offer-closed'
    })

    // Nothing was given up: the later appointment is exactly as it was.
    const after = await api.getState()
    expect(after.appointments.find((item) => item.id === laterId)?.status).toBe('confirmed')
    expect(
      after.appointments.filter(
        (item) => item.patient.email === henry.patient.email && item.status !== 'cancelled'
      )
    ).toHaveLength(1)
  })

  it('releases the hold on a decline and lets the next candidate be offered', async () => {
    const { opening, candidates } = await setUp()
    const first = await api.offerOpening(opening.id, candidates[0].entry.id)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const declined = await api.respondToOffer(first.offer.id, 'decline')
    expect(declined.ok).toBe(true)

    const state = await api.getState()
    expect(state.waitlist.find((entry) => entry.id === candidates[0].entry.id)?.status).toBe('waiting')
    expect(state.openings[0].status).toBe('open')
    expect(state.activity[0].kind).toBe('offer-declined')

    const second = await api.offerOpening(opening.id, candidates[1].entry.id)
    expect(second.ok).toBe(true)
  })

  it('releases the hold when an offer lapses', async () => {
    const { opening, candidates } = await setUp()
    const offered = await api.offerOpening(opening.id, candidates[0].entry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    const lapsed = await api.respondToOffer(offered.offer.id, 'expire')
    expect(lapsed.ok).toBe(true)

    const state = await api.getState()
    expect(state.offers[0].status).toBe('expired')
    expect(state.waitlist.find((entry) => entry.id === candidates[0].entry.id)?.status).toBe('waiting')

    // Back on the public calendar.
    const slots = await api.getDaySlots({
      serviceId: opening.slot.serviceId,
      locationId: opening.slot.locationId,
      providerId: opening.slot.providerId,
      dateKey: opening.slot.startWall.slice(0, 10)
    })
    expect(slots.map((slot) => slot.startWall)).toContain(opening.slot.startWall)
  })

  it('cannot be accepted twice', async () => {
    const { opening, candidates } = await setUp()
    const offered = await api.offerOpening(opening.id, candidates[0].entry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    expect((await api.respondToOffer(offered.offer.id, 'accept')).ok).toBe(true)
    expect(await api.respondToOffer(offered.offer.id, 'accept')).toEqual({
      ok: false,
      reason: 'offer-closed'
    })

    const state = await api.getState()
    expect(state.appointments.filter((item) => item.startWall === opening.slot.startWall && item.status !== 'cancelled')).toHaveLength(1)
  })
})

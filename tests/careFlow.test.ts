import { beforeEach, describe, expect, it } from 'vitest'
import { roomsAt } from '@/data/rooms'
import { createDemoSchedulingApi } from '@/services/schedulingApi'
import { isFinished, isPresent, occupantsOf } from '@/services/careFlow'
import { incoherences, pendingTaskOf } from '@/services/curemd'
import { addDaysToKey, todayKey } from '@/services/clinicTime'
import type { Appointment, DemoState } from '@/types'

/**
 * The front desk's part of the visit: arrival with a room, a correction when the wrong
 * room was picked, the slip, and finishing.
 *
 * The rules worth guarding are the ones that would quietly mislead a desk if they broke:
 * an arrival recorded twice, a CureMD task tidied away by a side effect, two patients in
 * one room, a finished visit still holding one, and a reprint changing data.
 */

let api: ReturnType<typeof createDemoSchedulingApi>

const patient = {
  firstName: 'Ada',
  lastName: 'Keel',
  email: 'ada.keel@example.com',
  phone: '',
  coverage: 'self-pay' as const
}

beforeEach(async () => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  await api.reset()
})

const state = (): Promise<DemoState> => api.getState()

const newRequest = async (): Promise<Appointment> => {
  const slot = (await api.getFirstAvailable({
    serviceId: 'primary-care',
    locationId: 'any',
    fromKey: addDaysToKey(todayKey(), 4)
  }))!
  const made = await api.requestAppointment({
    serviceId: 'primary-care',
    locationId: slot.locationId,
    slot,
    patientType: 'new',
    patient
  })
  if (!made.ok) throw new Error('setup failed')
  return made.appointment
}

/** A confirmed, registered appointment, ready to be arrived. */
const confirmedAppointment = async (): Promise<Appointment> => {
  const request = await newRequest()
  const registered = await api.declareRegistration(request.id, { confirmNow: true })
  if (!registered.ok) throw new Error('setup failed')
  return registered.appointment
}

const freeRoomAt = async (appointment: Appointment): Promise<string> => {
  const live = await state()
  const room = roomsAt(appointment.locationId).find(
    (candidate) => occupantsOf(candidate.id, live.appointments).length === 0
  )
  if (!room) throw new Error('no free room')
  return room.id
}

describe('recording an arrival', () => {
  it('records the time, the operator and the room in one action', async () => {
    const appointment = await confirmedAppointment()
    const roomId = await freeRoomAt(appointment)

    const result = await api.recordArrival(appointment.id, roomId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const visit = result.appointment.visit!
    expect(visit.stage).toBe('in-clinic')
    expect(visit.roomId).toBe(roomId)
    expect(visit.arrivedBy).toBe('Demo Reception')
    expect(visit.arrivedAtWall).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(visit.leftAtWall).toBeNull()
    expect(result.appointment.status).toBe('arrived')

    // Both moments are in the trail.
    const kinds = result.appointment.audit.map((entry) => entry.kind)
    expect(kinds).toContain('arrival-recorded')
    expect(kinds).toContain('room-assigned')
  })

  it('does not duplicate when the button is pressed twice', async () => {
    const appointment = await confirmedAppointment()
    const roomId = await freeRoomAt(appointment)

    const first = await api.recordArrival(appointment.id, roomId)
    if (!first.ok) throw new Error('setup failed')
    const again = await api.recordArrival(first.appointment.id, null)
    expect(again.ok).toBe(true)
    if (!again.ok) return

    expect(again.appointment.visit!.arrivedAtWall).toBe(first.appointment.visit!.arrivedAtWall)
    expect(again.appointment.visit!.roomId).toBe(roomId)
    expect(
      again.appointment.audit.filter((entry) => entry.kind === 'arrival-recorded')
    ).toHaveLength(1)
  })

  it('allows an arrival with no room yet', async () => {
    const appointment = await confirmedAppointment()
    const result = await api.recordArrival(appointment.id, null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.appointment.visit!.roomId).toBeNull()
    expect(isPresent(result.appointment)).toBe(true)
  })

  it('refuses a room belonging to another clinic, or one already in use', async () => {
    const appointment = await confirmedAppointment()
    const elsewhere = roomsAt(appointment.locationId === 'downtown' ? 'northside' : 'downtown')[0]

    const wrong = await api.recordArrival(appointment.id, elsewhere.id)
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.reason).toBe('wrong-clinic')
    // Nothing was recorded on a refusal.
    expect((await api.getState()).appointments.find((a) => a.id === appointment.id)!.visit).toBeNull()

    const taken = (await state()).appointments.find(
      (item) => isPresent(item) && item.visit!.roomId !== null
    )
    if (taken && taken.locationId === appointment.locationId) {
      const clash = await api.recordArrival(appointment.id, taken.visit!.roomId!)
      expect(clash.ok).toBe(false)
      if (!clash.ok) expect(clash.reason).toBe('room-busy')
    }
  })

  it('keeps the CureMD task open and does not confirm anything', async () => {
    const request = await newRequest()
    const arrived = await api.recordArrival(request.id, null)
    expect(arrived.ok).toBe(true)
    if (!arrived.ok) return

    expect(arrived.appointment.visit!.stage).toBe('in-clinic')
    expect(arrived.appointment.curemd.status).toBe('pending-registration')
    expect(pendingTaskOf(arrived.appointment)).toBe('registration')
    // A request nobody registered stays a request.
    expect(arrived.appointment.status).toBe('requested')
    expect(incoherences(arrived.appointment)).toEqual([])
  })

  it('refuses an arrival on a cancelled appointment', async () => {
    const appointment = await confirmedAppointment()
    await api.requestCancellation(appointment.id)
    const done = await api.declareCancellationDone(appointment.id)
    if (!done.ok) throw new Error('setup failed')

    const arrived = await api.recordArrival(done.appointment.id, null)
    expect(arrived.ok).toBe(false)
    if (!arrived.ok) expect(arrived.reason).toBe('not-allowed')
  })
})

describe('correcting the room', () => {
  const arrived = async (): Promise<Appointment> => {
    const appointment = await confirmedAppointment()
    const result = await api.recordArrival(appointment.id, await freeRoomAt(appointment))
    if (!result.ok) throw new Error('setup failed')
    return result.appointment
  }

  it('frees the first room and records the correction', async () => {
    const appointment = await arrived()
    const was = appointment.visit!.roomId!
    const live = await state()
    const other = roomsAt(appointment.locationId).find(
      (room) => room.id !== was && occupantsOf(room.id, live.appointments).length === 0
    )!

    const fixed = await api.correctRoom(appointment.id, other.id)
    expect(fixed.ok).toBe(true)
    if (!fixed.ok) return

    expect(fixed.appointment.visit!.roomId).toBe(other.id)
    expect(fixed.appointment.audit[0].kind).toBe('room-corrected')
    expect(occupantsOf(was, (await state()).appointments)).toHaveLength(0)
    expect(occupantsOf(other.id, (await state()).appointments)).toHaveLength(1)
  })

  it('will not correct into a room somebody else is in', async () => {
    const first = await arrived()
    const live = await state()
    const other = live.appointments.find(
      (item) =>
        isPresent(item) &&
        item.id !== first.id &&
        item.locationId === first.locationId &&
        item.visit!.roomId !== null
    )
    if (!other) return

    const clash = await api.correctRoom(first.id, other.visit!.roomId!)
    expect(clash.ok).toBe(false)
    if (!clash.ok) expect(clash.reason).toBe('room-busy')
  })

  it('can take the room away again', async () => {
    const appointment = await arrived()
    const was = appointment.visit!.roomId!
    const cleared = await api.correctRoom(appointment.id, null)
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect(cleared.appointment.visit!.roomId).toBeNull()
    expect(occupantsOf(was, (await state()).appointments)).toHaveLength(0)
  })

  it('cannot be done once the visit has finished', async () => {
    const appointment = await arrived()
    const finished = await api.finishVisit(appointment.id)
    if (!finished.ok) throw new Error('setup failed')

    const late = await api.correctRoom(finished.appointment.id, await freeRoomAt(appointment))
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.reason).toBe('not-allowed')
  })
})

describe('finishing the visit', () => {
  const arrived = async (): Promise<Appointment> => {
    const appointment = await confirmedAppointment()
    const result = await api.recordArrival(appointment.id, await freeRoomAt(appointment))
    if (!result.ok) throw new Error('setup failed')
    return result.appointment
  }

  it('records the departure, frees the room and completes the appointment', async () => {
    const appointment = await arrived()
    const room = appointment.visit!.roomId!

    const finished = await api.finishVisit(appointment.id)
    expect(finished.ok).toBe(true)
    if (!finished.ok) return

    expect(finished.appointment.visit!.stage).toBe('finished')
    expect(finished.appointment.visit!.leftAtWall).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(finished.appointment.visit!.roomId).toBeNull()
    expect(finished.appointment.status).toBe('completed')
    expect(isPresent(finished.appointment)).toBe(false)
    expect(isFinished(finished.appointment)).toBe(true)
    expect(occupantsOf(room, (await state()).appointments)).toHaveLength(0)
    expect(finished.appointment.audit[0].kind).toBe('visit-finished')
  })

  it('leaves anything pending in CureMD exactly where it was', async () => {
    const request = await newRequest()
    const arrival = await api.recordArrival(request.id, null)
    if (!arrival.ok) throw new Error('setup failed')

    const finished = await api.finishVisit(arrival.appointment.id)
    expect(finished.ok).toBe(true)
    if (!finished.ok) return

    // The visit is over; the job in CureMD is still a job in CureMD.
    expect(finished.appointment.visit!.stage).toBe('finished')
    expect(finished.appointment.curemd.status).toBe('pending-registration')
    expect(pendingTaskOf(finished.appointment)).toBe('registration')
    // And it is not dressed up as completed on the strength of someone walking out.
    expect(finished.appointment.status).toBe('requested')
    expect(incoherences(finished.appointment)).toEqual([])
  })

  it('is harmless if pressed twice', async () => {
    const appointment = await arrived()
    const once = await api.finishVisit(appointment.id)
    if (!once.ok) throw new Error('setup failed')
    const twice = await api.finishVisit(once.appointment.id)
    expect(twice.ok).toBe(true)
    if (!twice.ok) return
    expect(twice.appointment.visit!.leftAtWall).toBe(once.appointment.visit!.leftAtWall)
    expect(
      twice.appointment.audit.filter((entry) => entry.kind === 'visit-finished')
    ).toHaveLength(1)
  })
})

describe('the care slip', () => {
  it('counts print requests and changes nothing else', async () => {
    const appointment = await confirmedAppointment()
    const result = await api.recordArrival(appointment.id, await freeRoomAt(appointment))
    if (!result.ok) throw new Error('setup failed')
    const before = result.appointment

    await api.noteSlipRequested(before.id)
    const twice = await api.noteSlipRequested(before.id)
    if (!twice.ok) return

    expect(twice.appointment.visit!.printsRequested).toBe(2)
    // Reprinting is free: nothing about the appointment or the visit moved.
    expect(twice.appointment.status).toBe(before.status)
    expect(twice.appointment.curemd.status).toBe(before.curemd.status)
    expect(twice.appointment.visit!.stage).toBe(before.visit!.stage)
    expect(twice.appointment.visit!.roomId).toBe(before.visit!.roomId)
    expect(twice.appointment.startWall).toBe(before.startWall)
  })

  it('cannot be asked for before the patient has arrived', async () => {
    const appointment = await confirmedAppointment()
    const result = await api.noteSlipRequested(appointment.id)
    expect(result.ok).toBe(false)
  })
})

describe('the sample data', () => {
  it('opens with people in the clinic and a visit already finished', async () => {
    const live = await state()
    const present = live.appointments.filter(isPresent)
    const done = live.appointments.filter(isFinished)

    expect(present.length).toBeGreaterThanOrEqual(2)
    expect(done.length).toBeGreaterThanOrEqual(1)

    // No finished visit holds a room, and no room holds two people.
    for (const appointment of done) {
      expect(appointment.visit!.roomId).toBeNull()
      expect(appointment.visit!.leftAtWall).not.toBeNull()
    }
    for (const appointment of present) {
      const roomId = appointment.visit!.roomId
      if (!roomId) continue
      expect(occupantsOf(roomId, live.appointments)).toHaveLength(1)
      expect(roomsAt(appointment.locationId).map((room) => room.id)).toContain(roomId)
    }
  })

  it('is wiped by a restore', async () => {
    const live = await state()
    const someone = live.appointments.find(isPresent)!
    await api.finishVisit(someone.id)

    const restored = await api.reset()
    expect(restored.appointments.filter(isPresent).length).toBeGreaterThanOrEqual(2)
    expect(restored.activity).toEqual([])
  })
})

import { roomById } from '@/data/rooms'
import type { Appointment, ConsultingRoom } from '@/types'

/**
 * What the front desk tracks once the patient is in the building.
 *
 * Deliberately small. The desk records two moments — the patient arrived, the patient
 * left — and one fact in between: which room they are in. Everything that happens inside
 * that room is not reception's to tick off, and a flow that asked them to would mostly
 * produce a diary nobody kept up to date.
 *
 * This is the **third** state in the demo, independent of the other two. An appointment
 * can be confirmed and nobody arrived; a patient can be in a room while the CureMD
 * registration is still outstanding. Nothing here ever touches the CureMD record.
 */

/** Is the patient in the building? */
export const isPresent = (appointment: Appointment): boolean =>
  appointment.visit !== null && appointment.visit.stage === 'in-clinic'

/** Has the visit been and gone? */
export const isFinished = (appointment: Appointment): boolean =>
  appointment.visit !== null && appointment.visit.stage === 'finished'

/**
 * Can an arrival be recorded at all?
 *
 * A cancelled or closed-as-unavailable appointment cannot: nobody is expected. A
 * registration still outstanding in CureMD is **not** a reason to refuse — the patient is
 * standing there — so the interface warns instead and keeps the task.
 */
export const canRecordArrival = (appointment: Appointment): boolean =>
  appointment.visit === null &&
  appointment.status !== 'cancelled' &&
  appointment.status !== 'unavailable'

/** Everyone currently holding a given room. A finished visit holds nothing. */
export const occupantsOf = (roomId: string, appointments: Appointment[]): Appointment[] =>
  appointments.filter((appointment) => isPresent(appointment) && appointment.visit?.roomId === roomId)

export interface RoomState {
  room: ConsultingRoom
  occupant: Appointment | null
}

/** Every room at a clinic with whoever is in it. */
export const roomStates = (
  clinicRooms: ConsultingRoom[],
  appointments: Appointment[]
): RoomState[] =>
  clinicRooms.map((room) => ({
    room,
    occupant: occupantsOf(room.id, appointments)[0] ?? null
  }))

/**
 * Why this room cannot be given to this patient, or null when it can.
 *
 * Rooms belong to a clinic, so a patient at Northside cannot be put in a Downtown room
 * however free it is, and a room already held by another visit cannot be doubled up.
 */
export const roomRefusal = (
  roomId: string,
  appointment: Appointment,
  appointments: Appointment[]
): 'unknown-room' | 'wrong-clinic' | 'room-busy' | null => {
  const room = roomById(roomId)
  if (!room) return 'unknown-room'
  if (room.locationId !== appointment.locationId) return 'wrong-clinic'
  const held = occupantsOf(roomId, appointments).filter((other) => other.id !== appointment.id)
  return held.length > 0 ? 'room-busy' : null
}

/** The rooms at this patient's clinic that are free for them to be put in. */
export const freeRoomsFor = (
  clinicRooms: ConsultingRoom[],
  appointment: Appointment,
  appointments: Appointment[]
): ConsultingRoom[] =>
  clinicRooms.filter(
    (room) =>
      room.locationId === appointment.locationId &&
      roomRefusal(room.id, appointment, appointments) === null
  )

/** Minutes between two wall-clock stamps, for the "here since" column. */
export const minutesSince = (wall: string, nowWall: string): number => {
  const toMinutes = (value: string): number => {
    const [date, time] = value.split('T')
    const [hours, mins] = time.split(':').map(Number)
    return Date.parse(`${date}T00:00:00Z`) / 60000 + hours * 60 + mins
  }
  return Math.max(0, toMinutes(nowWall) - toMinutes(wall))
}

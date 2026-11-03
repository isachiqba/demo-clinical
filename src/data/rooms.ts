import type { ConsultingRoom, LocationId } from '@/types'

/**
 * The rooms inside each clinic. Invented, like everything else here.
 *
 * A room is a physical space. Three of them in a clinic does not mean three doctors, and
 * it does not raise the number of appointments Dr. Lorba can see in a day — that comes
 * from his consulting blocks and nothing else. Rooms only say *where in the building* a
 * patient is while they wait and while they are seen.
 *
 * Add or rename rooms here; the arrival dialog and the clinic list read this list.
 */
export const rooms: ConsultingRoom[] = [
  { id: 'downtown-c1', locationId: 'downtown', name: { en: 'Room 1', es: 'Consultorio 1' } },
  { id: 'downtown-c2', locationId: 'downtown', name: { en: 'Room 2', es: 'Consultorio 2' } },
  { id: 'downtown-c3', locationId: 'downtown', name: { en: 'Room 3', es: 'Consultorio 3' } },

  { id: 'northside-c1', locationId: 'northside', name: { en: 'Room 1', es: 'Consultorio 1' } },
  { id: 'northside-c2', locationId: 'northside', name: { en: 'Room 2', es: 'Consultorio 2' } },
  { id: 'northside-c3', locationId: 'northside', name: { en: 'Room 3', es: 'Consultorio 3' } },

  { id: 'westside-c1', locationId: 'westside', name: { en: 'Room 1', es: 'Consultorio 1' } },
  { id: 'westside-c2', locationId: 'westside', name: { en: 'Room 2', es: 'Consultorio 2' } }
]

export const roomById = (id: string): ConsultingRoom | undefined =>
  rooms.find((room) => room.id === id)

export const roomsAt = (locationId: LocationId): ConsultingRoom[] =>
  rooms.filter((room) => room.locationId === locationId)

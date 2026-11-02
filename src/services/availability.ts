import { locationById } from '@/data/locations'
import { providerById, providersFor } from '@/data/providers'
import { serviceById } from '@/data/services'
import type { Appointment, LocationId, ServiceId, Slot } from '@/types'
import { BLOCKING_STATUSES } from '@/types'
import {
  addDaysToKey,
  addMinutesToWall,
  dateKeyOf,
  makeWall,
  minutesOf,
  minutesUntilWall,
  weekdayOfKey,
  type DateKey
} from './clinicTime'

/**
 * Generates a clinic's open slots. Pure: it takes the day and the appointments that
 * already exist and returns what is left, so the same inputs always give the same grid.
 * A real back end would replace this file and nothing above it would change.
 */

/** Nothing can be booked less than this far ahead. */
export const LEAD_TIME_MINUTES = 120
const LUNCH_START = 12 * 60
const LUNCH_END = 13 * 60

const hashString = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32: small and deterministic, so a demo can be replayed. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Busy {
  providerId: string
  startMinutes: number
  endMinutes: number
}

/** Appointments on `dateKey` that still hold a place in a clinician's day. */
const busyOn = (appointments: Appointment[], dateKey: DateKey): Busy[] =>
  appointments
    .filter(
      (appointment) =>
        BLOCKING_STATUSES.includes(appointment.status) &&
        dateKeyOf(appointment.startWall) === dateKey
    )
    .map((appointment) => ({
      providerId: appointment.providerId,
      startMinutes: minutesOf(appointment.startWall),
      endMinutes: minutesOf(appointment.startWall) + appointment.durationMinutes
    }))

/** A pending offer holds its slot exactly as a booking would. */
const holdsOn = (holds: Slot[], dateKey: DateKey): Busy[] =>
  holds
    .filter((hold) => dateKeyOf(hold.startWall) === dateKey)
    .map((hold) => ({
      providerId: hold.providerId,
      startMinutes: minutesOf(hold.startWall),
      endMinutes: minutesOf(hold.startWall) + hold.durationMinutes
    }))

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd

export interface DayQuery {
  serviceId: ServiceId
  locationId: LocationId
  providerId: string
  dateKey: DateKey
  appointments: Appointment[]
  /** Slots held by a pending offer; treated exactly like a booking. */
  holds?: Slot[]
  now?: Date
}

/**
 * The window a clinician works at one clinic on one day, lunch removed. Used both to
 * place slots and to measure how much capacity a clinic is actually offering.
 */
export const providerDayWindow = (
  providerId: string,
  locationId: LocationId,
  dateKey: DateKey
): { startMinutes: number; endMinutes: number; minutes: number } | null => {
  const provider = providerById(providerId)
  const location = locationById(locationId)
  if (!provider || !location) return null
  if (!provider.locationIds.includes(location.id)) return null

  const opening = location.hours.find((entry) => entry.weekday === weekdayOfKey(dateKey))
  if (!opening || opening.opensAt === null || opening.closesAt === null) return null

  const random = seededRandom(hashString(`${provider.id}|${location.id}|${dateKey}`))
  const startMinutes = opening.opensAt + Math.floor(random() * 3) * 30
  const endMinutes = opening.closesAt - Math.floor(random() * 3) * 30
  if (endMinutes <= startMinutes) return null

  const lunch = Math.max(
    0,
    Math.min(endMinutes, LUNCH_END) - Math.max(startMinutes, LUNCH_START)
  )
  return { startMinutes, endMinutes, minutes: endMinutes - startMinutes - lunch }
}

/** Open slots for one clinician, at one clinic, on one day. */
export const slotsForProviderDay = (query: DayQuery): Slot[] => {
  const service = serviceById(query.serviceId)
  const provider = providerById(query.providerId)
  const location = locationById(query.locationId)
  if (!service || !provider || !location) return []
  if (!provider.serviceIds.includes(service.id)) return []
  if (!provider.locationIds.includes(location.id)) return []

  const window = providerDayWindow(provider.id, location.id, query.dateKey)
  if (!window) return []

  // A second generator, seeded identically, decides which of the slots are already gone.
  const random = seededRandom(hashString(`${provider.id}|${location.id}|${query.dateKey}`))
  random()
  random()

  // The grid steps by the appointment's own length, so two offered times never overlap.
  const step = service.durationMinutes
  const shiftStart = window.startMinutes
  const shiftEnd = window.endMinutes

  const busy = [...busyOn(query.appointments, query.dateKey), ...holdsOn(query.holds ?? [], query.dateKey)]
    .filter((entry) => entry.providerId === provider.id)
  const now = query.now ?? new Date()
  const slots: Slot[] = []

  for (let minute = shiftStart; minute + service.durationMinutes <= shiftEnd; minute += step) {
    const end = minute + service.durationMinutes
    if (overlaps(minute, end, LUNCH_START, LUNCH_END)) continue

    // Roughly half the grid is taken by patients the demo never shows.
    if (random() < 0.5) continue
    if (busy.some((entry) => overlaps(minute, end, entry.startMinutes, entry.endMinutes))) continue

    const startWall = makeWall(query.dateKey, minute)
    if (minutesUntilWall(startWall, now) < LEAD_TIME_MINUTES) continue

    slots.push({
      id: `${provider.id}|${location.id}|${startWall}`,
      serviceId: service.id,
      providerId: provider.id,
      locationId: location.id,
      startWall,
      durationMinutes: service.durationMinutes
    })
  }

  return slots
}

export interface SearchQuery {
  serviceId: ServiceId
  /** `'any'` searches every clinic that has a clinician for this service. */
  locationId: LocationId | 'any'
  /** `'any'` searches every eligible clinician. */
  providerId: string | 'any'
  dateKey: DateKey
  appointments: Appointment[]
  holds?: Slot[]
  now?: Date
}

const expand = (query: SearchQuery): { locationId: LocationId; providerId: string }[] => {
  const pairs: { locationId: LocationId; providerId: string }[] = []
  for (const provider of providersFor(query.serviceId)) {
    if (query.providerId !== 'any' && provider.id !== query.providerId) continue
    for (const locationId of provider.locationIds) {
      if (query.locationId !== 'any' && locationId !== query.locationId) continue
      pairs.push({ locationId, providerId: provider.id })
    }
  }
  return pairs
}

/**
 * Open slots across whatever the patient left open. When two clinicians are free at the
 * same minute only one slot is offered, picked in a stable order so the list never
 * reshuffles between renders.
 */
export const slotsForDay = (query: SearchQuery): Slot[] => {
  const found = new Map<string, Slot>()
  for (const pair of expand(query)) {
    const slots = slotsForProviderDay({
      serviceId: query.serviceId,
      locationId: pair.locationId,
      providerId: pair.providerId,
      dateKey: query.dateKey,
      appointments: query.appointments,
      holds: query.holds,
      now: query.now
    })
    for (const slot of slots) {
      if (!found.has(slot.startWall)) found.set(slot.startWall, slot)
    }
  }
  return [...found.values()].sort((a, b) => a.startWall.localeCompare(b.startWall))
}

/** How many openings each of the next `days` days holds, keyed by date. */
export const slotCounts = (
  query: Omit<SearchQuery, 'dateKey'> & { fromKey: DateKey; days: number }
): Record<DateKey, number> => {
  const counts: Record<DateKey, number> = {}
  for (let offset = 0; offset < query.days; offset += 1) {
    const dateKey = addDaysToKey(query.fromKey, offset)
    counts[dateKey] = slotsForDay({ ...query, dateKey }).length
  }
  return counts
}

/** The genuinely first open slot, searched day by day — never a hard-coded date. */
export const firstAvailable = (
  query: Omit<SearchQuery, 'dateKey'> & { fromKey: DateKey; days?: number }
): Slot | null => {
  const horizon = query.days ?? 60
  for (let offset = 0; offset < horizon; offset += 1) {
    const [slot] = slotsForDay({ ...query, dateKey: addDaysToKey(query.fromKey, offset) })
    if (slot) return slot
  }
  return null
}

/** Is this exact slot still free, given the bookings and holds that exist right now? */
export const isSlotOpen = (
  slot: Slot,
  appointments: Appointment[],
  holds: Slot[] = [],
  now = new Date()
): boolean => {
  if (minutesUntilWall(slot.startWall, now) < LEAD_TIME_MINUTES) return false
  const start = minutesOf(slot.startWall)
  const end = start + slot.durationMinutes
  const taken = [...busyOn(appointments, dateKeyOf(slot.startWall)), ...holdsOn(holds, dateKeyOf(slot.startWall))]
  return !taken.some(
    (entry) =>
      entry.providerId === slot.providerId && overlaps(start, end, entry.startMinutes, entry.endMinutes)
  )
}

/** Minutes a clinician's bookings occupy at one clinic on one day. */
export const bookedMinutes = (appointments: Appointment[], dateKey: DateKey): number =>
  appointments
    .filter(
      (appointment) =>
        BLOCKING_STATUSES.includes(appointment.status) &&
        dateKeyOf(appointment.startWall) === dateKey
    )
    .reduce((total, appointment) => total + appointment.durationMinutes, 0)

export const slotEndWall = (slot: Slot): string =>
  addMinutesToWall(slot.startWall, slot.durationMinutes)

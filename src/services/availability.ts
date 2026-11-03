import { blocksAt, blocksOnWeekday, doctor } from '@/data/doctor'
import { locationById, locations } from '@/data/locations'
import type { Appointment, LocationId, Offer, ServiceId, Slot } from '@/types'
import { OCCUPYING_STATUSES, SLOT_MINUTES } from '@/types'
import {
  addDaysToKey,
  dateKeyOf,
  makeWall,
  minutesOf,
  minutesUntilWall,
  nowWall,
  weekdayOfKey,
  type DateKey
} from './clinicTime'

/**
 * What the doctor has left.
 *
 * There is **one doctor** working across three clinics, so there is one agenda, not three.
 * A slot exists only where he is actually sitting that day, and taking a time at one
 * clinic removes it from his day everywhere — including the clinics he is not in, because
 * he cannot be in two places at once.
 *
 * Three things the interface is careful about, and so is this file:
 *
 *  - Times are offered on a **ten-minute grid**. That is a booking interval, nothing more;
 *    it is not a claim about how long an appointment lasts.
 *  - This is the demo's **local** picture only. Nothing here reads CureMD, so a time being
 *    free here is not a promise that it is free in the practice's real diary.
 *  - Capacity is the doctor's, never the clinic's multiplied by three.
 */

/** Nothing can be requested less than this far ahead. */
export const LEAD_TIME_MINUTES = 120

/**
 * Provisional until the practice confirms it: one patient per ten-minute slot. It lives on
 * the clinic so a different figure per site is a data change, not a code change. It is the
 * number seen in one slot, not a per-clinic allowance that could be added together.
 */
export const slotCapacityOf = (locationId: LocationId): number =>
  locationById(locationId)?.slotCapacity ?? 1

export const slotId = (locationId: LocationId, startWall: string): string =>
  `${locationId}|${startWall}`

/** Is this minute inside a break the doctor takes during that block? */
const inPause = (block: { pause?: [number, number] }, minute: number): boolean =>
  block.pause !== undefined && minute + SLOT_MINUTES > block.pause[0] && minute < block.pause[1]

/**
 * Every ten-minute start the doctor offers at one clinic on one day, before anything is
 * taken. Comes from his consulting blocks, narrowed to the hours the clinic is actually
 * open: a clinic can be open when he is elsewhere, but he is never there when it is shut.
 */
export const gridFor = (locationId: LocationId, dateKey: DateKey): string[] => {
  const location = locationById(locationId)
  if (!location) return []

  const weekday = weekdayOfKey(dateKey)
  const opening = location.hours.find((entry) => entry.weekday === weekday)
  if (!opening || opening.opensAt === null || opening.closesAt === null) return []

  const starts: string[] = []
  for (const block of blocksAt(weekday, locationId)) {
    const from = Math.max(block.startsAt, opening.opensAt)
    const to = Math.min(block.endsAt, opening.closesAt)
    for (let minute = from; minute + SLOT_MINUTES <= to; minute += SLOT_MINUTES) {
      if (inPause(block, minute)) continue
      starts.push(makeWall(dateKey, minute))
    }
  }
  return starts.sort()
}

/** Every slot he offers that day, at whichever clinic, earliest first. */
export const dayGrid = (dateKey: DateKey): { locationId: LocationId; startWall: string }[] =>
  blocksOnWeekday(weekdayOfKey(dateKey))
    .flatMap((block) =>
      gridFor(block.locationId, dateKey).map((startWall) => ({
        locationId: block.locationId,
        startWall
      }))
    )
    .filter(
      (slot, index, all) =>
        all.findIndex((other) => other.startWall === slot.startWall && other.locationId === slot.locationId) === index
    )
    .sort((a, b) => a.startWall.localeCompare(b.startWall))

/**
 * How many slots the doctor offers at one clinic in a day, before anything is taken. A
 * clinic's capacity is only the blocks he spends there — on a day he is elsewhere it is
 * zero, however long the doors are open.
 */
export const dayCapacity = (locationId: LocationId, dateKey: DateKey): number =>
  gridFor(locationId, dateKey).length * slotCapacityOf(locationId)

export interface Occupancy {
  /** Requests and confirmed appointments sitting on their own time. */
  appointments: Appointment[]
  /** Offers still waiting for an answer; their slot is held meanwhile. */
  offers: Offer[]
}

/**
 * What a single ten-minute slot at one clinic is already carrying. A pending reschedule
 * counts against the *new* time as well, so two of them cannot land on the same slot, and a
 * cancellation reception has not yet done in CureMD still counts against the old one.
 *
 * This counts one clinic. The doctor's day as a whole is `conflictsElsewhere`.
 */
export const takenAt = (locationId: LocationId, startWall: string, state: Occupancy): number => {
  const booked = state.appointments.filter(
    (appointment) =>
      OCCUPYING_STATUSES.includes(appointment.status) &&
      appointment.locationId === locationId &&
      appointment.startWall === startWall
  ).length

  const moving = state.appointments.filter(
    (appointment) =>
      OCCUPYING_STATUSES.includes(appointment.status) &&
      appointment.pendingChange !== null &&
      appointment.pendingChange.locationId === locationId &&
      appointment.pendingChange.startWall === startWall
  ).length

  // A time put to a patient as an alternative is held locally so nobody else takes it
  // while they think about it.
  const proposed = state.appointments.filter(
    (appointment) =>
      appointment.status === 'requested' &&
      appointment.proposal !== null &&
      appointment.proposal.locationId === locationId &&
      appointment.proposal.startWall === startWall
  ).length

  const held = state.offers.filter(
    (offer) =>
      offer.status === 'pending' &&
      offer.holdUntilWall > nowWall() &&
      offer.slot.locationId === locationId &&
      offer.slot.startWall === startWall
  ).length

  return booked + moving + proposed + held
}

/** Everything the doctor is committed to at a given time, wherever it is. */
const commitmentsAt = (state: Occupancy): { locationId: LocationId; startWall: string }[] => {
  const live = state.appointments.filter((appointment) =>
    OCCUPYING_STATUSES.includes(appointment.status)
  )
  return [
    ...live.map((appointment) => ({
      locationId: appointment.locationId,
      startWall: appointment.startWall
    })),
    // A change not yet applied in CureMD holds its new time as well as its old one.
    ...live
      .filter((appointment) => appointment.pendingChange !== null)
      .map((appointment) => ({
        locationId: appointment.pendingChange!.locationId,
        startWall: appointment.pendingChange!.startWall
      })),
    ...state.appointments
      .filter((appointment) => appointment.status === 'requested' && appointment.proposal !== null)
      .map((appointment) => ({
        locationId: appointment.proposal!.locationId,
        startWall: appointment.proposal!.startWall
      })),
    ...state.offers
      .filter((offer) => offer.status === 'pending' && offer.holdUntilWall > nowWall())
      .map((offer) => ({ locationId: offer.slot.locationId, startWall: offer.slot.startWall }))
  ]
}

/**
 * Is the doctor already committed somewhere that rules this slot out?
 *
 * Two ways that happens, and both matter because there is only one of him:
 *
 *  - he is booked at **another clinic at the same time**; or
 *  - he is booked at another clinic **too close to it** to get across town in between.
 *
 * The consulting blocks are authored so this cannot arise from the timetable itself, but
 * reschedules, waitlist offers and hand-edited demo data all write times directly, so the
 * rule is enforced here rather than assumed.
 */
export const conflictsElsewhere = (
  locationId: LocationId,
  startWall: string,
  state: Occupancy
): boolean => {
  const minute = minutesOf(startWall)
  const dateKey = dateKeyOf(startWall)
  const buffer = doctor.travelBufferMinutes

  return commitmentsAt(state).some((commitment) => {
    if (commitment.locationId === locationId) return false
    if (dateKeyOf(commitment.startWall) !== dateKey) return false
    const other = minutesOf(commitment.startWall)
    // Either on top of each other, or not far enough apart to travel between.
    const gap = minute >= other ? minute - (other + SLOT_MINUTES) : other - (minute + SLOT_MINUTES)
    return gap < buffer
  })
}

export interface SlotQuery {
  serviceId: ServiceId
  locationId: LocationId
  dateKey: DateKey
  state: Occupancy
  now?: Date
}

/** Slots a patient could still ask for at one clinic on one day. */
export const slotsForDay = (query: SlotQuery): Slot[] => {
  const capacity = slotCapacityOf(query.locationId)
  const now = query.now ?? new Date()

  return gridFor(query.locationId, query.dateKey)
    .filter((startWall) => minutesUntilWall(startWall, now) >= LEAD_TIME_MINUTES)
    .filter((startWall) => takenAt(query.locationId, startWall, query.state) < capacity)
    .filter((startWall) => !conflictsElsewhere(query.locationId, startWall, query.state))
    .map((startWall) => ({
      id: slotId(query.locationId, startWall),
      serviceId: query.serviceId,
      locationId: query.locationId,
      startWall
    }))
}

export interface SearchQuery {
  serviceId: ServiceId
  /** `'any'` searches every clinic. */
  locationId: LocationId | 'any'
  dateKey: DateKey
  state: Occupancy
  now?: Date
}

const clinicsIn = (locationId: LocationId | 'any'): LocationId[] =>
  locationId === 'any' ? locations.map((location) => location.id) : [locationId]

/**
 * `'any'` means "wherever he is soonest", so it searches the one agenda rather than three.
 * Because a day's blocks never overlap, the clinics cannot offer the same minute twice and
 * the result is simply his next free time.
 */

/** Open slots across whatever the patient left open, earliest first. */
export const searchDay = (query: SearchQuery): Slot[] =>
  clinicsIn(query.locationId)
    .flatMap((locationId) => slotsForDay({ ...query, locationId }))
    .sort((a, b) => a.startWall.localeCompare(b.startWall) || a.locationId.localeCompare(b.locationId))

/** How many openings each of the next `days` days holds, keyed by date. */
export const slotCounts = (
  query: Omit<SearchQuery, 'dateKey'> & { fromKey: DateKey; days: number }
): Record<DateKey, number> => {
  const counts: Record<DateKey, number> = {}
  for (let offset = 0; offset < query.days; offset += 1) {
    const dateKey = addDaysToKey(query.fromKey, offset)
    counts[dateKey] = searchDay({ ...query, dateKey }).length
  }
  return counts
}

/** The genuinely soonest opening, searched day by day — never a hard-coded date. */
export const firstAvailable = (
  query: Omit<SearchQuery, 'dateKey'> & { fromKey: DateKey; days?: number }
): Slot | null => {
  const horizon = query.days ?? 60
  for (let offset = 0; offset < horizon; offset += 1) {
    const [slot] = searchDay({ ...query, dateKey: addDaysToKey(query.fromKey, offset) })
    if (slot) return slot
  }
  return null
}

/** Is this exact slot still askable, given everything on the books right now? */
export const isSlotOpen = (
  slot: Pick<Slot, 'locationId' | 'startWall'>,
  state: Occupancy,
  now = new Date()
): boolean => {
  if (minutesUntilWall(slot.startWall, now) < LEAD_TIME_MINUTES) return false
  if (!gridFor(slot.locationId, dateKeyOf(slot.startWall)).includes(slot.startWall)) return false
  if (conflictsElsewhere(slot.locationId, slot.startWall, state)) return false
  return takenAt(slot.locationId, slot.startWall, state) < slotCapacityOf(slot.locationId)
}

/** Minutes past midnight, for grouping a day into morning, afternoon and evening. */
export const slotMinutes = (startWall: string): number => minutesOf(startWall)

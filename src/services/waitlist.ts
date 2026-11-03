import type { Appointment, Slot, TimeBand, WaitlistEntry, WaitlistPreferences } from '@/types'
import { dateKeyOf, minutesOf, weekdayOfKey } from './clinicTime'

/**
 * Who, out of the people waiting, a freed slot actually suits.
 *
 * The rules are plain and deterministic — appointment type, clinic, dates, weekdays and
 * time of day — and the order is simply who has been waiting longest. There is no rule
 * about clinicians, because patients do not choose one. Nothing here looks at a
 * diagnosis, an insurer, or anything else about a person.
 */

const MORNING_ENDS = 12 * 60
const AFTERNOON_ENDS = 17 * 60

export const bandOfWall = (startWall: string): TimeBand => {
  const minutes = minutesOf(startWall)
  if (minutes < MORNING_ENDS) return 'morning'
  if (minutes < AFTERNOON_ENDS) return 'afternoon'
  return 'evening'
}

export interface MatchReason {
  key: string
  params?: Record<string, string | number>
}

export interface Candidate {
  entry: WaitlistEntry
  reasons: MatchReason[]
}

export interface MatchContext {
  appointments: Appointment[]
}

const withinWindow = (preferences: WaitlistPreferences, dateKey: string): boolean =>
  dateKey >= preferences.fromKey && dateKey <= preferences.toKey

/**
 * Why this entry does *not* fit, or an empty list when it does. Returning the failures
 * rather than a boolean keeps the rule set readable and makes the tests specific.
 */
export const mismatchReasons = (
  entry: WaitlistEntry,
  slot: Pick<Slot, 'serviceId' | 'locationId' | 'startWall'>,
  context: MatchContext
): string[] => {
  const reasons: string[] = []
  const preferences = entry.preferences
  const dateKey = dateKeyOf(slot.startWall)

  if (entry.status !== 'waiting') reasons.push('status')
  if (preferences.serviceId !== slot.serviceId) reasons.push('service')
  if (!preferences.locationIds.includes(slot.locationId)) reasons.push('location')
  if (!withinWindow(preferences, dateKey)) reasons.push('dates')
  if (!preferences.weekdays.includes(weekdayOfKey(dateKey))) reasons.push('weekday')
  if (!preferences.bands.includes(bandOfWall(slot.startWall))) reasons.push('band')

  // Someone who already has an appointment is only interested in an earlier one.
  if (entry.linkedAppointmentId) {
    const linked = context.appointments.find(
      (appointment) => appointment.id === entry.linkedAppointmentId
    )
    if (!linked || linked.status === 'cancelled' || linked.status === 'unavailable') {
      reasons.push('linked-missing')
    } else if (slot.startWall >= linked.startWall) {
      reasons.push('not-earlier')
    }
  }

  return reasons
}

export const matchesSlot = (
  entry: WaitlistEntry,
  slot: Pick<Slot, 'serviceId' | 'locationId' | 'startWall'>,
  context: MatchContext
): boolean => mismatchReasons(entry, slot, context).length === 0

const reasonsFor = (
  entry: WaitlistEntry,
  slot: Pick<Slot, 'startWall'>,
  context: MatchContext
): MatchReason[] => {
  const band = bandOfWall(slot.startWall)
  const reasons: MatchReason[] = [
    { key: 'waitingSince', params: { date: entry.createdAtWall } },
    // Capitalised rather than dotted: a dot in a message key is a path in vue-i18n.
    { key: `band${band.charAt(0).toUpperCase()}${band.slice(1)}` }
  ]

  const linked = entry.linkedAppointmentId
    ? context.appointments.find((appointment) => appointment.id === entry.linkedAppointmentId)
    : undefined
  if (linked) reasons.push({ key: 'bringsForward', params: { from: linked.startWall } })

  return reasons
}

/** Everyone the slot suits, longest wait first. */
export const candidatesForSlot = (
  entries: WaitlistEntry[],
  slot: Pick<Slot, 'serviceId' | 'locationId' | 'startWall'>,
  context: MatchContext
): Candidate[] =>
  entries
    .filter((entry) => matchesSlot(entry, slot, context))
    .sort((a, b) => a.createdAtWall.localeCompare(b.createdAtWall))
    .map((entry) => ({ entry, reasons: reasonsFor(entry, slot, context) }))

/** Offers that are still holding their slot right now. */
export const liveOffers = <T extends { status: string; holdUntilWall: string }>(
  offers: T[],
  nowWallStamp: string
): T[] => offers.filter((offer) => offer.status === 'pending' && offer.holdUntilWall > nowWallStamp)

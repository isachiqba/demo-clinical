import { serviceById } from '@/data/services'
import type {
  Appointment,
  Offer,
  Slot,
  TimeBand,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import { isSlotOpen } from './availability'
import { dateKeyOf, minutesOf, weekdayOfKey } from './clinicTime'

/**
 * Who, out of the people waiting, a freed slot actually suits.
 *
 * The rules are plain and deterministic — service, clinic, clinician, dates, weekdays and
 * time of day — and the order is simply who has been waiting longest. Nothing here looks
 * at a diagnosis, an insurer, or anything else about a person: a clinic can read this file
 * and check every rule by eye, which is the point.
 */

const MORNING_ENDS = 12 * 60
const AFTERNOON_ENDS = 17 * 60

export const bandOfWall = (startWall: string): TimeBand => {
  const minutes = minutesOf(startWall)
  if (minutes < MORNING_ENDS) return 'morning'
  if (minutes < AFTERNOON_ENDS) return 'afternoon'
  return 'evening'
}

/** A short, translatable note on why a candidate fits. */
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
  /** Slots already held by a pending offer. */
  holds: Slot[]
  now?: Date
}

const withinWindow = (preferences: WaitlistPreferences, dateKey: string): boolean =>
  dateKey >= preferences.fromKey && dateKey <= preferences.toKey

/**
 * Why this entry does *not* fit, or an empty list when it does. Returning the failures
 * rather than a boolean keeps the rule set readable and makes the tests specific.
 */
export const mismatchReasons = (
  entry: WaitlistEntry,
  slot: Slot,
  context: MatchContext
): string[] => {
  const reasons: string[] = []
  const preferences = entry.preferences
  const dateKey = dateKeyOf(slot.startWall)

  if (entry.status !== 'waiting') reasons.push('status')
  if (preferences.serviceId !== slot.serviceId) reasons.push('service')

  // Same service means the same length, but check it rather than assume it.
  const service = serviceById(preferences.serviceId)
  if (service && service.durationMinutes !== slot.durationMinutes) reasons.push('duration')

  if (!preferences.locationIds.includes(slot.locationId)) reasons.push('location')
  if (preferences.providerId !== 'any' && preferences.providerId !== slot.providerId) {
    reasons.push('provider')
  }
  if (!withinWindow(preferences, dateKey)) reasons.push('dates')
  if (!preferences.weekdays.includes(weekdayOfKey(dateKey))) reasons.push('weekday')
  if (!preferences.bands.includes(bandOfWall(slot.startWall))) reasons.push('band')

  // Someone who already has an appointment is only interested in an earlier one.
  if (entry.linkedAppointmentId) {
    const linked = context.appointments.find(
      (appointment) => appointment.id === entry.linkedAppointmentId
    )
    if (!linked || linked.status === 'cancelled') reasons.push('linked-missing')
    else if (slot.startWall >= linked.startWall) reasons.push('not-earlier')
  }

  return reasons
}

export const matchesSlot = (entry: WaitlistEntry, slot: Slot, context: MatchContext): boolean =>
  mismatchReasons(entry, slot, context).length === 0

const reasonsFor = (entry: WaitlistEntry, slot: Slot, context: MatchContext): MatchReason[] => {
  const reasons: MatchReason[] = [{ key: 'waitingSince', params: { date: entry.createdAtWall } }]

  if (entry.preferences.providerId === slot.providerId) {
    reasons.push({ key: 'askedForProvider' })
  } else {
    reasons.push({ key: 'anyProvider' })
  }

  // Capitalised rather than dotted: a dot in a message key is a path in vue-i18n.
  const band = bandOfWall(slot.startWall)
  reasons.push({ key: `band${band.charAt(0).toUpperCase()}${band.slice(1)}` })

  const linked = entry.linkedAppointmentId
    ? context.appointments.find((appointment) => appointment.id === entry.linkedAppointmentId)
    : undefined
  if (linked) reasons.push({ key: 'bringsForward', params: { from: linked.startWall } })

  return reasons
}

/**
 * Everyone the slot suits, longest wait first. A slot that is no longer free matches
 * nobody, so a stale opening cannot be offered.
 */
export const candidatesForSlot = (
  entries: WaitlistEntry[],
  slot: Slot,
  context: MatchContext
): Candidate[] => {
  if (!isSlotOpen(slot, context.appointments, context.holds, context.now ?? new Date())) return []

  return entries
    .filter((entry) => matchesSlot(entry, slot, context))
    .sort((a, b) => a.createdAtWall.localeCompare(b.createdAtWall))
    .map((entry) => ({ entry, reasons: reasonsFor(entry, slot, context) }))
}

/** Offers that are still holding their slot right now. */
export const liveOffers = (offers: Offer[], nowWallStamp: string): Offer[] =>
  offers.filter((offer) => offer.status === 'pending' && offer.holdUntilWall > nowWallStamp)

export const heldSlots = (offers: Offer[], nowWallStamp: string): Slot[] =>
  liveOffers(offers, nowWallStamp).map((offer) => offer.slot)

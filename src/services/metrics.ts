import { locations } from '@/data/locations'
import type { Appointment, DemoState, LocationId, Offer } from '@/types'
import { OCCUPYING_STATUSES } from '@/types'
import { dayCapacity, gridFor, takenAt } from './availability'
import { pendingTaskOf } from './curemd'
import { addDaysToKey, dateKeyOf, daysBetweenKeys, nowWall, type DateKey } from './clinicTime'
import { liveOffers } from './waitlist'

/**
 * Everything the overview shows, computed from the shared state when it renders. No
 * stored counters: reload the page and the same numbers come back out.
 *
 * Two things the figures are careful about:
 *
 *  - Capacity is **this demo's local picture**, counted in ten-minute slots per clinic.
 *    Nothing here reads CureMD, so it is not a live view of the practice's real diary.
 *  - A **request** is not a confirmed appointment and is never counted as one. Requests,
 *    confirmed appointments and held slots are reported separately.
 */

export interface RangeFilter {
  fromKey: DateKey
  toKey: DateKey
  locationId: LocationId | 'all'
}

export interface SiteMetrics {
  locationId: LocationId
  /** Ten-minute slots the clinic offers across the range. */
  capacity: number
  confirmed: number
  requested: number
  /** Slots held by an unanswered offer, a pending change or a proposed alternative. */
  held: number
  free: number
  cancelled: number
  /** Share of capacity taken by confirmed appointments, 0–1. */
  confirmedShare: number
}

export interface OverviewMetrics {
  range: {
    requested: number
    confirmed: number
    cancelled: number
    unavailable: number
    capacity: number
    free: number
    held: number
  }
  now: {
    pendingRegistration: number
    pendingChange: number
    pendingCancellation: number
    waiting: number
    offered: number
    openOpenings: number
    activeHolds: number
    /** Only counts slots whose replacement is confirmed and declared registered. */
    filledFromWaitlist: number
  }
  sites: SiteMetrics[]
}

const datesIn = (filter: RangeFilter): DateKey[] => {
  const span = Math.max(0, daysBetweenKeys(filter.fromKey, filter.toKey))
  return Array.from({ length: span + 1 }, (_, index) => addDaysToKey(filter.fromKey, index))
}

const sitesInScope = (filter: RangeFilter): LocationId[] =>
  locations
    .map((location) => location.id)
    .filter((id) => filter.locationId === 'all' || filter.locationId === id)

const inRange = (filter: RangeFilter, dateKey: DateKey): boolean =>
  dateKey >= filter.fromKey && dateKey <= filter.toKey

const atSite = (
  appointments: Appointment[],
  locationId: LocationId,
  filter: RangeFilter
): Appointment[] =>
  appointments.filter(
    (appointment) =>
      appointment.locationId === locationId && inRange(filter, dateKeyOf(appointment.startWall))
  )

/** Slots a clinic is holding rather than filling: offers, pending moves and proposals. */
const heldAt = (state: DemoState, locationId: LocationId, filter: RangeFilter): number => {
  const stamp = nowWall()

  const offers = liveOffers(state.offers as Offer[], stamp).filter(
    (offer) =>
      offer.slot.locationId === locationId && inRange(filter, dateKeyOf(offer.slot.startWall))
  ).length

  const moves = state.appointments.filter(
    (appointment) =>
      OCCUPYING_STATUSES.includes(appointment.status) &&
      appointment.pendingChange &&
      appointment.pendingChange.locationId === locationId &&
      inRange(filter, dateKeyOf(appointment.pendingChange.startWall))
  ).length

  const proposals = state.appointments.filter(
    (appointment) =>
      appointment.status === 'requested' &&
      appointment.proposal &&
      appointment.proposal.locationId === locationId &&
      inRange(filter, dateKeyOf(appointment.proposal.startWall))
  ).length

  return offers + moves + proposals
}

export const siteMetrics = (state: DemoState, filter: RangeFilter): SiteMetrics[] => {
  const dates = datesIn(filter)
  const occupancy = { appointments: state.appointments, offers: state.offers }

  return sitesInScope(filter).map((locationId) => {
    const here = atSite(state.appointments, locationId, filter)
    const capacity = dates.reduce((total, dateKey) => total + dayCapacity(locationId, dateKey), 0)

    const confirmed = here.filter(
      (appointment) =>
        appointment.status === 'confirmed' ||
        appointment.status === 'arrived' ||
        appointment.status === 'completed'
    ).length
    const requested = here.filter((appointment) => appointment.status === 'requested').length
    const held = heldAt(state, locationId, filter)

    // Free is counted slot by slot, so a clinic taking more than one patient per slot is
    // measured properly rather than by subtraction.
    let free = 0
    for (const dateKey of dates) {
      for (const slot of gridFor(locationId, dateKey)) {
        if (takenAt(locationId, slot, occupancy) === 0) free += 1
      }
    }

    return {
      locationId,
      capacity,
      confirmed,
      requested,
      held,
      free,
      cancelled: here.filter((appointment) => appointment.status === 'cancelled').length,
      confirmedShare: capacity > 0 ? Math.min(1, confirmed / capacity) : 0
    }
  })
}

export const overviewMetrics = (state: DemoState, filter: RangeFilter): OverviewMetrics => {
  const sites = siteMetrics(state, filter)
  const stamp = nowWall()

  const scoped = state.appointments.filter(
    (appointment) =>
      (filter.locationId === 'all' || filter.locationId === appointment.locationId) &&
      inRange(filter, dateKeyOf(appointment.startWall))
  )

  const everywhere = state.appointments.filter(
    (appointment) => filter.locationId === 'all' || filter.locationId === appointment.locationId
  )

  const countTask = (task: 'registration' | 'change' | 'cancellation'): number =>
    everywhere.filter((appointment) => pendingTaskOf(appointment) === task).length

  /**
   * A slot only counts as covered once the replacement is both confirmed and declared
   * registered in CureMD. An acceptance on its own is not a filled slot.
   */
  const filled = state.offers.filter((offer) => {
    if (offer.status !== 'accepted' || !offer.appointmentId) return false
    if (filter.locationId !== 'all' && offer.slot.locationId !== filter.locationId) return false
    const appointment = state.appointments.find((item) => item.id === offer.appointmentId)
    if (!appointment) return false
    return (
      appointment.curemd.status === 'registered' &&
      appointment.curemd.registered?.startWall === offer.slot.startWall &&
      (appointment.status === 'confirmed' ||
        appointment.status === 'arrived' ||
        appointment.status === 'completed')
    )
  }).length

  const sum = (pick: (site: SiteMetrics) => number): number =>
    sites.reduce((total, site) => total + pick(site), 0)

  return {
    range: {
      requested: scoped.filter((appointment) => appointment.status === 'requested').length,
      confirmed: scoped.filter(
        (appointment) =>
          appointment.status === 'confirmed' ||
          appointment.status === 'arrived' ||
          appointment.status === 'completed'
      ).length,
      cancelled: scoped.filter((appointment) => appointment.status === 'cancelled').length,
      unavailable: scoped.filter((appointment) => appointment.status === 'unavailable').length,
      capacity: sum((site) => site.capacity),
      free: sum((site) => site.free),
      held: sum((site) => site.held)
    },
    now: {
      pendingRegistration: countTask('registration'),
      pendingChange: countTask('change'),
      pendingCancellation: countTask('cancellation'),
      waiting: state.waitlist.filter((entry) => entry.status === 'waiting').length,
      offered: state.waitlist.filter((entry) => entry.status === 'offered').length,
      openOpenings: state.openings.filter((opening) => opening.status === 'open').length,
      activeHolds: liveOffers(state.offers as Offer[], stamp).length,
      filledFromWaitlist: filled
    },
    sites
  }
}

import { locations } from '@/data/locations'
import { providers } from '@/data/providers'
import type { Appointment, DemoState, LocationId, Offer } from '@/types'
import { BLOCKING_STATUSES } from '@/types'
import { providerDayWindow } from './availability'
import { addDaysToKey, dateKeyOf, daysBetweenKeys, nowWall, type DateKey } from './clinicTime'
import { liveOffers } from './waitlist'

/**
 * Everything the overview shows, computed from the shared state. No stored counters and
 * no decorative figures: reload the page and the same numbers come back out.
 *
 * Occupancy has one definition throughout — booked minutes divided by the minutes the
 * clinic's clinicians are offering that day. Cancelled appointments are not occupancy,
 * and slots held by a pending offer are reported separately rather than counted as
 * booked, because nobody is in the room yet.
 */

export interface RangeFilter {
  fromKey: DateKey
  toKey: DateKey
  locationId: LocationId | 'all'
}

export interface SiteMetrics {
  locationId: LocationId
  capacityMinutes: number
  bookedMinutes: number
  heldMinutes: number
  freeMinutes: number
  /** 0–1, booked ÷ capacity. */
  occupancy: number
  appointments: number
  cancelled: number
}

export interface OverviewMetrics {
  /** Measured over the selected range. */
  range: {
    appointments: number
    confirmed: number
    cancelled: number
    capacityMinutes: number
    bookedMinutes: number
    heldMinutes: number
    freeMinutes: number
  }
  /** True of this moment, whatever range is selected. */
  now: {
    waiting: number
    offered: number
    openOpenings: number
    activeHolds: number
    /** Every slot the waitlist has filled, for the clinics in scope. Derived, so it
        never double-counts on a reload. */
    filledFromWaitlist: number
  }
  sites: SiteMetrics[]
}

const datesIn = (filter: RangeFilter): DateKey[] => {
  const span = Math.max(0, daysBetweenKeys(filter.fromKey, filter.toKey))
  return Array.from({ length: span + 1 }, (_, index) => addDaysToKey(filter.fromKey, index))
}

const inScope = (filter: RangeFilter, locationId: LocationId, dateKey: DateKey): boolean =>
  (filter.locationId === 'all' || filter.locationId === locationId) &&
  dateKey >= filter.fromKey &&
  dateKey <= filter.toKey

const sitesInScope = (filter: RangeFilter): LocationId[] =>
  locations
    .map((location) => location.id)
    .filter((id) => filter.locationId === 'all' || filter.locationId === id)

/** Minutes the clinicians of one clinic are offering across the range. */
export const capacityMinutes = (locationId: LocationId, dates: DateKey[]): number => {
  let total = 0
  for (const dateKey of dates) {
    for (const provider of providers) {
      if (!provider.locationIds.includes(locationId)) continue
      total += providerDayWindow(provider.id, locationId, dateKey)?.minutes ?? 0
    }
  }
  return total
}

const appointmentsAt = (
  appointments: Appointment[],
  filter: RangeFilter,
  locationId: LocationId
): Appointment[] =>
  appointments.filter(
    (appointment) =>
      appointment.locationId === locationId &&
      inScope(filter, locationId, dateKeyOf(appointment.startWall))
  )

const heldMinutesAt = (offers: Offer[], filter: RangeFilter, locationId: LocationId): number =>
  liveOffers(offers, nowWall())
    .filter(
      (offer) =>
        offer.slot.locationId === locationId &&
        inScope(filter, locationId, dateKeyOf(offer.slot.startWall))
    )
    .reduce((total, offer) => total + offer.slot.durationMinutes, 0)

export const siteMetrics = (state: DemoState, filter: RangeFilter): SiteMetrics[] => {
  const dates = datesIn(filter)

  return sitesInScope(filter).map((locationId) => {
    const here = appointmentsAt(state.appointments, filter, locationId)
    const active = here.filter((appointment) => BLOCKING_STATUSES.includes(appointment.status))

    const capacity = capacityMinutes(locationId, dates)
    const booked = active.reduce((total, appointment) => total + appointment.durationMinutes, 0)
    const held = heldMinutesAt(state.offers, filter, locationId)

    return {
      locationId,
      capacityMinutes: capacity,
      bookedMinutes: booked,
      heldMinutes: held,
      freeMinutes: Math.max(0, capacity - booked - held),
      occupancy: capacity > 0 ? Math.min(1, booked / capacity) : 0,
      appointments: active.length,
      cancelled: here.filter((appointment) => appointment.status === 'cancelled').length
    }
  })
}

export const overviewMetrics = (state: DemoState, filter: RangeFilter): OverviewMetrics => {
  const sites = siteMetrics(state, filter)
  const stamp = nowWall()

  const inRange = state.appointments.filter((appointment) =>
    inScope(filter, appointment.locationId, dateKeyOf(appointment.startWall))
  )

  const filled = state.offers.filter(
    (offer) =>
      offer.status === 'accepted' &&
      (filter.locationId === 'all' || filter.locationId === offer.slot.locationId)
  ).length

  const sum = (pick: (site: SiteMetrics) => number): number =>
    sites.reduce((total, site) => total + pick(site), 0)

  return {
    range: {
      appointments: inRange.filter((appointment) => BLOCKING_STATUSES.includes(appointment.status))
        .length,
      confirmed: inRange.filter((appointment) => appointment.status === 'confirmed').length,
      cancelled: inRange.filter((appointment) => appointment.status === 'cancelled').length,
      capacityMinutes: sum((site) => site.capacityMinutes),
      bookedMinutes: sum((site) => site.bookedMinutes),
      heldMinutes: sum((site) => site.heldMinutes),
      freeMinutes: sum((site) => site.freeMinutes)
    },
    now: {
      waiting: state.waitlist.filter((entry) => entry.status === 'waiting').length,
      offered: state.waitlist.filter((entry) => entry.status === 'offered').length,
      openOpenings: state.openings.filter((opening) => opening.status === 'open').length,
      activeHolds: liveOffers(state.offers, stamp).length,
      filledFromWaitlist: filled
    },
    sites
  }
}

import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, type SchedulingApi } from '@/services/schedulingApi'
import { overviewMetrics, siteMetrics, type RangeFilter } from '@/services/metrics'
import { scenarioIds } from '@/data/demoScenario'
import { addDaysToKey, dateKeyOf, todayKey } from '@/services/clinicTime'
import type { DemoState } from '@/types'

let api: SchedulingApi

const range = (): RangeFilter => ({
  fromKey: todayKey(),
  toKey: addDaysToKey(todayKey(), 20),
  locationId: 'all'
})

beforeEach(async () => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  await api.reset()
})

const scripted = (state: DemoState) =>
  state.appointments.find((item) => item.id === scenarioIds.openingAppointment)!

describe('overview metrics', () => {
  it('are computed from the shared state, with one site per clinic', async () => {
    const state = await api.getState()
    const metrics = overviewMetrics(state, range())

    expect(metrics.sites).toHaveLength(3)
    expect(metrics.range.capacityMinutes).toBeGreaterThan(0)
    expect(metrics.range.appointments).toBeGreaterThan(0)
    // Nothing is waiting to be offered yet.
    expect(metrics.now.filledFromWaitlist).toBe(0)
    expect(metrics.now.waiting).toBe(3)
    expect(metrics.now.activeHolds).toBe(0)
  })

  it('keeps booked, held and free minutes adding up to capacity', async () => {
    const state = await api.getState()
    for (const site of siteMetrics(state, range())) {
      expect(site.bookedMinutes + site.heldMinutes + site.freeMinutes).toBe(site.capacityMinutes)
      expect(site.occupancy).toBeGreaterThanOrEqual(0)
      expect(site.occupancy).toBeLessThanOrEqual(1)
    }
  })

  it('narrows every number when one clinic is selected', async () => {
    const state = await api.getState()
    const all = overviewMetrics(state, range())
    const downtown = overviewMetrics(state, { ...range(), locationId: 'downtown' })

    expect(downtown.sites).toHaveLength(1)
    expect(downtown.range.appointments).toBeLessThan(all.range.appointments)
    expect(downtown.range.capacityMinutes).toBeLessThan(all.range.capacityMinutes)
    // The "right now" figures are state, not range, so they do not move.
    expect(downtown.now.waiting).toBe(all.now.waiting)
  })

  it('does not count a cancelled appointment as occupancy', async () => {
    const before = await api.getState()
    const target = scripted(before)
    const beforeMetrics = overviewMetrics(before, range())

    await api.setStatus(target.id, 'cancelled')
    const after = await api.getState()
    const afterMetrics = overviewMetrics(after, range())

    expect(afterMetrics.range.bookedMinutes).toBe(
      beforeMetrics.range.bookedMinutes - target.durationMinutes
    )
    expect(afterMetrics.range.cancelled).toBe(beforeMetrics.range.cancelled + 1)
    expect(afterMetrics.range.appointments).toBe(beforeMetrics.range.appointments - 1)
    expect(afterMetrics.now.openOpenings).toBe(1)
  })

  it('reports a pending offer as held rather than booked', async () => {
    const state = await api.getState()
    await api.setStatus(scripted(state).id, 'cancelled')
    const cancelled = await api.getState()
    const candidates = await api.candidatesForOpening(cancelled.openings[0].id)
    await api.offerOpening(cancelled.openings[0].id, candidates[0].entry.id)

    const metrics = overviewMetrics(await api.getState(), range())
    expect(metrics.range.heldMinutes).toBe(cancelled.openings[0].slot.durationMinutes)
    expect(metrics.now.activeHolds).toBe(1)
    expect(metrics.now.offered).toBe(1)
  })

  it('counts a slot as filled from the waitlist only once it is accepted', async () => {
    const state = await api.getState()
    await api.setStatus(scripted(state).id, 'cancelled')
    const cancelled = await api.getState()
    const opening = cancelled.openings[0]
    const candidates = await api.candidatesForOpening(opening.id)
    const offered = await api.offerOpening(opening.id, candidates[0].entry.id)
    expect(offered.ok).toBe(true)
    if (!offered.ok) return

    expect(overviewMetrics(await api.getState(), range()).now.filledFromWaitlist).toBe(0)

    await api.respondToOffer(offered.offer.id, 'accept')
    const after = overviewMetrics(await api.getState(), range())
    expect(after.now.filledFromWaitlist).toBe(1)
    expect(after.range.heldMinutes).toBe(0)
    // The filled slot is booked again, so occupancy is back where it started.
    expect(after.range.bookedMinutes).toBe(
      overviewMetrics(state, range()).range.bookedMinutes
    )
  })

  it('does not double-count a filled slot after a reload', async () => {
    const state = await api.getState()
    await api.setStatus(scripted(state).id, 'cancelled')
    const cancelled = await api.getState()
    const candidates = await api.candidatesForOpening(cancelled.openings[0].id)
    const offered = await api.offerOpening(cancelled.openings[0].id, candidates[0].entry.id)
    if (!offered.ok) return
    await api.respondToOffer(offered.offer.id, 'accept')

    const snapshot = await api.getState()
    // Reading the state repeatedly is what a reload does; the figure is derived, not stored.
    expect(overviewMetrics(snapshot, range()).now.filledFromWaitlist).toBe(1)
    expect(overviewMetrics(await api.getState(), range()).now.filledFromWaitlist).toBe(1)
    // It is a running total: narrowing the period does not hide it.
    expect(
      overviewMetrics(snapshot, { ...range(), toKey: range().fromKey }).now.filledFromWaitlist
    ).toBe(1)
  })

  it('leaves out days outside the selected range', async () => {
    const state = await api.getState()
    const target = scripted(state)
    const day = dateKeyOf(target.startWall)

    const justThatDay = overviewMetrics(state, { fromKey: day, toKey: day, locationId: 'all' })
    const dayBefore = addDaysToKey(day, -1)
    const beforeOnly = overviewMetrics(state, {
      fromKey: dayBefore,
      toKey: dayBefore,
      locationId: 'all'
    })

    expect(justThatDay.range.appointments).toBeGreaterThan(0)
    expect(justThatDay.range.capacityMinutes).toBeLessThan(
      overviewMetrics(state, range()).range.capacityMinutes
    )
    expect(beforeOnly.range.appointments).toBeGreaterThanOrEqual(0)
  })
})

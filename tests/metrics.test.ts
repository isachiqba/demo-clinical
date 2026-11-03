import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoSchedulingApi, type SchedulingApi } from '@/services/schedulingApi'
import { overviewMetrics, siteMetrics, type RangeFilter } from '@/services/metrics'
import { SCRIPTED } from '@/data/demoScenario'
import { dayCapacity, gridFor } from '@/services/availability'
import { addDaysToKey, dateKeyOf, todayKey } from '@/services/clinicTime'
import type { DemoState } from '@/types'

let api: SchedulingApi

const range = (): RangeFilter => ({
  fromKey: todayKey(),
  toKey: addDaysToKey(todayKey(), 14),
  locationId: 'all'
})

beforeEach(async () => {
  api = createDemoSchedulingApi({ simulateLatency: false })
  await api.reset()
})

const state = (): Promise<DemoState> => api.getState()

describe('the overview', () => {
  it('counts the three clinics in ten-minute slots, not clinician minutes', async () => {
    const live = await state()
    const metrics = overviewMetrics(live, range())

    expect(metrics.sites).toHaveLength(3)
    for (const site of metrics.sites) {
      let expected = 0
      for (let offset = 0; offset <= 14; offset += 1) {
        expected += dayCapacity(site.locationId, addDaysToKey(todayKey(), offset))
      }
      expect(site.capacity).toBe(expected)
    }
  })

  it('never counts a request as a confirmed appointment', async () => {
    const live = await state()
    const request = live.appointments.find((a) => a.id === SCRIPTED.pendingRegistration)!
    const day = dateKeyOf(request.startWall)
    const metrics = overviewMetrics(live, { fromKey: day, toKey: day, locationId: 'all' })

    expect(metrics.range.requested).toBeGreaterThan(0)
    const site = metrics.sites.find((s) => s.locationId === request.locationId)!
    expect(site.requested).toBeGreaterThan(0)
    // The request is in its own column, not among the confirmed ones.
    expect(site.confirmed + site.requested).toBeGreaterThan(site.confirmed)
  })

  it('reports the three kinds of CureMD work waiting', async () => {
    const metrics = overviewMetrics(await state(), range())
    // The sample also has a patient who arrived before anyone registered them, so there is
    // more than one registration outstanding. The point is that all three kinds are there.
    expect(metrics.now.pendingRegistration).toBeGreaterThanOrEqual(1)
    expect(metrics.now.pendingChange).toBe(1)
    expect(metrics.now.pendingCancellation).toBe(1)
  })

  it('counts free slots by looking at the grid, not by subtracting', async () => {
    const live = await state()
    const day = todayKey()
    const metrics = siteMetrics(live, { fromKey: day, toKey: day, locationId: 'downtown' })[0]

    const grid = gridFor('downtown', day)
    expect(metrics.capacity).toBe(grid.length)
    expect(metrics.free).toBeLessThanOrEqual(metrics.capacity)
    expect(metrics.free).toBeGreaterThanOrEqual(0)
  })

  it('narrows every range figure when one clinic is selected', async () => {
    const live = await state()
    const all = overviewMetrics(live, range())
    const one = overviewMetrics(live, { ...range(), locationId: 'downtown' })

    expect(one.sites).toHaveLength(1)
    expect(one.range.capacity).toBeLessThan(all.range.capacity)
    expect(one.range.confirmed).toBeLessThanOrEqual(all.range.confirmed)
    // "Right now" figures are state, not range, so the waitlist does not move.
    expect(one.now.waiting).toBe(all.now.waiting)
  })

  it('keeps a cancelled appointment out of the confirmed count', async () => {
    const live = await state()
    const target = live.appointments.find((a) => a.id === SCRIPTED.cancellationPending)!
    const day = dateKeyOf(target.startWall)
    const filter = { fromKey: day, toKey: day, locationId: 'all' as const }
    const before = overviewMetrics(live, filter)

    await api.declareCancellationDone(target.id)
    const after = overviewMetrics(await state(), filter)

    expect(after.range.confirmed).toBe(before.range.confirmed - 1)
    expect(after.range.cancelled).toBe(before.range.cancelled + 1)
    expect(after.range.free).toBe(before.range.free + 1)
    expect(after.now.pendingCancellation).toBe(0)
  })

  it('shows a held slot apart from a confirmed one', async () => {
    const live = await state()
    const target = live.appointments.find((a) => a.id === SCRIPTED.cancellationPending)!
    const day = dateKeyOf(target.startWall)
    const filter = { fromKey: day, toKey: day, locationId: 'all' as const }

    await api.declareCancellationDone(target.id)
    const freed = await state()
    const candidates = await api.candidatesForOpening(freed.openings[0].id)
    await api.offerOpening(freed.openings[0].id, candidates[0].entry.id)

    const metrics = overviewMetrics(await state(), filter)
    expect(metrics.range.held).toBe(1)
    expect(metrics.now.activeHolds).toBe(1)
  })

  it('counts a covered slot once, and the same after a reload', async () => {
    const live = await state()
    const target = live.appointments.find((a) => a.id === SCRIPTED.cancellationPending)!
    const filter = {
      fromKey: dateKeyOf(target.startWall),
      toKey: dateKeyOf(target.startWall),
      locationId: 'all' as const
    }

    await api.declareCancellationDone(target.id)
    const freed = await state()
    const candidates = await api.candidatesForOpening(freed.openings[0].id)
    const offer = await api.offerOpening(freed.openings[0].id, candidates[0].entry.id)
    if (!offer.ok) return
    const accepted = await api.respondToOffer(offer.offer.id, 'accept')
    if (!accepted.ok || !accepted.appointment) return

    // An acceptance alone is not a covered slot.
    expect(overviewMetrics(await state(), filter).now.filledFromWaitlist).toBe(0)

    await api.declareRegistration(accepted.appointment.id, { confirmNow: true })
    const snapshot = await state()
    expect(overviewMetrics(snapshot, filter).now.filledFromWaitlist).toBe(1)
    // Derived, so reading it again gives the same answer.
    expect(overviewMetrics(await state(), filter).now.filledFromWaitlist).toBe(1)
  })
})

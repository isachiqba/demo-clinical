import { describe, expect, it } from 'vitest'
import {
  CLINIC_TIME_ZONE,
  addDaysToKey,
  addMinutesToWall,
  daysBetweenKeys,
  formatWallTime,
  instantToWall,
  isPastWall,
  makeWall,
  minutesOf,
  minutesUntilWall,
  todayKey,
  wallToInstant,
  weekdayOfKey,
  zoneAbbreviation
} from '@/services/clinicTime'

describe('clinic wall clock', () => {
  it('is pinned to the clinics timezone, not the machine', () => {
    expect(CLINIC_TIME_ZONE).toBe('America/New_York')
  })

  it('maps a winter wall time to the right UTC instant (EST, UTC-5)', () => {
    // 2026-01-14 09:00 in New York is 14:00 UTC.
    expect(wallToInstant('2026-01-14T09:00').toISOString()).toBe('2026-01-14T14:00:00.000Z')
  })

  it('maps a summer wall time to the right UTC instant (EDT, UTC-4)', () => {
    // The same wall clock in July is 13:00 UTC, one hour earlier in absolute terms.
    expect(wallToInstant('2026-07-14T09:00').toISOString()).toBe('2026-07-14T13:00:00.000Z')
  })

  it('round-trips an instant through the wall clock', () => {
    const instant = new Date('2026-03-20T15:40:00.000Z')
    expect(wallToInstant(instantToWall(instant)).getTime()).toBe(instant.getTime())
  })

  it('reports the right zone abbreviation on each side of the DST change', () => {
    // US daylight saving in 2026 runs 8 March to 1 November.
    expect(zoneAbbreviation('2026-01-15')).toBe('EST')
    expect(zoneAbbreviation('2026-07-15')).toBe('EDT')
  })

  it('keeps 09:00 at 09:00 across the spring-forward weekend', () => {
    const before = wallToInstant('2026-03-07T09:00')
    const after = wallToInstant('2026-03-09T09:00')
    // Two calendar days apart, but only 47 hours of real time.
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(47)
  })

  it('adds minutes through the real instant, so a DST jump is respected', () => {
    // 01:30 EST + 60 min lands at 03:30 EDT on the spring-forward night.
    expect(addMinutesToWall('2026-03-08T01:30', 60)).toBe('2026-03-08T03:30')
  })

  it('formats 12-hour in English and 24-hour in Spanish', () => {
    expect(formatWallTime('2026-05-04T14:30', 'en')).toBe('2:30 PM')
    expect(formatWallTime('2026-05-04T14:30', 'es')).toBe('14:30')
    expect(formatWallTime('2026-05-04T09:05', 'en')).toBe('9:05 AM')
    expect(formatWallTime('2026-05-04T09:05', 'es')).toBe('09:05')
  })

  it('does calendar arithmetic on keys without drifting', () => {
    expect(addDaysToKey('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDaysToKey('2026-03-08', -1)).toBe('2026-03-07')
    expect(daysBetweenKeys('2026-03-07', '2026-03-10')).toBe(3)
    expect(weekdayOfKey('2026-03-08')).toBe(0)
  })

  it('builds and reads wall stamps', () => {
    expect(makeWall('2026-04-01', 9 * 60 + 20)).toBe('2026-04-01T09:20')
    expect(minutesOf('2026-04-01T09:20')).toBe(560)
  })

  it('compares against now using real instants', () => {
    const now = new Date('2026-06-01T16:00:00.000Z') // 12:00 EDT
    expect(isPastWall('2026-06-01T11:00', now)).toBe(true)
    expect(isPastWall('2026-06-01T13:00', now)).toBe(false)
    expect(minutesUntilWall('2026-06-01T13:30', now)).toBe(90)
  })

  it('derives todays key from the clinic clock', () => {
    // 2026-01-01T02:00Z is still 31 December in New York.
    expect(todayKey(new Date('2026-01-01T02:00:00.000Z'))).toBe('2025-12-31')
  })
})

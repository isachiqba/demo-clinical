/**
 * All clinic scheduling happens in one timezone. Times are stored as *wall clock*
 * stamps in that zone (`YYYY-MM-DDTHH:mm`) and converted to real instants only when
 * something needs an instant: comparing against "now", or writing a calendar file.
 *
 * Daylight saving is handled by asking `Intl` for the zone's offset at the instant in
 * question, so a 09:00 appointment is 09:00 in Riverton in both January and July.
 */

export const CLINIC_TIME_ZONE = 'America/New_York'

/** `YYYY-MM-DD` */
export type DateKey = string
/** `YYYY-MM-DDTHH:mm`, wall clock in {@link CLINIC_TIME_ZONE}. */
export type Wall = string

const pad = (value: number): string => String(value).padStart(2, '0')

const zoneParts = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

interface Fields {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const fieldsAt = (instant: Date): Fields => {
  const parts = zoneParts.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second')
  }
}

/** Offset of the clinic zone from UTC, in milliseconds, at a given instant. */
const offsetAt = (instant: Date): number => {
  const f = fieldsAt(instant)
  const asIfUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second)
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

export const instantToWall = (instant: Date): Wall => {
  const f = fieldsAt(instant)
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}`
}

export const instantToDateKey = (instant: Date): DateKey => instantToWall(instant).slice(0, 10)

/**
 * The instant at which the clinic clock reads `wall`. Two passes: the first guess uses
 * the offset at the naive timestamp, the second corrects it across a DST boundary.
 */
export const wallToInstant = (wall: Wall): Date => {
  const [datePart, timePart = '00:00'] = wall.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0)
  const firstGuess = naive - offsetAt(new Date(naive))
  return new Date(naive - offsetAt(new Date(firstGuess)))
}

export const nowWall = (now: Date = new Date()): Wall => instantToWall(now)
export const todayKey = (now: Date = new Date()): DateKey => instantToDateKey(now)

export const dateKeyOf = (wall: Wall): DateKey => wall.slice(0, 10)
export const minutesOf = (wall: Wall): number =>
  Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16))

export const makeWall = (dateKey: DateKey, minutesFromMidnight: number): Wall =>
  `${dateKey}T${pad(Math.floor(minutesFromMidnight / 60))}:${pad(minutesFromMidnight % 60)}`

/** Pure calendar arithmetic on a date key — no timezone involved. */
export const addDaysToKey = (dateKey: DateKey, days: number): DateKey => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export const weekdayOfKey = (dateKey: DateKey): number => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export const daysBetweenKeys = (from: DateKey, to: DateKey): number => {
  const parse = (key: DateKey): number => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** Adds minutes across a DST boundary by going through the real instant. */
export const addMinutesToWall = (wall: Wall, minutes: number): Wall =>
  instantToWall(new Date(wallToInstant(wall).getTime() + minutes * 60_000))

export const isPastWall = (wall: Wall, now: Date = new Date()): boolean =>
  wallToInstant(wall).getTime() < now.getTime()

export const minutesUntilWall = (wall: Wall, now: Date = new Date()): number =>
  (wallToInstant(wall).getTime() - now.getTime()) / 60_000

const intlLocale = (locale: string): string => (locale === 'es' ? 'es-ES' : 'en-US')

/** English shows 2:30 PM; Spanish shows 14:30. Both in clinic time. */
export const formatWallTime = (wall: Wall, locale: string): string =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: CLINIC_TIME_ZONE,
    hour: locale === 'es' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: locale !== 'es'
  }).format(wallToInstant(wall))

export const formatWallDate = (
  wallOrKey: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { timeZone: CLINIC_TIME_ZONE, ...options }).format(
    wallToInstant(wallOrKey.length === 10 ? `${wallOrKey}T12:00` : wallOrKey)
  )

/** Minutes-from-midnight rendered as a clock time, for opening hours. */
export const formatClock = (minutes: number, locale: string): string =>
  formatWallTime(makeWall('2024-06-03', minutes), locale)

/** `EST` or `EDT`, whichever applies on that day. */
export const zoneAbbreviation = (wallOrKey: string = todayKey()): string => {
  const instant = wallToInstant(wallOrKey.length === 10 ? `${wallOrKey}T12:00` : wallOrKey)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    timeZoneName: 'short'
  }).formatToParts(instant)
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'ET'
}

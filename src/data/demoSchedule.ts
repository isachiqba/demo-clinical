import { addDaysToKey, todayKey, weekdayOfKey, type DateKey } from '@/services/clinicTime'

/** The clinics never open on a Sunday, so neither does the sample schedule. */
export const isOpenDay = (dateKey: DateKey): boolean => weekdayOfKey(dateKey) !== 0

/**
 * The day the sample schedule is built around: today when the clinics are open, else the
 * next day they are. Reception opens on this day so the demo is never empty.
 */
export const demoAnchorKey = (now: Date = new Date()): DateKey => {
  let key = todayKey(now)
  while (!isOpenDay(key)) key = addDaysToKey(key, 1)
  return key
}

/** Moves `steps` days that the clinics are open, so nothing lands on a Sunday. */
export const shiftOpenDays = (fromKey: DateKey, steps: number): DateKey => {
  let key = fromKey
  for (let taken = 0; taken < steps; ) {
    key = addDaysToKey(key, 1)
    if (isOpenDay(key)) taken += 1
  }
  return key
}

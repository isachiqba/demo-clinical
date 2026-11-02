import type { Appointment, AppointmentStatus, PatientType, ServiceId } from '@/types'
import { serviceById } from '@/data/services'
import { addDaysToKey, makeWall, todayKey, weekdayOfKey, type DateKey } from '@/services/clinicTime'

/**
 * Seed appointments so reception has a believable day on first load. Dates are always
 * relative to today, so the demo never expires. Every patient here is invented.
 */

/** The clinics never open on a Sunday, so neither does the sample schedule. */
const isOpenDay = (dateKey: DateKey): boolean => weekdayOfKey(dateKey) !== 0

/**
 * The day the sample schedule is built around: today when the clinics are open, else
 * the next day they are. Reception opens on this day so the demo is never empty.
 */
export const demoAnchorKey = (now: Date = new Date()): DateKey => {
  let key = todayKey(now)
  while (!isOpenDay(key)) key = addDaysToKey(key, 1)
  return key
}

/** Moves `steps` open days from `fromKey`, forwards or backwards. */
const shiftOpenDays = (fromKey: DateKey, steps: number): DateKey => {
  const direction = steps < 0 ? -1 : 1
  let key = fromKey
  for (let taken = 0; taken < Math.abs(steps); ) {
    key = addDaysToKey(key, direction)
    if (isOpenDay(key)) taken += 1
  }
  return key
}

interface Seed {
  dayOffset: number
  minutes: number
  serviceId: ServiceId
  providerId: string
  locationId: Appointment['locationId']
  first: string
  last: string
  status: AppointmentStatus
  patientType: PatientType
}

const seeds: Seed[] = [
  { dayOffset: 0, minutes: 8 * 60 + 20, serviceId: 'follow-up', providerId: 'ap-elena-sandoval', locationId: 'downtown', first: 'Ada', last: 'Whitlock', status: 'completed', patientType: 'existing' },
  { dayOffset: 0, minutes: 9 * 60, serviceId: 'primary-care', providerId: 'ap-elena-sandoval', locationId: 'downtown', first: 'Tomás', last: 'Riera', status: 'completed', patientType: 'existing' },
  { dayOffset: 0, minutes: 9 * 60 + 40, serviceId: 'annual-wellness', providerId: 'ap-howard-brennan', locationId: 'northside', first: 'Margaret', last: 'Oyelaran', status: 'arrived', patientType: 'existing' },
  { dayOffset: 0, minutes: 10 * 60 + 20, serviceId: 'non-emergency', providerId: 'ap-marcus-feld', locationId: 'westside', first: 'Jonah', last: 'Pike', status: 'confirmed', patientType: 'new' },
  { dayOffset: 0, minutes: 11 * 60, serviceId: 'primary-care', providerId: 'ap-marcus-feld', locationId: 'downtown', first: 'Priya', last: 'Narang', status: 'confirmed', patientType: 'existing' },
  { dayOffset: 0, minutes: 13 * 60 + 40, serviceId: 'follow-up', providerId: 'ap-howard-brennan', locationId: 'northside', first: 'Walter', last: 'Ibsen', status: 'cancelled', patientType: 'existing' },
  { dayOffset: 0, minutes: 14 * 60 + 20, serviceId: 'primary-care', providerId: 'ap-elena-sandoval', locationId: 'downtown', first: 'Rosa', last: 'Delgado', status: 'confirmed', patientType: 'existing' },
  { dayOffset: 0, minutes: 15 * 60 + 40, serviceId: 'annual-wellness', providerId: 'ap-elena-sandoval', locationId: 'downtown', first: 'Clement', last: 'Fairhurst', status: 'confirmed', patientType: 'new' },
  { dayOffset: 1, minutes: 8 * 60 + 40, serviceId: 'primary-care', providerId: 'ap-howard-brennan', locationId: 'westside', first: 'Ingrid', last: 'Solberg', status: 'confirmed', patientType: 'existing' },
  { dayOffset: 1, minutes: 10 * 60, serviceId: 'follow-up', providerId: 'ap-marcus-feld', locationId: 'downtown', first: 'Desmond', last: 'Achebe', status: 'confirmed', patientType: 'existing' },
  { dayOffset: 2, minutes: 9 * 60 + 20, serviceId: 'annual-wellness', providerId: 'ap-howard-brennan', locationId: 'northside', first: 'Lucía', last: 'Montero', status: 'confirmed', patientType: 'new' },
  { dayOffset: 3, minutes: 13 * 60 + 20, serviceId: 'non-emergency', providerId: 'ap-elena-sandoval', locationId: 'northside', first: 'Peter', last: 'Nakamura', status: 'confirmed', patientType: 'existing' },
  { dayOffset: -3, minutes: 11 * 60 + 20, serviceId: 'primary-care', providerId: 'ap-marcus-feld', locationId: 'westside', first: 'Hannah', last: 'Verity', status: 'completed', patientType: 'existing' }
]

const sampleEmail = (first: string, last: string): string =>
  `${first}.${last}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z.]/g, '') + '@example.com'

export const demoSchedule = (): Appointment[] => {
  const anchor = demoAnchorKey()
  return seeds.map((seed, index) => {
    const dateKey = seed.dayOffset === 0 ? anchor : shiftOpenDays(anchor, seed.dayOffset)
    return {
      id: `demo-${index + 1}`,
      reference: `LM-${(4100 + index * 137).toString().slice(0, 4)}`,
      serviceId: seed.serviceId,
      providerId: seed.providerId,
      locationId: seed.locationId,
      startWall: makeWall(dateKey, seed.minutes),
      durationMinutes: serviceById(seed.serviceId)?.durationMinutes ?? 30,
      patientType: seed.patientType,
      patient: {
        firstName: seed.first,
        lastName: seed.last,
        email: sampleEmail(seed.first, seed.last),
        phone: index % 3 === 0 ? '' : `(555) 01${index % 10}-${1000 + index * 7}`,
        coverage: index % 4 === 0 ? 'self-pay' : 'insurance'
      },
      status: seed.status,
      createdAtWall: makeWall(addDaysToKey(dateKey, -6), 10 * 60)
    }
  })
}

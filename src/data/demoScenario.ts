import type { Appointment, DemoState, PatientDetails, Slot, WaitlistEntry, WaitlistPreferences } from '@/types'
import { demoAnchorKey, demoSchedule } from '@/data/demoSchedule'
import { providers } from '@/data/providers'
import { slotsForProviderDay } from '@/services/availability'
import { addDaysToKey, makeWall, weekdayOfKey, type DateKey } from '@/services/clinicTime'
import { bandOfWall } from '@/services/waitlist'

/**
 * The scripted demonstration.
 *
 * It sets up one appointment that is meant to be cancelled on stage, and three people
 * waiting: two the freed slot suits and one it does not, so the filtering can be seen
 * working rather than described. One of the two already has a later appointment and would
 * be brought forward, which is the case worth showing.
 *
 * Every date is derived from today, so the scenario never goes stale, and the slot itself
 * is taken from the real availability generator, so it is always inside the clinician's
 * working window.
 */

/** The appointment the demo cancels. Reception's demo controls jump straight to it. */
export const SCRIPTED_OPENING_APPOINTMENT_ID = 'demo-scripted-opening'
const LATER_APPOINTMENT_ID = 'demo-scripted-later'

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/** Moves `steps` days that the clinics are open, so nothing lands on a Sunday. */
const shiftOpenDays = (fromKey: DateKey, steps: number): DateKey => {
  let key = fromKey
  for (let taken = 0; taken < steps; ) {
    key = addDaysToKey(key, 1)
    if (weekdayOfKey(key) !== 0) taken += 1
  }
  return key
}

/**
 * Invented names for the everyday appointments that make the clinics look like working
 * clinics. Deterministic: the same day always produces the same list.
 */
const FIRST_NAMES = [
  'Aurora', 'Benedikt', 'Carmen', 'Dimitri', 'Esther', 'Farid', 'Greta', 'Hassan', 'Imogen',
  'Jarek', 'Kiona', 'Lorcan', 'Maeve', 'Nikolai', 'Orla', 'Pilar', 'Quentin', 'Rosalind',
  'Soren', 'Tamsin', 'Ulises', 'Verity', 'Wendell', 'Xiomara', 'Yusuf', 'Zelda'
]
const LAST_NAMES = [
  'Abernathy', 'Bellweather', 'Castaneda', 'Dunmore', 'Eberhardt', 'Fairclough', 'Giordano',
  'Halvorsen', 'Ibarra', 'Jondrette', 'Kowalczyk', 'Lindqvist', 'Moravec', 'Nakagawa',
  'Oyelaran', 'Pankhurst', 'Quintero', 'Rasmussen', 'Strandberg', 'Thibodeaux'
]

const hash = (value: string): number => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

/**
 * Books a believable share of each clinician's day for the first week, so the overview
 * reads like a working practice rather than an empty diary — and so the waits differ by
 * appointment type the way they do in a real one: a check-up in a couple of days, an
 * annual review a week out. Further ahead the diary stays thin, as a real one does.
 */
const backgroundLoad = (anchor: DateKey, existing: Appointment[], days: number): Appointment[] => {
  const added: Appointment[] = []
  const all = (): Appointment[] => [...existing, ...added]

  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = offset === 0 ? anchor : shiftOpenDays(anchor, offset)

    for (const provider of providers) {
      for (const locationId of provider.locationIds) {
        for (const serviceId of provider.serviceIds) {
          const slots = slotsForProviderDay({
            serviceId,
            providerId: provider.id,
            locationId,
            dateKey,
            appointments: all()
          })

          for (const slot of slots) {
            const seed = hash(`${slot.id}|${serviceId}`)
            // Roughly two thirds of what is left gets taken.
            if (seed % 100 >= 66) continue

            const first = FIRST_NAMES[seed % FIRST_NAMES.length]
            const last = LAST_NAMES[(seed >> 7) % LAST_NAMES.length]
            added.push(
              appointmentFromSlot(
                `demo-load-${slot.id}-${serviceId}`,
                `LM-${(seed % 9000 + 1000).toString()}`,
                slot,
                patient(first, last, seed % 3 === 0 ? '' : `(555) 01${seed % 10}-${1000 + (seed % 8999)}`,
                  seed % 4 === 0 ? 'self-pay' : 'insurance'),
                addDaysToKey(dateKey, -7)
              )
            )
          }
        }
      }
    }
  }

  return added
}

/** A real slot from the generator, so the scripted appointment is always a legal one. */
const pickSlot = (
  serviceId: Slot['serviceId'],
  providerId: string,
  locationId: Slot['locationId'],
  dateKey: DateKey,
  band: 'morning' | 'afternoon' | 'evening',
  taken: Appointment[]
): Slot | null => {
  const slots = slotsForProviderDay({ serviceId, providerId, locationId, dateKey, appointments: taken })
  return slots.find((slot) => bandOfWall(slot.startWall) === band) ?? slots[0] ?? null
}

const patient = (
  firstName: string,
  lastName: string,
  phone: string,
  coverage: PatientDetails['coverage']
): PatientDetails => ({
  firstName,
  lastName,
  email: `${firstName}.${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z.]/g, '') + '@example.com',
  phone,
  coverage
})

const appointmentFromSlot = (
  id: string,
  reference: string,
  slot: Slot,
  who: PatientDetails,
  createdKey: DateKey
): Appointment => ({
  id,
  reference,
  serviceId: slot.serviceId,
  providerId: slot.providerId,
  locationId: slot.locationId,
  startWall: slot.startWall,
  durationMinutes: slot.durationMinutes,
  patientType: 'existing',
  patient: who,
  status: 'confirmed',
  createdAtWall: makeWall(createdKey, 10 * 60)
})

const preferences = (overrides: Partial<WaitlistPreferences>): WaitlistPreferences => ({
  serviceId: 'primary-care',
  locationIds: ['downtown'],
  providerId: 'any',
  fromKey: demoAnchorKey(),
  toKey: shiftOpenDays(demoAnchorKey(), 24),
  weekdays: WEEKDAYS,
  bands: ['morning'],
  language: 'en',
  ...overrides
})

/** Builds the scripted appointments on top of the everyday sample agenda. */
export const demoScenarioState = (): DemoState => {
  const anchor = demoAnchorKey()
  const base = demoSchedule()

  // The scripted appointments are placed first and the everyday load is generated around
  // them, so a busy diary can never bury the one the demonstration is built on.

  // The appointment that gets cancelled, three open days out, mid-morning at Downtown.
  const openingDay = shiftOpenDays(anchor, 3)
  const openingSlot = pickSlot('primary-care', 'ap-elena-sandoval', 'downtown', openingDay, 'morning', base)

  // The later appointment one of the waiting patients would be glad to bring forward.
  const laterDay = shiftOpenDays(anchor, 11)
  const laterSlot = pickSlot('primary-care', 'ap-elena-sandoval', 'downtown', laterDay, 'afternoon', base)

  const bernard = patient('Bernard', 'Castille', '(555) 012-3380', 'insurance')
  const henry = patient('Henry', 'Alvarado', '(555) 013-9041', 'insurance')
  const nadia = patient('Nadia', 'Okonjo', '(555) 011-5520', 'self-pay')
  const iris = patient('Iris', 'Lindqvist', '', 'insurance')

  const scripted: Appointment[] = []
  if (openingSlot) {
    scripted.push(
      appointmentFromSlot(
        SCRIPTED_OPENING_APPOINTMENT_ID,
        'LM-7F3K',
        openingSlot,
        bernard,
        addDaysToKey(anchor, -8)
      )
    )
  }
  if (laterSlot) {
    scripted.push(
      appointmentFromSlot(LATER_APPOINTMENT_ID, 'LM-2QD8', laterSlot, henry, addDaysToKey(anchor, -5))
    )
  }

  const withScripted = [...base, ...scripted]
  const appointments = [...withScripted, ...backgroundLoad(anchor, withScripted, 6)]

  const waitlist: WaitlistEntry[] = [
    {
      // Longest wait, so the top of the list. Fits the freed slot.
      id: 'wl-nadia',
      reference: 'WL-3081',
      patient: nadia,
      preferences: preferences({
        locationIds: ['downtown', 'northside'],
        providerId: 'any',
        bands: ['morning']
      }),
      linkedAppointmentId: null,
      status: 'waiting',
      createdAtWall: makeWall(addDaysToKey(anchor, -9), 9 * 60 + 20)
    },
    {
      // Already has a later appointment; an earlier one would replace it.
      id: 'wl-henry',
      reference: 'WL-4417',
      patient: henry,
      preferences: preferences({
        locationIds: ['downtown'],
        providerId: 'ap-elena-sandoval',
        bands: ['morning', 'afternoon'],
        weekdays: [...WEEKDAYS, 6],
        language: 'es'
      }),
      linkedAppointmentId: laterSlot ? LATER_APPOINTMENT_ID : null,
      status: 'waiting',
      createdAtWall: makeWall(addDaysToKey(anchor, -4), 16 * 60 + 5)
    },
    {
      // Deliberately does not fit: different appointment type, clinic and time of day.
      id: 'wl-iris',
      reference: 'WL-5562',
      patient: iris,
      preferences: preferences({
        serviceId: 'annual-wellness',
        locationIds: ['westside'],
        providerId: 'any',
        bands: ['afternoon'],
        weekdays: EVERY_DAY
      }),
      linkedAppointmentId: null,
      status: 'waiting',
      createdAtWall: makeWall(addDaysToKey(anchor, -2), 11 * 60 + 40)
    }
  ]

  return { appointments, waitlist, offers: [], openings: [], activity: [] }
}

/** The ids the demo controls need to reach straight into the scenario. */
export const scenarioIds = {
  openingAppointment: SCRIPTED_OPENING_APPOINTMENT_ID,
  laterAppointment: LATER_APPOINTMENT_ID,
  waitlist: ['wl-nadia', 'wl-henry', 'wl-iris']
} as const

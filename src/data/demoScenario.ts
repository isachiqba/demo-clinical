import type {
  Appointment,
  AppointmentStatus,
  AuditEntry,
  CareStage,
  CuremdStatus,
  DemoState,
  LocationId,
  PatientDetails,
  ServiceId,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import { DEMO_OPERATOR } from '@/types'
import { demoAnchorKey, shiftOpenDays } from '@/data/demoSchedule'
import { blocksOnWeekday } from '@/data/doctor'
import { locations } from '@/data/locations'
import { roomsAt } from '@/data/rooms'
import { gridFor } from '@/services/availability'
import {
  addDaysToKey,
  dateKeyOf,
  makeWall,
  minutesOf,
  weekdayOfKey,
  type DateKey
} from '@/services/clinicTime'
import { bandOfWall } from '@/services/waitlist'

/**
 * The scripted demonstration.
 *
 * It sets out one example of every state the front desk has to deal with, spread across
 * the three clinics: a request nobody has put into CureMD yet, an appointment that is
 * confirmed and registered, a change waiting to be applied, and a cancellation waiting to
 * be done. Three people are on the waitlist: two the cancelled slot suits — one of whom
 * already holds a later appointment — and one it does not, so the filtering can be seen
 * working rather than described.
 *
 * Every date is derived from today, so the scenario never goes stale, and every time is
 * taken from the real ten-minute grid, so it is always a slot the clinic actually offers.
 */

export const SCRIPTED = {
  /** Requested, nothing in CureMD yet. The demo control opens this one. */
  pendingRegistration: 'demo-scripted-request',
  /** Confirmed and declared registered. */
  registered: 'demo-scripted-registered',
  /** Registered, with a move waiting to be applied in CureMD. */
  changePending: 'demo-scripted-change',
  /** Registered, with a cancellation waiting to be done in CureMD. */
  cancellationPending: 'demo-scripted-cancellation'
} as const

export const scenarioIds = {
  ...SCRIPTED,
  waitlist: ['wl-nadia', 'wl-marguerite', 'wl-iris']
} as const

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const patient = (
  firstName: string,
  lastName: string,
  phone: string,
  coverage: PatientDetails['coverage']
): PatientDetails => ({
  firstName,
  lastName,
  email:
    `${firstName}.${lastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z.]/g, '') + '@example.com',
  phone,
  coverage
})

const hash = (value: string): number => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

/**
 * A free ten-minute start at one clinic, in the band asked for, on the first day from
 * `fromKey` onwards where the doctor is actually there.
 *
 * He only sits at each clinic on certain days, so a fixed date would leave the scripted
 * pieces missing whenever the demo is opened on the wrong weekday. Searching forward keeps
 * the scenario complete regardless of what today is, and still deterministic.
 */
const pickStart = (
  locationId: LocationId,
  fromKey: DateKey,
  band: 'morning' | 'afternoon',
  taken: Set<string>
): string | null => {
  for (let offset = 0; offset < 21; offset += 1) {
    const dateKey = addDaysToKey(fromKey, offset)
    const free = gridFor(locationId, dateKey).filter(
      (start) => !taken.has(`${locationId}|${start}`) && bandOfWall(start) === band
    )
    // A stable position inside the band, so the scenario reads the same every time.
    if (free.length) return free[Math.floor(free.length / 3)]
  }
  return null
}

const auditEntry = (kind: AuditEntry['kind'], atWall: string, extra: Partial<AuditEntry> = {}): AuditEntry => ({
  id: `au-${kind}-${atWall}`,
  atWall,
  operator: DEMO_OPERATOR.name,
  kind,
  ...extra
})

interface Built {
  id: string
  reference: string
  serviceId: ServiceId
  locationId: LocationId
  startWall: string
  who: PatientDetails
  status: AppointmentStatus
  curemdStatus: CuremdStatus
  curemdReference?: string | null
  createdKey: DateKey
}

const build = (input: Built): Appointment => {
  const registeredStates: CuremdStatus[] = ['registered', 'change-pending', 'cancellation-pending']
  const isRegistered = registeredStates.includes(input.curemdStatus)
  const declaredAt = makeWall(input.createdKey, 11 * 60)
  const name = `${input.who.firstName} ${input.who.lastName}`

  const audit: AuditEntry[] = [auditEntry('request-created', makeWall(input.createdKey, 10 * 60))]
  if (isRegistered) {
    audit.unshift(auditEntry('registration-declared', declaredAt, { reference: input.curemdReference ?? null }))
    audit.unshift(auditEntry('appointment-confirmed', declaredAt))
  }

  return {
    id: input.id,
    reference: input.reference,
    serviceId: input.serviceId,
    locationId: input.locationId,
    startWall: input.startWall,
    patientType: 'existing',
    patient: input.who,
    status: input.status,
    curemd: {
      status: input.curemdStatus,
      reference: input.curemdReference ?? null,
      registered: isRegistered
        ? {
            startWall: input.startWall,
            locationId: input.locationId,
            serviceId: input.serviceId,
            patientName: name
          }
        : null,
      declaredAtWall: isRegistered ? declaredAt : null,
      operator: isRegistered ? DEMO_OPERATOR.name : null
    },
    pendingChange: null,
    proposal: null,
    visit: null,
    version: isRegistered ? 3 : 1,
    createdAtWall: makeWall(input.createdKey, 10 * 60),
    audit
  }
}

/**
 * Gives a built appointment a visit, so the demo opens with people already in the
 * building and a couple who have been and gone.
 *
 * Arrival is set relative to the appointment time rather than to the clock, so the
 * examples read the same whenever the demo is opened. A finished visit never keeps its
 * room: that would leave a sample room occupied by somebody who left.
 */
const withVisit = (
  appointment: Appointment,
  stage: Exclude<CareStage, 'not-arrived'>,
  roomId: string | null,
  arrivedMinutesEarly: number
): Appointment => {
  const arrivedAt = makeWall(
    dateKeyOf(appointment.startWall),
    minutesOf(appointment.startWall) - arrivedMinutesEarly
  )
  const finished = stage === 'finished'
  appointment.visit = {
    arrivedAtWall: arrivedAt,
    arrivedBy: DEMO_OPERATOR.name,
    stage,
    roomId: finished ? null : roomId,
    leftAtWall: finished ? makeWall(dateKeyOf(appointment.startWall), minutesOf(appointment.startWall) + 25) : null,
    printsRequested: 0,
    lastPrintAtWall: null
  }
  appointment.audit = [auditEntry('arrival-recorded', arrivedAt), ...appointment.audit]
  if (roomId) {
    appointment.audit = [auditEntry('room-assigned', arrivedAt), ...appointment.audit]
  }
  if (finished) {
    appointment.audit = [
      auditEntry('visit-finished', appointment.visit.leftAtWall!),
      ...appointment.audit
    ]
  }
  return appointment
}

const FIRST_NAMES = [
  'Aurora', 'Benedikt', 'Carmen', 'Dimitri', 'Esther', 'Farid', 'Greta', 'Hassan', 'Imogen',
  'Jarek', 'Kiona', 'Lorcan', 'Maeve', 'Nikolai', 'Orla', 'Pilar', 'Quentin', 'Rosalind',
  'Soren', 'Tamsin', 'Ulises', 'Verity', 'Wendell', 'Xiomara', 'Yusuf', 'Zelda'
]
const LAST_NAMES = [
  'Abernathy', 'Bellweather', 'Castaneda', 'Dunmore', 'Eberhardt', 'Fairclough', 'Giordano',
  'Halvorsen', 'Ibarra', 'Jondrette', 'Kowalczyk', 'Moravec', 'Nakagawa', 'Pankhurst',
  'Quintero', 'Rasmussen', 'Strandberg', 'Thibodeaux'
]
const SERVICES: ServiceId[] = ['primary-care', 'annual-wellness', 'follow-up', 'non-emergency']

/**
 * Fills a believable share of each clinic's day with confirmed, registered appointments,
 * so the overview reads like a working practice. Deterministic, and it works around
 * whatever the scripted pieces have already taken.
 */
const backgroundLoad = (anchor: DateKey, taken: Set<string>): Appointment[] => {
  const made: Appointment[] = []

  // Busy for the next two open days, thinner after that — as a real diary looks.
  const plan: { dateKey: DateKey; share: number }[] = [
    { dateKey: anchor, share: 38 },
    { dateKey: shiftOpenDays(anchor, 1), share: 34 },
    { dateKey: shiftOpenDays(anchor, 2), share: 16 },
    { dateKey: shiftOpenDays(anchor, 3), share: 14 },
    { dateKey: shiftOpenDays(anchor, 4), share: 10 },
    { dateKey: shiftOpenDays(anchor, 5), share: 8 }
  ]

  for (const { dateKey, share } of plan) {
    for (const location of locations) {
      for (const start of gridFor(location.id, dateKey)) {
        const key = `${location.id}|${start}`
        if (taken.has(key)) continue
        const seed = hash(key)
        if (seed % 100 >= share) continue

        taken.add(key)
        const first = FIRST_NAMES[seed % FIRST_NAMES.length]
        const last = LAST_NAMES[(seed >> 7) % LAST_NAMES.length]
        made.push(
          build({
            id: `demo-load-${key}`,
            reference: `LM-${(1000 + (seed % 9000)).toString()}`,
            serviceId: SERVICES[(seed >> 3) % SERVICES.length],
            locationId: location.id,
            startWall: start,
            who: patient(
              first,
              last,
              seed % 3 === 0 ? '' : `(555) 01${seed % 10}-${1000 + (seed % 8999)}`,
              seed % 4 === 0 ? 'self-pay' : 'insurance'
            ),
            status: 'confirmed',
            curemdStatus: 'registered',
            curemdReference: `CMD-${20000 + (seed % 60000)}`,
            createdKey: addDaysToKey(dateKey, -6)
          })
        )
      }
    }
  }

  return made
}

const preferences = (overrides: Partial<WaitlistPreferences>): WaitlistPreferences => ({
  serviceId: 'primary-care',
  locationIds: ['downtown'],
  fromKey: demoAnchorKey(),
  toKey: shiftOpenDays(demoAnchorKey(), 24),
  weekdays: WEEKDAYS,
  bands: ['morning'],
  language: 'en',
  ...overrides
})

export const demoScenarioState = (): DemoState => {
  const anchor = demoAnchorKey()
  const taken = new Set<string>()

  const bernard = patient('Bernard', 'Castille', '(555) 012-3380', 'insurance')
  const marguerite = patient('Marguerite', 'Oyelaran', '(555) 013-9041', 'insurance')
  const tomas = patient('Tomás', 'Riera', '', 'self-pay')
  const walter = patient('Walter', 'Ibsen', '(555) 011-7702', 'insurance')
  const nadia = patient('Nadia', 'Okonjo', '(555) 011-5520', 'self-pay')
  const iris = patient('Iris', 'Lindqvist', '', 'insurance')
  const ines = patient('Inés', 'Carvalho', '(555) 012-8841', 'insurance')
  const teodor = patient('Teodor', 'Mazur', '', 'self-pay')
  const priya = patient('Priya', 'Raghunathan', '(555) 013-2217', 'insurance')
  const abel = patient('Abel', 'Nkemdirim', '(555) 014-6690', 'self-pay')

  const requestDay = shiftOpenDays(anchor, 2)
  const cancelDay = shiftOpenDays(anchor, 2)
  const changeDay = shiftOpenDays(anchor, 3)
  const laterDay = shiftOpenDays(anchor, 5)

  // Scripted pieces take their slots first, so the everyday load works around them.
  const cancelStart = pickStart('downtown', cancelDay, 'morning', taken)
  if (cancelStart) taken.add(`downtown|${cancelStart}`)
  const requestStart = pickStart('downtown', requestDay, 'afternoon', taken)
  if (requestStart) taken.add(`downtown|${requestStart}`)
  const laterStart = pickStart('northside', laterDay, 'morning', taken)
  if (laterStart) taken.add(`northside|${laterStart}`)
  const changeStart = pickStart('westside', changeDay, 'morning', taken)
  if (changeStart) taken.add(`westside|${changeStart}`)
  // Searched from the day he is already there, so the two times stay close together.
  const changeTarget = pickStart(
    'westside',
    changeStart ? dateKeyOf(changeStart) : changeDay,
    'afternoon',
    taken
  )
  if (changeTarget) taken.add(`westside|${changeTarget}`)

  const scripted: Appointment[] = []

  // 1. A request the clinic has not dealt with yet.
  if (requestStart) {
    scripted.push(
      build({
        id: SCRIPTED.pendingRegistration,
        reference: 'LM-7F3K',
        serviceId: 'primary-care',
        locationId: 'downtown',
        startWall: requestStart,
        who: bernard,
        status: 'requested',
        curemdStatus: 'pending-registration',
        createdKey: addDaysToKey(anchor, -1)
      })
    )
  }

  // 2. Confirmed and registered — and the appointment one waiting patient would move.
  if (laterStart) {
    scripted.push(
      build({
        id: SCRIPTED.registered,
        reference: 'LM-2QD8',
        serviceId: 'primary-care',
        locationId: 'northside',
        startWall: laterStart,
        who: marguerite,
        status: 'confirmed',
        curemdStatus: 'registered',
        curemdReference: 'CMD-55831',
        createdKey: addDaysToKey(anchor, -5)
      })
    )
  }

  // 3. Registered, with a move already agreed and waiting to be applied in CureMD.
  if (changeStart && changeTarget) {
    const appointment = build({
      id: SCRIPTED.changePending,
      reference: 'LM-9XB2',
      serviceId: 'follow-up',
      locationId: 'westside',
      startWall: changeStart,
      who: tomas,
      status: 'confirmed',
      curemdStatus: 'change-pending',
      curemdReference: 'CMD-55790',
      createdKey: addDaysToKey(anchor, -4)
    })
    appointment.pendingChange = {
      startWall: changeTarget,
      locationId: 'westside',
      requestedAtWall: makeWall(anchor, 9 * 60 + 10),
      source: 'reception',
      offerId: null
    }
    appointment.audit.unshift(
      auditEntry('change-requested', makeWall(anchor, 9 * 60 + 10), {
        detail: { was: changeStart, now: changeTarget }
      })
    )
    scripted.push(appointment)
  }

  // 4. Registered, cancelled by the patient, waiting to be taken out of CureMD. Its slot
  //    stays occupied until reception says they have done it.
  if (cancelStart) {
    const appointment = build({
      id: SCRIPTED.cancellationPending,
      reference: 'LM-4K7T',
      serviceId: 'primary-care',
      locationId: 'downtown',
      startWall: cancelStart,
      who: walter,
      status: 'confirmed',
      curemdStatus: 'cancellation-pending',
      curemdReference: 'CMD-55602',
      createdKey: addDaysToKey(anchor, -7)
    })
    appointment.audit.unshift(auditEntry('cancellation-requested', makeWall(anchor, 8 * 60 + 40)))
    scripted.push(appointment)
  }

  const waitlist: WaitlistEntry[] = [
    {
      // Longest wait, so the top of the list. The cancelled slot suits her.
      id: 'wl-nadia',
      reference: 'WL-3081',
      patient: nadia,
      preferences: preferences({ locationIds: ['downtown', 'northside'], bands: ['morning'] }),
      linkedAppointmentId: null,
      status: 'waiting',
      createdAtWall: makeWall(addDaysToKey(anchor, -9), 9 * 60 + 20)
    },
    {
      // Already holds a later appointment that is registered in CureMD, so accepting an
      // earlier one becomes a change for reception to apply rather than an instant move.
      id: 'wl-marguerite',
      reference: 'WL-4417',
      patient: marguerite,
      preferences: preferences({
        locationIds: ['downtown', 'northside'],
        bands: ['morning', 'afternoon'],
        weekdays: [...WEEKDAYS, 6],
        language: 'es'
      }),
      linkedAppointmentId: laterStart ? SCRIPTED.registered : null,
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
        bands: ['afternoon'],
        weekdays: EVERY_DAY
      }),
      linkedAppointmentId: null,
      status: 'waiting',
      createdAtWall: makeWall(addDaysToKey(anchor, -2), 11 * 60 + 40)
    }
  ]

  /**
   * People already in the building, at different points of their visit and in different
   * rooms, so the clinic view is not empty when the demo opens.
   *
   * They are placed at the clinics the doctor actually sits in on the anchor day, which is
   * at most two of the three — he cannot be in three places. Across a week the samples
   * therefore cover all three sites; on any one day they cover that day's.
   */
  const inClinic: Appointment[] = []
  const todaysBlocks = blocksOnWeekday(weekdayOfKey(anchor))

  const arrivals: {
    who: PatientDetails
    stage: Exclude<CareStage, 'not-arrived'>
    room: number | null
    early: number
    reference: string
    curemd: CuremdStatus
  }[] = [
    // In a consulting room.
    { who: priya, stage: 'in-clinic', room: 0, early: 35, reference: 'LM-3H9V', curemd: 'registered' },
    // In the vitals room.
    { who: teodor, stage: 'in-clinic', room: 1, early: 25, reference: 'LM-8T4L', curemd: 'registered' },
    // Arrived although the registration is still outstanding: the task stays open.
    { who: abel, stage: 'in-clinic', room: null, early: 10, reference: 'LM-5W8C', curemd: 'pending-registration' },
    // Been and gone, so the finished list is not empty either. Holds no room.
    { who: ines, stage: 'finished', room: null, early: 15, reference: 'LM-6R2P', curemd: 'registered' }
  ]

  for (const [index, entry] of arrivals.entries()) {
    const block = todaysBlocks[index % Math.max(1, todaysBlocks.length)]
    if (!block) break

    const start = pickStart(block.locationId, anchor, bandOfWall(makeWall(anchor, block.startsAt)) === 'morning' ? 'morning' : 'afternoon', taken)
    if (!start || dateKeyOf(start) !== anchor) continue
    taken.add(`${block.locationId}|${start}`)

    const clinicRooms = roomsAt(block.locationId)
    const roomId = entry.room === null ? null : (clinicRooms[entry.room]?.id ?? null)

    const built = build({
      id: `demo-inclinic-${index}`,
      reference: entry.reference,
      serviceId: index % 2 === 0 ? 'primary-care' : 'follow-up',
      locationId: block.locationId,
      startWall: start,
      who: entry.who,
      status:
        entry.curemd === 'registered'
          ? entry.stage === 'finished'
            ? 'completed'
            : 'arrived'
          : 'requested',
      curemdStatus: entry.curemd,
      curemdReference: entry.curemd === 'registered' ? `CMD-6${index}204` : null,
      createdKey: addDaysToKey(anchor, -3)
    })
    inClinic.push(withVisit(built, entry.stage, roomId, entry.early))
  }

  return {
    appointments: [...scripted, ...inClinic, ...backgroundLoad(anchor, taken)],
    waitlist,
    offers: [],
    openings: [],
    activity: []
  }
}

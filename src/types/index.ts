/** Shared domain types. Everything modelled here is fictional demo data. */

export type Locale = 'en' | 'es'

/** A string that exists in both supported languages. */
export type Localized = Record<Locale, string>

export type ServiceId = 'primary-care' | 'annual-wellness' | 'follow-up' | 'non-emergency'

export type LocationId = 'downtown' | 'northside' | 'westside'

/** `any` is the patient saying "wherever is soonest". */
export type LocationChoice = LocationId | 'any'

export type PatientType = 'new' | 'existing'

export type Coverage = 'insurance' | 'self-pay'

/**
 * Appointments are offered on a ten-minute grid. This is the booking interval only. It is
 * not a promise that an appointment lasts ten minutes, and the interface never says so.
 */
export const SLOT_MINUTES = 10

export interface Service {
  id: ServiceId
  icon: string
  name: Localized
  summary: Localized
  detail: Localized
}

/**
 * When the clinic's doors are open. This is **not** when the doctor is there: his
 * consulting blocks live in `src/data/doctor.ts` and are always a subset of these.
 */
export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. `null` on both ends means closed that day. */
  weekday: number
  opensAt: number | null
  closesAt: number | null
}

export interface ClinicLocation {
  id: LocationId
  name: Localized
  /** Deliberately a description, not a postal address — see README. */
  place: Localized
  gettingHere: Localized
  phone: string
  image: string
  hours: OpeningHours[]
  /**
   * How many patients are seen in one ten-minute slot. Provisional: the real figure is not
   * confirmed, so the demo uses one per slot. It is never multiplied by the number of
   * clinics — there is one doctor, and his day is the limit.
   */
  slotCapacity: number
}

/**
 * One consulting block: the doctor sitting in one clinic, from `startsAt` to `endsAt`
 * minutes past midnight, on one weekday. `pause` is a break inside the block.
 *
 * Blocks never overlap, because there is only one of him.
 */
export interface ClinicBlock {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  locationId: LocationId
  startsAt: number
  endsAt: number
  pause?: [number, number]
}

/**
 * The single doctor. No qualifications, registrations, affiliations or years of practice
 * are modelled here on purpose — see `src/data/doctor.ts`.
 */
export interface DoctorProfile {
  name: string
  initials: string
  /** The kind of care offered, not a credential. */
  care: Localized
  tagline: Localized
  /** The introduction on his page, one entry per paragraph. */
  bio: Localized[]
  /** The line that closes the page, above the booking button. */
  invitation: Localized
  languages: Locale[]
  image: string
  /** True while the portrait is a stand-in, which the interface then says. */
  imageIsIllustrative: boolean
  blocks: ClinicBlock[]
  travelBufferMinutes: number
}

/** A bookable ten-minute slot at one clinic. Wall clock in the clinics' timezone. */
export interface Slot {
  id: string
  serviceId: ServiceId
  locationId: LocationId
  startWall: string
}

export interface PatientDetails {
  firstName: string
  lastName: string
  email: string
  /** Optional on purpose: the flow never requires a phone number. */
  phone: string
  coverage: Coverage | ''
}

// --- the two independent statuses -------------------------------------------

/**
 * Where the appointment itself stands with the clinic.
 *
 * `requested` is what the public site produces: the patient has asked for a time and the
 * clinic has not yet agreed to it.
 */
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'unavailable'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'requested',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
  'unavailable'
]

/** Statuses that still take up a slot's capacity. */
export const OCCUPYING_STATUSES: AppointmentStatus[] = [
  'requested',
  'confirmed',
  'arrived',
  'completed'
]

/**
 * Where the same appointment stands in CureMD — which this application never talks to.
 * Every value here records something a receptionist *declared* they did by hand.
 */
export type CuremdStatus =
  | 'pending-registration'
  | 'registered'
  | 'change-pending'
  | 'cancellation-pending'
  | 'cancelled'
  | 'not-required'

export const CUREMD_STATUSES: CuremdStatus[] = [
  'pending-registration',
  'registered',
  'change-pending',
  'cancellation-pending',
  'cancelled',
  'not-required'
]

/** The three kinds of work that land in the CureMD inbox. */
export type CuremdTask = 'registration' | 'change' | 'cancellation'

/** What reception declared they typed into CureMD, kept verbatim. */
export interface RegisteredSnapshot {
  startWall: string
  locationId: LocationId
  serviceId: ServiceId
  patientName: string
}

export interface CuremdRecord {
  status: CuremdStatus
  /** The appointment reference CureMD gave reception, if they noted it down. */
  reference: string | null
  /** The data reception says is in CureMD right now. */
  registered: RegisteredSnapshot | null
  declaredAtWall: string | null
  operator: string | null
}

/** A time reception has offered a patient who asked for one that was not available. */
export interface Proposal {
  startWall: string
  locationId: LocationId
  proposedAtWall: string
}

/** A time the clinic or a waiting patient wants, not yet reflected in CureMD. */
export interface PendingChange {
  startWall: string
  locationId: LocationId
  requestedAtWall: string
  source: 'reception' | 'waitlist'
  offerId: string | null
}

export type AuditKind =
  | 'request-created'
  | 'appointment-confirmed'
  | 'registration-declared'
  | 'change-requested'
  | 'change-applied'
  | 'change-abandoned'
  | 'cancellation-requested'
  | 'cancellation-completed'
  | 'marked-unavailable'
  | 'alternative-proposed'
  | 'alternative-accepted'
  | 'note-added'
  | 'offer-sent'
  | 'offer-accepted'
  | 'offer-declined'
  | 'offer-expired'
  | 'arrival-recorded'
  | 'room-assigned'
  | 'room-corrected'
  | 'slip-print-requested'
  | 'visit-finished'

export interface AuditEntry {
  id: string
  atWall: string
  /** Always the demonstration operator; this app has no sign-in. */
  operator: string
  kind: AuditKind
  reference?: string | null
  note?: string
  detail?: Record<string, string | number>
}

export interface Appointment {
  id: string
  /** Lorba's own reference, shown to the patient. Not a CureMD reference. */
  reference: string
  serviceId: ServiceId
  locationId: LocationId
  startWall: string
  patientType: PatientType
  patient: PatientDetails
  status: AppointmentStatus
  curemd: CuremdRecord
  pendingChange: PendingChange | null
  /** An alternative reception has put to the patient, who has not accepted it yet. */
  proposal: Proposal | null
  /** Null until someone records that the patient arrived. */
  visit: Visit | null
  /** Bumped on every write, so a dialog opened on stale data can be caught. */
  version: number
  createdAtWall: string
  audit: AuditEntry[]
}

// --- what happens once the patient is in the building -----------------------

/**
 * A room inside a clinic. A room is a *place*, not a doctor and not a service: three rooms
 * do not mean three doctors, and they never add to how many appointments Dr. Lorba can see.
 */
export interface ConsultingRoom {
  id: string
  locationId: LocationId
  name: Localized
}

/**
 * Where the visit stands. This is a **third** state, independent of the appointment status
 * and of the CureMD record, and the interface never blends the three.
 *
 * Three values, on purpose. The front desk records that someone walked in and that they
 * left; what happens in between is the consulting room's business, not reception's, and
 * asking a receptionist to tick off each stage of it only invites a half-kept diary.
 */
export type CareStage = 'not-arrived' | 'in-clinic' | 'finished'

export const CARE_STAGES: CareStage[] = ['not-arrived', 'in-clinic', 'finished']

/**
 * The visit: what happened after the patient walked in. Absent until someone records an
 * arrival, which is why it hangs off the appointment as a nullable rather than defaulting.
 */
export interface Visit {
  arrivedAtWall: string
  /** Always the demonstration operator; this app has no sign-in. */
  arrivedBy: string
  stage: CareStage
  /**
   * The room, chosen once when the patient arrives and kept for the whole visit. It can be
   * corrected if the wrong one was picked, but the patient is not shuttled between rooms.
   */
  roomId: string | null
  /** When they left. Set by finishing the visit, which also frees the room. */
  leftAtWall: string | null
  /** How many times a slip has been *asked* for. Printing is never claimed to have happened. */
  printsRequested: number
  lastPrintAtWall: string | null
}

// --- waitlist ---------------------------------------------------------------

export type TimeBand = 'morning' | 'afternoon' | 'evening'

export const TIME_BANDS: TimeBand[] = ['morning', 'afternoon', 'evening']

export interface WaitlistPreferences {
  serviceId: ServiceId
  /** Clinics the patient would accept; at least one. */
  locationIds: LocationId[]
  fromKey: string
  toKey: string
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  bands: TimeBand[]
  language: Locale
}

export type WaitlistStatus = 'waiting' | 'offered' | 'accepted' | 'withdrawn'

export interface WaitlistEntry {
  id: string
  reference: string
  patient: PatientDetails
  preferences: WaitlistPreferences
  /** The appointment this entry is attached to, when the patient wants an earlier one. */
  linkedAppointmentId: string | null
  status: WaitlistStatus
  createdAtWall: string
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn'

export interface Offer {
  id: string
  entryId: string
  openingId: string | null
  slot: Slot
  status: OfferStatus
  createdAtWall: string
  /** When an unanswered offer lapses. Once accepted the slot is held without an expiry. */
  holdUntilWall: string
  /** The request or reschedule the acceptance produced. */
  appointmentId: string | null
  replacedAppointmentId: string | null
}

/** A slot that has come free and has not been filled yet. */
export interface Opening {
  id: string
  slot: Slot
  source: 'cancellation' | 'reschedule'
  createdAtWall: string
  status: 'open' | 'filled' | 'dismissed'
}

export type ActivityKind = AuditKind | 'opening-detected'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  atWall: string
  operator: string
  locationId: LocationId | null
  appointmentId: string | null
  detail: {
    patient?: string
    service?: string
    when?: string
    was?: string
    count?: number
    reference?: string
  }
}

/** Everything the demo keeps. One object, one storage key, one source of truth. */
export interface DemoState {
  appointments: Appointment[]
  waitlist: WaitlistEntry[]
  offers: Offer[]
  openings: Opening[]
  activity: ActivityEvent[]
}

export const BOOKING_STEPS = ['visit', 'place', 'when', 'details'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

/** The only operator this demo has. There is no authentication of any kind. */
export const DEMO_OPERATOR = { id: 'demo-reception', name: 'Demo Reception' } as const

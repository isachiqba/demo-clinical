/** Shared domain types. Everything modelled here is fictional demo data. */

export type Locale = 'en' | 'es'

/** A string that exists in both supported languages. */
export type Localized = Record<Locale, string>

export type ServiceId =
  | 'primary-care'
  | 'annual-wellness'
  | 'follow-up'
  | 'non-emergency'

export type LocationId = 'downtown' | 'northside' | 'westside'

/** `any` is the patient saying "wherever / whoever is soonest". */
export type LocationChoice = LocationId | 'any'
export type ProviderChoice = string | 'any'

export type PatientType = 'new' | 'existing'

export type Coverage = 'insurance' | 'self-pay'

export interface Service {
  id: ServiceId
  icon: string
  name: Localized
  summary: Localized
  detail: Localized
  durationMinutes: number
}

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
}

export interface Provider {
  id: string
  name: string
  role: Localized
  /** Language codes the clinician works in. */
  languages: Locale[]
  serviceIds: ServiceId[]
  locationIds: LocationId[]
  about: Localized
  image: string
  initials: string
}

/**
 * A bookable opening. `startWall` is a wall-clock stamp in the clinics' timezone
 * (`YYYY-MM-DDTHH:mm`), never the viewer's local time.
 */
export interface Slot {
  id: string
  serviceId: ServiceId
  providerId: string
  locationId: LocationId
  startWall: string
  durationMinutes: number
}

export interface PatientDetails {
  firstName: string
  lastName: string
  email: string
  /** Optional on purpose: the flow never requires a phone number. */
  phone: string
  coverage: Coverage | ''
}

export type AppointmentStatus = 'confirmed' | 'arrived' | 'completed' | 'cancelled'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'confirmed',
  'arrived',
  'completed',
  'cancelled'
]

/** Statuses that still occupy a clinician's calendar. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ['confirmed', 'arrived', 'completed']

export interface Appointment {
  id: string
  /** Short human reference shown to the patient and used by reception search. */
  reference: string
  serviceId: ServiceId
  providerId: string
  locationId: LocationId
  startWall: string
  durationMinutes: number
  patientType: PatientType
  patient: PatientDetails
  status: AppointmentStatus
  createdAtWall: string
}

export const BOOKING_STEPS = ['visit', 'place', 'when', 'details'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

// --- Waitlist ---------------------------------------------------------------

/** The three parts of a clinic day a patient can say they are able to attend. */
export type TimeBand = 'morning' | 'afternoon' | 'evening'

export const TIME_BANDS: TimeBand[] = ['morning', 'afternoon', 'evening']

export interface WaitlistPreferences {
  serviceId: ServiceId
  /** Clinics the patient would accept; at least one. */
  locationIds: LocationId[]
  providerId: ProviderChoice
  /** Inclusive window the patient is available in, as date keys. */
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
  /**
   * The booking this entry is attached to, when the patient already has an appointment
   * and only wants something sooner. Any offer must then be earlier than it.
   */
  linkedAppointmentId: string | null
  status: WaitlistStatus
  createdAtWall: string
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn'

/**
 * A slot offered to one waiting patient. While it is `pending` it also holds the slot, so
 * the same time cannot be offered twice or booked from the public site underneath.
 */
export interface Offer {
  id: string
  entryId: string
  openingId: string | null
  slot: Slot
  status: OfferStatus
  createdAtWall: string
  /** When the hold lapses; after this the slot goes back on sale. */
  holdUntilWall: string
  /** Set once accepted. */
  appointmentId: string | null
  /** The appointment the patient gave up to take this one, if any. */
  replacedAppointmentId: string | null
}

/** A slot that came free and has not been filled yet. */
export interface Opening {
  id: string
  slot: Slot
  source: 'cancellation' | 'reschedule'
  createdAtWall: string
  status: 'open' | 'filled' | 'dismissed'
}

export type ActivityKind =
  | 'appointment-cancelled'
  | 'appointment-rescheduled'
  | 'opening-detected'
  | 'offer-sent'
  | 'offer-accepted'
  | 'offer-declined'
  | 'offer-expired'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  atWall: string
  locationId: LocationId | null
  /** Already-resolved fragments; the interface supplies the sentence around them. */
  detail: {
    patient?: string
    service?: string
    provider?: string
    when?: string
    count?: number
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

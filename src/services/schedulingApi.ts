import { demoScenarioState } from '@/data/demoScenario'
import type {
  ActivityEvent,
  ActivityKind,
  Appointment,
  AppointmentStatus,
  AuditEntry,
  AuditKind,
  DemoState,
  LocationId,
  Offer,
  Opening,
  PatientDetails,
  PatientType,
  RegisteredSnapshot,
  ServiceId,
  Slot,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import { DEMO_OPERATOR } from '@/types'
import { roomById } from '@/data/rooms'
import { canRecordArrival, roomRefusal } from './careFlow'
import { firstAvailable, isSlotOpen, searchDay, slotCounts, slotId } from './availability'
import {
  canConfirm,
  cancellingNeedsCuremd,
  effectiveStartWall,
  pendingTaskOf
} from './curemd'
import { addMinutesToWall, isPastWall, nowWall, type DateKey } from './clinicTime'
import { STORAGE_KEYS, storage } from './storage'
import { candidatesForSlot, type Candidate } from './waitlist'

/**
 * The seam between the interface and "the back end".
 *
 * Two things this file does **not** do, on purpose:
 *
 *  - It never contacts CureMD. There is no integration, no endpoint and no automation of
 *    its interface. Every CureMD status here records what a receptionist declared they
 *    did by hand in that system.
 *  - It never promises availability. The slots it offers come from this demo's own
 *    records, so a request is a request: the clinic confirms it afterwards.
 *
 * Every transition lives here rather than in a dialog, so the appointment status and the
 * CureMD status cannot drift apart.
 */

export interface SlotSearch {
  serviceId: ServiceId
  locationId: LocationId | 'any'
}

export interface RequestInput extends SlotSearch {
  slot: Slot
  patientType: PatientType
  patient: PatientDetails
}

export interface WaitlistInput {
  patient: PatientDetails
  preferences: WaitlistPreferences
  linkedAppointmentId?: string | null
}

export type FailureReason =
  | 'slot-taken'
  | 'not-found'
  | 'duplicate'
  | 'already-offered'
  | 'offer-closed'
  | 'no-match'
  | 'stale'
  | 'not-allowed'
  // room and care-stage refusals
  | 'unknown-room'
  | 'wrong-clinic'
  | 'room-busy'

export type Result<T> = ({ ok: true } & T) | { ok: false; reason: FailureReason }

export type OfferResponse = 'accept' | 'decline' | 'expire'

/** Every write carries the version the operator was looking at. */
export interface Guarded {
  expectedVersion?: number
}

export interface RegistrationInput extends Guarded {
  /** The reference CureMD gave reception, if they noted it down. */
  curemdReference?: string | null
  /** Confirm the appointment in the same action. */
  confirmNow?: boolean
  note?: string
}

export interface SchedulingApi {
  getState(): Promise<DemoState>
  getDaySlots(search: SlotSearch & { dateKey: DateKey }): Promise<Slot[]>
  getDayCounts(search: SlotSearch & { fromKey: DateKey; days: number }): Promise<Record<DateKey, number>>
  getFirstAvailable(search: SlotSearch & { fromKey: DateKey }): Promise<Slot | null>

  /** The public site creates requests, never confirmed appointments. */
  requestAppointment(input: RequestInput): Promise<Result<{ appointment: Appointment }>>

  declareRegistration(id: string, input: RegistrationInput): Promise<Result<{ appointment: Appointment }>>
  confirmAppointment(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  requestChange(
    id: string,
    slot: Pick<Slot, 'locationId' | 'startWall'>,
    guard?: Guarded & { source?: 'reception' | 'waitlist'; offerId?: string | null }
  ): Promise<Result<{ appointment: Appointment }>>
  declareChangeApplied(
    id: string,
    guard?: Guarded & { curemdReference?: string | null }
  ): Promise<Result<{ appointment: Appointment }>>
  abandonChange(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  requestCancellation(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  declareCancellationDone(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  markUnavailable(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  proposeAlternative(
    id: string,
    slot: Pick<Slot, 'locationId' | 'startWall'>,
    guard?: Guarded
  ): Promise<Result<{ appointment: Appointment }>>
  acceptProposal(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  setAttendance(
    id: string,
    status: Extract<AppointmentStatus, 'arrived' | 'completed'>,
    guard?: Guarded
  ): Promise<Result<{ appointment: Appointment }>>
  addNote(id: string, note: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>

  // --- once the patient is in the building ---
  /**
   * Records that the patient walked in and puts them in a room, in one action. Never
   * touches the CureMD record. `roomId` may be null if no room is free yet.
   */
  recordArrival(
    id: string,
    roomId: string | null,
    guard?: Guarded
  ): Promise<Result<{ appointment: Appointment }>>
  /** Puts right a room picked by mistake. The room is otherwise kept for the whole visit. */
  correctRoom(
    id: string,
    roomId: string | null,
    guard?: Guarded
  ): Promise<Result<{ appointment: Appointment }>>
  /** Records the departure, frees the room and completes the appointment where it can. */
  finishVisit(id: string, guard?: Guarded): Promise<Result<{ appointment: Appointment }>>
  /** Notes that a slip was *asked* for. The browser dialog may still be cancelled. */
  noteSlipRequested(id: string): Promise<Result<{ appointment: Appointment }>>

  joinWaitlist(input: WaitlistInput): Promise<Result<{ entry: WaitlistEntry }>>
  updateWaitlistPreferences(
    id: string,
    preferences: WaitlistPreferences
  ): Promise<Result<{ entry: WaitlistEntry }>>
  withdrawFromWaitlist(id: string): Promise<Result<{ entry: WaitlistEntry }>>
  candidatesForOpening(openingId: string): Promise<Candidate[]>
  offerOpening(openingId: string, entryId: string): Promise<Result<{ offer: Offer }>>
  respondToOffer(
    offerId: string,
    response: OfferResponse
  ): Promise<Result<{ offer: Offer; appointment: Appointment | null }>>
  dismissOpening(id: string): Promise<Result<{ opening: Opening }>>

  loadScenario(): Promise<DemoState>
  reset(): Promise<DemoState>
}

const LATENCY_MS = 200
const WRITE_LATENCY_MS = 520

/** How long an unanswered waitlist offer holds its slot. */
export const HOLD_MINUTES = 15

export interface DemoApiOptions {
  simulateLatency?: boolean
}

const REFERENCE_ALPHABET = 'ACDEFHJKLMNPRTUVWXY349'

const makeReference = (prefix: string, taken: string[]): string => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const body = Array.from(
      { length: 4 },
      () => REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)]
    ).join('')
    const reference = `${prefix}-${body}`
    if (!taken.includes(reference)) return reference
  }
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`
}

let sequence = 0
const makeId = (prefix: string): string => {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

export const createDemoSchedulingApi = (options: DemoApiOptions = {}): SchedulingApi => {
  const simulateLatency = options.simulateLatency ?? true

  const settle = <T>(value: T, ms = LATENCY_MS): Promise<T> => {
    if (!simulateLatency || ms === 0) return Promise.resolve(value)
    return new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(value), ms)
    })
  }

  /**
   * State written by an older build is thrown away rather than loaded, because its shape
   * may no longer be the one this code reads. See `SCHEMA_VERSION`.
   */
  let state: DemoState =
    storage.readVersioned<DemoState | null>(STORAGE_KEYS.demoState, null) ?? demoScenarioState()

  const persist = (): void => storage.writeVersioned(STORAGE_KEYS.demoState, state)

  const snapshot = (): DemoState => JSON.parse(JSON.stringify(state)) as DemoState

  /** What availability has to work around. */
  const occupancy = () => ({ appointments: state.appointments, offers: state.offers })

  const find = (id: string): Appointment | undefined =>
    state.appointments.find((record) => record.id === id)

  const patientNameOf = (appointment: Appointment): string =>
    `${appointment.patient.firstName} ${appointment.patient.lastName}`

  /** Room names go into the audit trail in English; the interface translates its own. */
  const roomNameOf = (roomId: string | null): string =>
    roomId ? (roomById(roomId)?.name.en ?? roomId) : '—'

  const audit = (
    appointment: Appointment,
    kind: AuditKind,
    extra: Partial<AuditEntry> = {}
  ): void => {
    const entry: AuditEntry = {
      id: makeId('au'),
      atWall: nowWall(),
      operator: DEMO_OPERATOR.name,
      kind,
      ...extra
    }
    appointment.audit = [entry, ...appointment.audit]
  }

  const log = (
    kind: ActivityKind,
    locationId: LocationId | null,
    appointmentId: string | null,
    detail: ActivityEvent['detail']
  ): void => {
    const event: ActivityEvent = {
      id: makeId('ev'),
      kind,
      atWall: nowWall(),
      operator: DEMO_OPERATOR.name,
      locationId,
      appointmentId,
      detail
    }
    state.activity = [event, ...state.activity].slice(0, 80)
  }

  const touch = (appointment: Appointment): void => {
    appointment.version += 1
  }

  /** Guards every write: the operator must have been looking at the current version. */
  const stale = (appointment: Appointment, guard?: Guarded): boolean =>
    guard?.expectedVersion !== undefined && guard.expectedVersion !== appointment.version

  const snapshotOf = (appointment: Appointment): RegisteredSnapshot => ({
    startWall: appointment.startWall,
    locationId: appointment.locationId,
    serviceId: appointment.serviceId,
    patientName: patientNameOf(appointment)
  })

  const slotOf = (locationId: LocationId, startWall: string, serviceId: ServiceId): Slot => ({
    id: slotId(locationId, startWall),
    serviceId,
    locationId,
    startWall
  })

  const matchCount = (slot: Slot): number =>
    candidatesForSlot(state.waitlist, slot, { appointments: state.appointments }).length

  /**
   * Records a slot that has genuinely come free. A cancellation that reception has not
   * yet done in CureMD does **not** reach here: the time is not ours to give away until
   * it is out of the other system.
   */
  const releaseSlot = (
    locationId: LocationId,
    startWall: string,
    serviceId: ServiceId,
    source: Opening['source']
  ): void => {
    if (isPastWall(startWall)) return
    const slot = slotOf(locationId, startWall, serviceId)
    state.openings = [
      {
        id: makeId('op'),
        slot,
        source,
        createdAtWall: nowWall(),
        status: 'open'
      },
      ...state.openings
    ]
    log('opening-detected', locationId, null, {
      service: serviceId,
      when: startWall,
      count: matchCount(slot)
    })
  }

  /** Lapsed offers are settled on the way in to every call. */
  const reconcile = (): void => {
    const stamp = nowWall()
    let changed = false

    for (const offer of state.offers) {
      if (offer.status !== 'pending' || offer.holdUntilWall > stamp) continue
      offer.status = 'expired'
      changed = true
      const entry = state.waitlist.find((item) => item.id === offer.entryId)
      if (entry && entry.status === 'offered') entry.status = 'waiting'
      log('offer-expired', offer.slot.locationId, null, {
        patient: entry ? `${entry.patient.firstName} ${entry.patient.lastName}` : undefined,
        when: offer.slot.startWall
      })
    }

    if (changed) persist()
  }

  /**
   * Finishes a write. The payload is copied on the way out: callers must not be holding a
   * live reference into the store, or a guard like `expectedVersion` would always see the
   * latest value and never catch a stale dialog.
   */
  const done = <T extends object>(value: T, ms = 0): Promise<{ ok: true } & T> => {
    persist()
    return settle({ ok: true, ...(JSON.parse(JSON.stringify(value)) as T) }, ms)
  }

  const newAppointment = (
    slot: Pick<Slot, 'locationId' | 'startWall'>,
    serviceId: ServiceId,
    patientType: PatientType,
    patient: PatientDetails
  ): Appointment => ({
    id: makeId('apt'),
    reference: makeReference(
      'LM',
      state.appointments.map((item) => item.reference)
    ),
    serviceId,
    locationId: slot.locationId,
    startWall: slot.startWall,
    patientType,
    patient: { ...patient, email: patient.email.trim() },
    status: 'requested',
    curemd: {
      status: 'pending-registration',
      reference: null,
      registered: null,
      declaredAtWall: null,
      operator: null
    },
    pendingChange: null,
    proposal: null,
    visit: null,
    version: 1,
    createdAtWall: nowWall(),
    audit: []
  })

  return {
    async getState() {
      reconcile()
      return settle(snapshot(), 0)
    },

    async getDaySlots(search) {
      reconcile()
      return settle(searchDay({ ...search, state: occupancy() }))
    },

    async getDayCounts(search) {
      reconcile()
      return settle(slotCounts({ ...search, state: occupancy() }))
    },

    async getFirstAvailable(search) {
      reconcile()
      return settle(firstAvailable({ ...search, state: occupancy() }))
    },

    // --- the public site ----------------------------------------------------

    async requestAppointment(input) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()

      if (!isSlotOpen(input.slot, occupancy())) return { ok: false, reason: 'slot-taken' }

      const duplicate = state.appointments.some(
        (record) =>
          record.status !== 'cancelled' &&
          record.status !== 'unavailable' &&
          record.startWall === input.slot.startWall &&
          record.locationId === input.slot.locationId &&
          record.patient.email.toLowerCase() === input.patient.email.trim().toLowerCase()
      )
      if (duplicate) return { ok: false, reason: 'duplicate' }

      const appointment = newAppointment(
        input.slot,
        input.slot.serviceId,
        input.patientType,
        input.patient
      )
      audit(appointment, 'request-created')
      state.appointments = [...state.appointments, appointment]
      log('request-created', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        service: appointment.serviceId,
        when: appointment.startWall,
        reference: appointment.reference
      })
      return done({ appointment })
    },

    // --- the CureMD inbox ---------------------------------------------------

    async declareRegistration(id, input) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, input)) return { ok: false, reason: 'stale' }

      // Idempotent: declaring it twice changes nothing and logs nothing.
      if (appointment.curemd.status === 'registered') return done({ appointment })
      if (appointment.curemd.status !== 'pending-registration') {
        return { ok: false, reason: 'not-allowed' }
      }

      appointment.curemd = {
        status: 'registered',
        reference: input.curemdReference?.trim() || null,
        registered: snapshotOf(appointment),
        declaredAtWall: nowWall(),
        operator: DEMO_OPERATOR.name
      }
      appointment.proposal = null
      touch(appointment)
      audit(appointment, 'registration-declared', {
        reference: appointment.curemd.reference,
        note: input.note
      })
      log('registration-declared', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall,
        reference: appointment.curemd.reference ?? undefined
      })

      if (input.confirmNow && canConfirm(appointment)) {
        appointment.status = 'confirmed'
        touch(appointment)
        audit(appointment, 'appointment-confirmed')
        log('appointment-confirmed', appointment.locationId, appointment.id, {
          patient: patientNameOf(appointment),
          when: appointment.startWall
        })
      }

      return done({ appointment })
    },

    async confirmAppointment(id, guard) {
      await settle(null, 300)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.status === 'confirmed') return done({ appointment })
      if (!canConfirm(appointment)) return { ok: false, reason: 'not-allowed' }

      appointment.status = 'confirmed'
      touch(appointment)
      audit(appointment, 'appointment-confirmed')
      log('appointment-confirmed', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall
      })
      return done({ appointment })
    },

    async requestChange(id, slot, guard) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }

      const others = {
        appointments: state.appointments.filter((item) => item.id !== id),
        offers: state.offers
      }
      if (!isSlotOpen(slot, others)) return { ok: false, reason: 'slot-taken' }

      const was = appointment.startWall

      if (appointment.curemd.status === 'pending-registration') {
        // Nothing is in CureMD yet, so the request simply changes and stays pending.
        appointment.locationId = slot.locationId
        appointment.startWall = slot.startWall
        appointment.proposal = null
        touch(appointment)
        audit(appointment, 'change-requested', { detail: { was, now: slot.startWall } })
        log('change-requested', appointment.locationId, appointment.id, {
          patient: patientNameOf(appointment),
          when: slot.startWall,
          was
        })
        return done({ appointment })
      }

      if (appointment.curemd.status !== 'registered') return { ok: false, reason: 'not-allowed' }

      // Already in CureMD: keep the registered time and hold the new one until reception
      // says they have changed it there.
      appointment.pendingChange = {
        startWall: slot.startWall,
        locationId: slot.locationId,
        requestedAtWall: nowWall(),
        source: guard?.source ?? 'reception',
        offerId: guard?.offerId ?? null
      }
      appointment.curemd.status = 'change-pending'
      touch(appointment)
      audit(appointment, 'change-requested', { detail: { was, now: slot.startWall } })
      log('change-requested', slot.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: slot.startWall,
        was
      })
      return done({ appointment })
    },

    async declareChangeApplied(id, guard) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.curemd.status === 'registered' && !appointment.pendingChange) {
        return done({ appointment })
      }
      if (appointment.curemd.status !== 'change-pending' || !appointment.pendingChange) {
        return { ok: false, reason: 'not-allowed' }
      }

      const previous = { locationId: appointment.locationId, startWall: appointment.startWall }
      const change = appointment.pendingChange

      appointment.locationId = change.locationId
      appointment.startWall = change.startWall
      appointment.pendingChange = null
      appointment.curemd.status = 'registered'
      appointment.curemd.registered = snapshotOf(appointment)
      appointment.curemd.declaredAtWall = nowWall()
      appointment.curemd.operator = DEMO_OPERATOR.name
      if (guard?.curemdReference !== undefined) {
        appointment.curemd.reference = guard.curemdReference?.trim() || appointment.curemd.reference
      }
      if (appointment.status === 'requested') appointment.status = 'confirmed'
      touch(appointment)
      audit(appointment, 'change-applied', {
        reference: appointment.curemd.reference,
        detail: { was: previous.startWall, now: appointment.startWall }
      })
      log('change-applied', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall,
        was: previous.startWall
      })

      // The old time is only now genuinely free.
      releaseSlot(previous.locationId, previous.startWall, appointment.serviceId, 'reschedule')
      return done({ appointment })
    },

    async abandonChange(id, guard) {
      await settle(null, 300)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (!appointment.pendingChange) return done({ appointment })

      const abandoned = appointment.pendingChange
      appointment.pendingChange = null
      appointment.curemd.status = 'registered'
      touch(appointment)
      audit(appointment, 'change-abandoned', { detail: { dropped: abandoned.startWall } })
      log('change-abandoned', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall,
        was: abandoned.startWall
      })

      // A waitlist patient who was promised that time goes back on the list.
      if (abandoned.offerId) {
        const offer = state.offers.find((item) => item.id === abandoned.offerId)
        const entry = offer && state.waitlist.find((item) => item.id === offer.entryId)
        if (offer) offer.status = 'withdrawn'
        if (entry) entry.status = 'waiting'
      }
      return done({ appointment })
    },

    async requestCancellation(id, guard) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.status === 'cancelled') return done({ appointment })

      if (!cancellingNeedsCuremd(appointment)) {
        // Never reached CureMD, so there is nothing to undo there.
        appointment.status = 'cancelled'
        appointment.curemd.status = 'not-required'
        appointment.pendingChange = null
        appointment.proposal = null
        touch(appointment)
        audit(appointment, 'cancellation-completed')
        log('cancellation-completed', appointment.locationId, appointment.id, {
          patient: patientNameOf(appointment),
          when: appointment.startWall
        })
        releaseSlot(
          appointment.locationId,
          appointment.startWall,
          appointment.serviceId,
          'cancellation'
        )
        return done({ appointment })
      }

      // In CureMD: the appointment keeps its slot until reception takes it out there.
      appointment.curemd.status = 'cancellation-pending'
      appointment.pendingChange = null
      touch(appointment)
      audit(appointment, 'cancellation-requested')
      log('cancellation-requested', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall
      })
      return done({ appointment })
    },

    async declareCancellationDone(id, guard) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.curemd.status === 'cancelled') return done({ appointment })
      if (appointment.curemd.status !== 'cancellation-pending') {
        return { ok: false, reason: 'not-allowed' }
      }

      appointment.status = 'cancelled'
      appointment.curemd.status = 'cancelled'
      appointment.curemd.declaredAtWall = nowWall()
      appointment.curemd.operator = DEMO_OPERATOR.name
      touch(appointment)
      audit(appointment, 'cancellation-completed', { reference: appointment.curemd.reference })
      log('cancellation-completed', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall
      })
      releaseSlot(appointment.locationId, appointment.startWall, appointment.serviceId, 'cancellation')
      return done({ appointment })
    },

    async markUnavailable(id, guard) {
      await settle(null, 300)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.status !== 'requested') return { ok: false, reason: 'not-allowed' }

      appointment.status = 'unavailable'
      appointment.curemd.status = 'not-required'
      appointment.proposal = null
      touch(appointment)
      audit(appointment, 'marked-unavailable')
      log('marked-unavailable', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall
      })
      return done({ appointment })
    },

    async proposeAlternative(id, slot, guard) {
      await settle(null, 320)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.status !== 'requested') return { ok: false, reason: 'not-allowed' }

      const others = {
        appointments: state.appointments.filter((item) => item.id !== id),
        offers: state.offers
      }
      if (!isSlotOpen(slot, others)) return { ok: false, reason: 'slot-taken' }

      appointment.proposal = {
        startWall: slot.startWall,
        locationId: slot.locationId,
        proposedAtWall: nowWall()
      }
      touch(appointment)
      audit(appointment, 'alternative-proposed', { detail: { offered: slot.startWall } })
      log('alternative-proposed', slot.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: slot.startWall,
        was: appointment.startWall
      })
      return done({ appointment })
    },

    async acceptProposal(id, guard) {
      await settle(null, 320)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (!appointment.proposal) return { ok: false, reason: 'not-allowed' }

      const was = appointment.startWall
      appointment.startWall = appointment.proposal.startWall
      appointment.locationId = appointment.proposal.locationId
      appointment.proposal = null
      touch(appointment)
      audit(appointment, 'alternative-accepted', { detail: { was, now: appointment.startWall } })
      log('alternative-accepted', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall,
        was
      })
      return done({ appointment })
    },

    async setAttendance(id, status, guard) {
      await settle(null, 220)
      reconcile()
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      if (appointment.status === status) return done({ appointment })
      if (appointment.status !== 'confirmed' && appointment.status !== 'arrived') {
        return { ok: false, reason: 'not-allowed' }
      }
      // Someone who has been seen cannot still be waiting on a CureMD change.
      if (status === 'completed' && appointment.curemd.status !== 'registered') {
        return { ok: false, reason: 'not-allowed' }
      }

      appointment.status = status
      touch(appointment)
      audit(appointment, 'note-added', { note: status })
      return done({ appointment })
    },

    async addNote(id, note, guard) {
      await settle(null, 200)
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      touch(appointment)
      audit(appointment, 'note-added', { note: note.trim().slice(0, 200) })
      return done({ appointment })
    },

    // --- waitlist -----------------------------------------------------------

    // --- once the patient is in the building ---------------------------------

    /**
     * Records that the patient walked in, and the room they were shown to, as one write.
     *
     * Two things it deliberately does **not** do. It never writes to the CureMD record: if
     * the registration is still outstanding it stays outstanding, and the interface warns
     * rather than quietly tidying up. And it only moves the appointment status to `arrived`
     * when the appointment is already confirmed — a request nobody has registered yet stays
     * a request, because "arrived" on an unregistered request claims more than is true.
     */
    async recordArrival(id, roomId, guard) {
      await settle(null, 240)
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      // Pressing twice must not produce two arrivals, so an existing visit simply wins.
      if (appointment.visit !== null) return done({ appointment })
      if (!canRecordArrival(appointment)) return { ok: false, reason: 'not-allowed' }

      if (roomId !== null) {
        const refusal = roomRefusal(roomId, appointment, state.appointments)
        if (refusal !== null) return { ok: false, reason: refusal }
      }

      const at = nowWall()
      appointment.visit = {
        arrivedAtWall: at,
        arrivedBy: DEMO_OPERATOR.name,
        stage: 'in-clinic',
        roomId,
        leftAtWall: null,
        printsRequested: 0,
        lastPrintAtWall: null
      }
      if (appointment.status === 'confirmed') appointment.status = 'arrived'

      touch(appointment)
      audit(appointment, 'arrival-recorded', {
        note: appointment.curemd.status === 'pending-registration' ? 'curemd-pending' : undefined
      })
      if (roomId !== null) {
        audit(appointment, 'room-assigned', { detail: { when: roomNameOf(roomId) } })
      }
      log('arrival-recorded', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: appointment.startWall
      })
      return done({ appointment })
    },

    /**
     * Puts right a room chosen by mistake. The room is picked once on arrival and kept for
     * the whole visit, so this is a correction, recorded as one — not a transfer.
     */
    async correctRoom(id, roomId, guard) {
      await settle(null, 200)
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      const visit = appointment.visit
      if (!visit || visit.stage !== 'in-clinic') return { ok: false, reason: 'not-allowed' }

      const was = visit.roomId
      if (was === roomId) return done({ appointment })

      if (roomId !== null) {
        const refusal = roomRefusal(roomId, appointment, state.appointments)
        if (refusal !== null) return { ok: false, reason: refusal }
      }

      visit.roomId = roomId
      touch(appointment)
      audit(appointment, 'room-corrected', {
        detail: { was: roomNameOf(was), when: roomNameOf(roomId) }
      })
      log('room-corrected', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment),
        when: roomNameOf(roomId)
      })
      return done({ appointment })
    },

    /**
     * Ends the visit: records when they left, gives the room back and moves them to the
     * finished list.
     *
     * The appointment is only completed where that stays coherent — a visit can finish
     * while the CureMD registration is still outstanding, and saying "completed" then would
     * claim something about CureMD that is not true. Nothing pending in CureMD is resolved
     * here, ever.
     */
    async finishVisit(id, guard) {
      await settle(null, 220)
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (stale(appointment, guard)) return { ok: false, reason: 'stale' }
      const visit = appointment.visit
      if (!visit) return { ok: false, reason: 'not-allowed' }
      if (visit.stage === 'finished') return done({ appointment })

      visit.stage = 'finished'
      visit.leftAtWall = nowWall()
      // The room is given back the moment the visit ends.
      visit.roomId = null

      if (
        appointment.curemd.status === 'registered' &&
        (appointment.status === 'arrived' || appointment.status === 'confirmed')
      ) {
        appointment.status = 'completed'
      }

      touch(appointment)
      audit(appointment, 'visit-finished')
      log('visit-finished', appointment.locationId, appointment.id, {
        patient: patientNameOf(appointment)
      })
      return done({ appointment })
    },

    /**
     * Notes that a slip was asked for. It is not a record that anything was printed — the
     * browser dialog can be cancelled, and this application has no way of knowing. It
     * changes no status, so reprinting is free.
     */
    async noteSlipRequested(id) {
      const appointment = find(id)
      if (!appointment) return { ok: false, reason: 'not-found' }
      if (!appointment.visit) return { ok: false, reason: 'not-allowed' }

      appointment.visit.printsRequested += 1
      appointment.visit.lastPrintAtWall = nowWall()
      audit(appointment, 'slip-print-requested', {
        detail: { count: appointment.visit.printsRequested }
      })
      return done({ appointment })
    },

    async joinWaitlist(input) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()

      const email = input.patient.email.trim().toLowerCase()
      const already = state.waitlist.some(
        (entry) =>
          entry.status !== 'withdrawn' &&
          entry.patient.email.trim().toLowerCase() === email &&
          entry.preferences.serviceId === input.preferences.serviceId
      )
      if (already) return { ok: false, reason: 'duplicate' }

      const entry: WaitlistEntry = {
        id: makeId('wl'),
        reference: makeReference(
          'WL',
          state.waitlist.map((item) => item.reference)
        ),
        patient: { ...input.patient, email: input.patient.email.trim() },
        preferences: { ...input.preferences },
        linkedAppointmentId: input.linkedAppointmentId ?? null,
        status: 'waiting',
        createdAtWall: nowWall()
      }
      state.waitlist = [...state.waitlist, entry]
      return done({ entry })
    },

    async updateWaitlistPreferences(id, preferences) {
      await settle(null, 280)
      const entry = state.waitlist.find((item) => item.id === id)
      if (!entry) return { ok: false, reason: 'not-found' }
      entry.preferences = { ...preferences }
      return done({ entry })
    },

    async withdrawFromWaitlist(id) {
      await settle(null, 280)
      const entry = state.waitlist.find((item) => item.id === id)
      if (!entry) return { ok: false, reason: 'not-found' }
      entry.status = 'withdrawn'
      for (const offer of state.offers) {
        if (offer.entryId === id && offer.status === 'pending') offer.status = 'withdrawn'
      }
      return done({ entry })
    },

    async candidatesForOpening(openingId) {
      reconcile()
      const opening = state.openings.find((item) => item.id === openingId)
      if (!opening || opening.status !== 'open') return settle([])
      if (!isSlotOpen(opening.slot, occupancy())) return settle([])
      return settle(
        candidatesForSlot(state.waitlist, opening.slot, { appointments: state.appointments })
      )
    },

    async offerOpening(openingId, entryId) {
      await settle(null, 380)
      reconcile()

      const opening = state.openings.find((item) => item.id === openingId)
      const entry = state.waitlist.find((item) => item.id === entryId)
      if (!opening || !entry) return { ok: false, reason: 'not-found' }
      if (opening.status !== 'open') return { ok: false, reason: 'offer-closed' }

      const live = state.offers.filter((offer) => offer.status === 'pending')
      if (live.some((offer) => offer.openingId === openingId)) {
        return { ok: false, reason: 'already-offered' }
      }
      if (live.some((offer) => offer.entryId === entryId)) {
        return { ok: false, reason: 'already-offered' }
      }

      // The time may have gone since the opening was recorded — taken at this clinic, or
      // taken at another one close enough that he could not get between the two.
      if (!isSlotOpen(opening.slot, { appointments: state.appointments, offers: state.offers })) {
        return { ok: false, reason: 'slot-taken' }
      }

      const matches = candidatesForSlot(state.waitlist, opening.slot, {
        appointments: state.appointments
      })
      if (!matches.some((candidate) => candidate.entry.id === entryId)) {
        return { ok: false, reason: 'no-match' }
      }

      const offer: Offer = {
        id: makeId('of'),
        entryId,
        openingId,
        slot: { ...opening.slot },
        status: 'pending',
        createdAtWall: nowWall(),
        holdUntilWall: addMinutesToWall(nowWall(), HOLD_MINUTES),
        appointmentId: null,
        replacedAppointmentId: null
      }
      state.offers = [offer, ...state.offers]
      entry.status = 'offered'
      log('offer-sent', offer.slot.locationId, null, {
        patient: `${entry.patient.firstName} ${entry.patient.lastName}`,
        service: offer.slot.serviceId,
        when: offer.slot.startWall
      })
      return done({ offer })
    },

    async respondToOffer(offerId, response) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()

      const offer = state.offers.find((item) => item.id === offerId)
      if (!offer) return { ok: false, reason: 'not-found' }
      if (offer.status !== 'pending') return { ok: false, reason: 'offer-closed' }

      const entry = state.waitlist.find((item) => item.id === offer.entryId)
      const who = entry ? `${entry.patient.firstName} ${entry.patient.lastName}` : undefined

      if (response !== 'accept') {
        offer.status = response === 'decline' ? 'declined' : 'expired'
        if (entry && entry.status === 'offered') entry.status = 'waiting'
        log(response === 'decline' ? 'offer-declined' : 'offer-expired', offer.slot.locationId, null, {
          patient: who,
          when: offer.slot.startWall
        })
        return done({ offer, appointment: null })
      }

      if (!entry) return { ok: false, reason: 'not-found' }

      const linked = entry.linkedAppointmentId ? find(entry.linkedAppointmentId) : undefined
      const linkedIsRegistered =
        linked && (linked.curemd.status === 'registered' || linked.curemd.status === 'change-pending')

      // An appointment that is about to move must not count against the time it is moving
      // to — it is vacating its own. One already in CureMD does count, because it stays
      // where it is until reception moves it there by hand.
      const vacating = linked && !linkedIsRegistered ? linked.id : null
      const others = {
        appointments: state.appointments.filter((item) => item.id !== vacating),
        offers: state.offers.filter((item) => item.id !== offerId)
      }
      if (!isSlotOpen(offer.slot, others)) return { ok: false, reason: 'slot-taken' }

      let appointment: Appointment

      if (linked && linkedIsRegistered) {
        // Accepting does not move anything on its own: it becomes a change for reception
        // to apply in CureMD, and the patient keeps the appointment they already have.
        linked.pendingChange = {
          startWall: offer.slot.startWall,
          locationId: offer.slot.locationId,
          requestedAtWall: nowWall(),
          source: 'waitlist',
          offerId: offer.id
        }
        linked.curemd.status = 'change-pending'
        touch(linked)
        audit(linked, 'change-requested', {
          detail: { was: linked.startWall, now: offer.slot.startWall }
        })
        offer.replacedAppointmentId = linked.id
        appointment = linked
      } else if (linked) {
        // Their existing booking is still only a request, so it simply moves.
        const was = linked.startWall
        linked.locationId = offer.slot.locationId
        linked.startWall = offer.slot.startWall
        touch(linked)
        audit(linked, 'change-requested', { detail: { was, now: offer.slot.startWall } })
        appointment = linked
      } else {
        // Nobody to move: the acceptance becomes a new request, like any other.
        appointment = newAppointment(offer.slot, offer.slot.serviceId, 'existing', entry.patient)
        audit(appointment, 'request-created', { note: 'waitlist' })
        state.appointments = [...state.appointments, appointment]
      }

      offer.status = 'accepted'
      offer.appointmentId = appointment.id
      entry.status = 'accepted'

      const opening = state.openings.find((item) => item.id === offer.openingId)
      if (opening) opening.status = 'filled'

      log('offer-accepted', offer.slot.locationId, appointment.id, {
        patient: who,
        service: offer.slot.serviceId,
        when: offer.slot.startWall
      })
      return done({ offer, appointment })
    },

    async dismissOpening(id) {
      await settle(null, 200)
      const opening = state.openings.find((item) => item.id === id)
      if (!opening) return { ok: false, reason: 'not-found' }
      opening.status = 'dismissed'
      return done({ opening })
    },

    // --- demo controls ------------------------------------------------------

    async loadScenario() {
      await settle(null, 380)
      const scripted = demoScenarioState()

      for (const appointment of scripted.appointments) {
        if (!appointment.id.startsWith('demo-scripted')) continue
        if (!state.appointments.some((item) => item.id === appointment.id)) {
          state.appointments = [...state.appointments, appointment]
        }
      }
      for (const entry of scripted.waitlist) {
        const existing = state.waitlist.find((item) => item.id === entry.id)
        if (!existing) state.waitlist = [...state.waitlist, entry]
        else if (existing.status === 'withdrawn') existing.status = 'waiting'
      }
      persist()
      return snapshot()
    },

    async reset() {
      state = demoScenarioState()
      persist()
      return settle(snapshot(), 120)
    }
  }
}

export const schedulingApi: SchedulingApi = createDemoSchedulingApi()

export { pendingTaskOf, effectiveStartWall }

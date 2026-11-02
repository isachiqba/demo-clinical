import { demoScenarioState, scenarioIds } from '@/data/demoScenario'
import { providersFor } from '@/data/providers'
import { serviceById } from '@/data/services'
import type {
  ActivityEvent,
  ActivityKind,
  Appointment,
  AppointmentStatus,
  DemoState,
  LocationId,
  Offer,
  Opening,
  PatientDetails,
  PatientType,
  ServiceId,
  Slot,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import { firstAvailable, isSlotOpen, slotCounts, slotsForDay } from './availability'
import { addMinutesToWall, instantToWall, isPastWall, nowWall, type DateKey } from './clinicTime'
import { STORAGE_KEYS, storage } from './storage'
import { candidatesForSlot, heldSlots, type Candidate } from './waitlist'

/**
 * The seam between the interface and "the back end".
 *
 * Everything the app knows about appointments, the waitlist, offers and activity goes
 * through this interface. The demo implementation keeps one state object in
 * sessionStorage and computes availability locally; swapping in a real API means writing
 * another object with the same shape and changing the single export at the bottom.
 */

export interface SlotSearch {
  serviceId: ServiceId
  locationId: LocationId | 'any'
  providerId: string | 'any'
}

export interface BookingInput extends SlotSearch {
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

export type Result<T> = ({ ok: true } & T) | { ok: false; reason: FailureReason }

export interface ProviderAvailability {
  providerId: string
  next: Slot | null
}

export type OfferResponse = 'accept' | 'decline' | 'expire'

export interface SchedulingApi {
  /** One read for the whole demo; the store keeps a reactive copy of it. */
  getState(): Promise<DemoState>
  listAppointments(): Promise<Appointment[]>
  getDaySlots(search: SlotSearch & { dateKey: DateKey }): Promise<Slot[]>
  getDayCounts(search: SlotSearch & { fromKey: DateKey; days: number }): Promise<Record<DateKey, number>>
  getFirstAvailable(search: SlotSearch & { fromKey: DateKey }): Promise<Slot | null>
  getProviderAvailability(
    search: Omit<SlotSearch, 'providerId'> & { fromKey: DateKey }
  ): Promise<ProviderAvailability[]>
  book(input: BookingInput): Promise<Result<{ appointment: Appointment }>>
  reschedule(id: string, slot: Slot): Promise<Result<{ appointment: Appointment }>>
  setStatus(id: string, status: AppointmentStatus): Promise<Result<{ appointment: Appointment }>>

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

/** Pretend network time, so loading states are visible in a demo. */
const LATENCY_MS = 220
const WRITE_LATENCY_MS = 600

/** How long an offer holds its slot before it lapses. */
export const HOLD_MINUTES = 15

export interface DemoApiOptions {
  /** Tests turn this off; the app leaves it on so spinners are real. */
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

/** Exported so tests can build an isolated instance with no artificial delay. */
export const createDemoSchedulingApi = (options: DemoApiOptions = {}): SchedulingApi => {
  const simulateLatency = options.simulateLatency ?? true

  const settle = <T>(value: T, ms = LATENCY_MS): Promise<T> => {
    if (!simulateLatency || ms === 0) return Promise.resolve(value)
    return new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(value), ms)
    })
  }

  let state: DemoState =
    storage.read<DemoState | null>(STORAGE_KEYS.demoState, null) ?? demoScenarioState()

  const persist = (): void => storage.write(STORAGE_KEYS.demoState, state)

  const snapshot = (): DemoState => ({
    appointments: state.appointments.map((item) => ({ ...item })),
    waitlist: state.waitlist.map((item) => ({ ...item })),
    offers: state.offers.map((item) => ({ ...item })),
    openings: state.openings.map((item) => ({ ...item })),
    activity: state.activity.map((item) => ({ ...item }))
  })

  const holds = (): Slot[] => heldSlots(state.offers, nowWall())

  const log = (
    kind: ActivityKind,
    locationId: LocationId | null,
    detail: ActivityEvent['detail']
  ): void => {
    const event: ActivityEvent = {
      id: makeId('ev'),
      kind,
      atWall: nowWall(),
      locationId,
      detail
    }
    // Newest first, and the feed is capped so a long session stays readable.
    state.activity = [event, ...state.activity].slice(0, 60)
  }

  const describe = (appointment: Appointment) => ({
    patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    service: appointment.serviceId,
    provider: appointment.providerId,
    when: appointment.startWall
  })

  const slotOf = (appointment: Appointment): Slot => ({
    id: `${appointment.providerId}|${appointment.locationId}|${appointment.startWall}`,
    serviceId: appointment.serviceId,
    providerId: appointment.providerId,
    locationId: appointment.locationId,
    startWall: appointment.startWall,
    durationMinutes: appointment.durationMinutes
  })

  /** Counts who the slot suits right now, ignoring nothing and inventing nothing. */
  const matchCount = (slot: Slot): number =>
    candidatesForSlot(state.waitlist, slot, {
      appointments: state.appointments,
      holds: holds()
    }).length

  /** Records a slot that has just come free, unless it is already in the past. */
  const openSlot = (appointment: Appointment, source: Opening['source']): Opening | null => {
    if (isPastWall(appointment.startWall)) return null
    const slot = slotOf(appointment)
    const opening: Opening = {
      id: makeId('op'),
      slot,
      source,
      createdAtWall: nowWall(),
      status: 'open'
    }
    state.openings = [opening, ...state.openings]
    log('opening-detected', slot.locationId, {
      service: slot.serviceId,
      provider: slot.providerId,
      when: slot.startWall,
      count: matchCount(slot)
    })
    return opening
  }

  /**
   * Lapsed offers are settled on the way in to every call, so a reload finds the state
   * it would have reached anyway: the hold released and the patient back on the list.
   */
  const reconcile = (): void => {
    const stamp = nowWall()
    let changed = false

    for (const offer of state.offers) {
      if (offer.status !== 'pending' || offer.holdUntilWall > stamp) continue
      offer.status = 'expired'
      changed = true
      const entry = state.waitlist.find((item) => item.id === offer.entryId)
      if (entry && entry.status === 'offered') entry.status = 'waiting'
      log('offer-expired', offer.slot.locationId, {
        patient: entry ? `${entry.patient.firstName} ${entry.patient.lastName}` : undefined,
        when: offer.slot.startWall
      })
    }

    if (changed) persist()
  }

  const find = (id: string): Appointment | undefined =>
    state.appointments.find((record) => record.id === id)

  const replace = (id: string, patch: Partial<Appointment>): Appointment | undefined => {
    let updated: Appointment | undefined
    state.appointments = state.appointments.map((record) => {
      if (record.id !== id) return record
      updated = { ...record, ...patch }
      return updated
    })
    return updated
  }

  const buildAppointment = (
    slot: Slot,
    patientType: PatientType,
    patient: PatientDetails
  ): Appointment => ({
    id: makeId('apt'),
    reference: makeReference(
      'LM',
      state.appointments.map((item) => item.reference)
    ),
    serviceId: slot.serviceId,
    providerId: slot.providerId,
    locationId: slot.locationId,
    startWall: slot.startWall,
    durationMinutes: serviceById(slot.serviceId)?.durationMinutes ?? slot.durationMinutes,
    patientType,
    patient: { ...patient, email: patient.email.trim() },
    status: 'confirmed',
    createdAtWall: instantToWall(new Date())
  })

  return {
    async getState() {
      reconcile()
      return settle(snapshot(), 0)
    },

    async listAppointments() {
      reconcile()
      return settle(
        state.appointments.map((item) => ({ ...item })),
        0
      )
    },

    async getDaySlots(search) {
      reconcile()
      return settle(slotsForDay({ ...search, appointments: state.appointments, holds: holds() }))
    },

    async getDayCounts(search) {
      reconcile()
      return settle(slotCounts({ ...search, appointments: state.appointments, holds: holds() }))
    },

    async getFirstAvailable(search) {
      reconcile()
      return settle(firstAvailable({ ...search, appointments: state.appointments, holds: holds() }))
    },

    async getProviderAvailability(search) {
      reconcile()
      const eligible = providersFor(
        search.serviceId,
        search.locationId === 'any' ? undefined : search.locationId
      )
      const result = eligible.map((provider) => ({
        providerId: provider.id,
        next: firstAvailable({
          serviceId: search.serviceId,
          locationId: search.locationId,
          providerId: provider.id,
          fromKey: search.fromKey,
          appointments: state.appointments,
          holds: holds()
        })
      }))
      return settle(result)
    },

    async book(input) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()

      // Re-check against live records: the slot may have gone, or be held for someone.
      if (!isSlotOpen(input.slot, state.appointments, holds())) {
        return { ok: false, reason: 'slot-taken' }
      }

      const duplicate = state.appointments.some(
        (record) =>
          record.status !== 'cancelled' &&
          record.startWall === input.slot.startWall &&
          record.providerId === input.slot.providerId &&
          record.patient.email.toLowerCase() === input.patient.email.trim().toLowerCase()
      )
      if (duplicate) return { ok: false, reason: 'duplicate' }

      const appointment = buildAppointment(input.slot, input.patientType, input.patient)
      state.appointments = [...state.appointments, appointment]
      persist()
      return { ok: true, appointment }
    },

    async reschedule(id, slot) {
      await settle(null, WRITE_LATENCY_MS)
      reconcile()
      const existing = find(id)
      if (!existing) return { ok: false, reason: 'not-found' }

      // Ignore the appointment being moved when checking whether the target is free.
      const others = state.appointments.filter((record) => record.id !== id)
      if (!isSlotOpen(slot, others, holds())) return { ok: false, reason: 'slot-taken' }

      const before = { ...existing }
      const updated = replace(id, {
        providerId: slot.providerId,
        locationId: slot.locationId,
        startWall: slot.startWall,
        durationMinutes: slot.durationMinutes,
        status: 'confirmed'
      })
      if (!updated) return { ok: false, reason: 'not-found' }

      log('appointment-rescheduled', updated.locationId, {
        ...describe(updated),
        when: updated.startWall
      })
      openSlot(before, 'reschedule')
      persist()
      return { ok: true, appointment: updated }
    },

    async setStatus(id, status) {
      await settle(null, 220)
      reconcile()
      const before = find(id)
      if (!before) return { ok: false, reason: 'not-found' }
      const wasActive = before.status !== 'cancelled'

      const updated = replace(id, { status })
      if (!updated) return { ok: false, reason: 'not-found' }

      if (status === 'cancelled' && wasActive) {
        log('appointment-cancelled', updated.locationId, describe(updated))
        openSlot(updated, 'cancellation')
      }

      persist()
      return { ok: true, appointment: updated }
    },

    // --- waitlist -----------------------------------------------------------

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
      persist()
      return { ok: true, entry }
    },

    async updateWaitlistPreferences(id, preferences) {
      await settle(null, 300)
      reconcile()
      const entry = state.waitlist.find((item) => item.id === id)
      if (!entry) return { ok: false, reason: 'not-found' }
      entry.preferences = { ...preferences }
      persist()
      return { ok: true, entry: { ...entry } }
    },

    async withdrawFromWaitlist(id) {
      await settle(null, 300)
      reconcile()
      const entry = state.waitlist.find((item) => item.id === id)
      if (!entry) return { ok: false, reason: 'not-found' }

      entry.status = 'withdrawn'
      // A pending offer to someone who has left is withdrawn with them.
      for (const offer of state.offers) {
        if (offer.entryId === id && offer.status === 'pending') offer.status = 'withdrawn'
      }
      persist()
      return { ok: true, entry: { ...entry } }
    },

    async candidatesForOpening(openingId) {
      reconcile()
      const opening = state.openings.find((item) => item.id === openingId)
      if (!opening || opening.status !== 'open') return settle([])
      return settle(
        candidatesForSlot(state.waitlist, opening.slot, {
          appointments: state.appointments,
          holds: holds()
        })
      )
    },

    async offerOpening(openingId, entryId) {
      await settle(null, 400)
      reconcile()

      const opening = state.openings.find((item) => item.id === openingId)
      const entry = state.waitlist.find((item) => item.id === entryId)
      if (!opening || !entry) return { ok: false, reason: 'not-found' }
      if (opening.status !== 'open') return { ok: false, reason: 'offer-closed' }

      // One live offer per opening and per patient: no silent double booking.
      const live = state.offers.filter((offer) => offer.status === 'pending')
      if (live.some((offer) => offer.openingId === openingId)) {
        return { ok: false, reason: 'already-offered' }
      }
      if (live.some((offer) => offer.entryId === entryId)) {
        return { ok: false, reason: 'already-offered' }
      }

      const matches = candidatesForSlot(state.waitlist, opening.slot, {
        appointments: state.appointments,
        holds: holds()
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

      log('offer-sent', offer.slot.locationId, {
        patient: `${entry.patient.firstName} ${entry.patient.lastName}`,
        service: offer.slot.serviceId,
        when: offer.slot.startWall
      })
      persist()
      return { ok: true, offer }
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
        log(response === 'decline' ? 'offer-declined' : 'offer-expired', offer.slot.locationId, {
          patient: who,
          when: offer.slot.startWall
        })
        persist()
        return { ok: true, offer: { ...offer }, appointment: null }
      }

      if (!entry) return { ok: false, reason: 'not-found' }

      // Checked again, ignoring this offer's own hold. Everything else in the demo
      // respects holds, so this should not fire — but if it ever does, the patient keeps
      // the appointment they already had rather than ending up with none.
      const otherHolds = heldSlots(
        state.offers.filter((item) => item.id !== offerId),
        nowWall()
      )
      if (!isSlotOpen(offer.slot, state.appointments, otherHolds)) {
        return { ok: false, reason: 'slot-taken' }
      }

      const linked = entry.linkedAppointmentId ? find(entry.linkedAppointmentId) : undefined

      // Build the new booking first. Only once it exists does the old one go, so a
      // failure here can never leave the patient with neither appointment.
      const appointment = buildAppointment(
        offer.slot,
        linked ? 'existing' : entry.patient.coverage === '' ? 'new' : 'existing',
        entry.patient
      )

      state.appointments = [...state.appointments, appointment]
      if (linked && linked.status !== 'cancelled') {
        replace(linked.id, { status: 'cancelled' })
        offer.replacedAppointmentId = linked.id
      }

      offer.status = 'accepted'
      offer.appointmentId = appointment.id
      entry.status = 'accepted'

      const opening = state.openings.find((item) => item.id === offer.openingId)
      if (opening) opening.status = 'filled'

      log('offer-accepted', offer.slot.locationId, {
        patient: who,
        service: offer.slot.serviceId,
        when: offer.slot.startWall
      })
      persist()
      return { ok: true, offer: { ...offer }, appointment }
    },

    async dismissOpening(id) {
      await settle(null, 220)
      reconcile()
      const opening = state.openings.find((item) => item.id === id)
      if (!opening) return { ok: false, reason: 'not-found' }
      opening.status = 'dismissed'
      persist()
      return { ok: true, opening: { ...opening } }
    },

    // --- demo controls ------------------------------------------------------

    /**
     * Puts the scripted pieces back without discarding anything made during the session:
     * the appointment to cancel and the three people waiting, if they are missing.
     */
    async loadScenario() {
      await settle(null, 400)
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

export { scenarioIds }

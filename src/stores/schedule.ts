import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  schedulingApi,
  type Guarded,
  type OfferResponse,
  type RegistrationInput,
  type RequestInput,
  type WaitlistInput
} from '@/services/schedulingApi'
import type {
  ActivityEvent,
  Appointment,
  AppointmentStatus,
  CuremdTask,
  DemoState,
  Offer,
  Opening,
  Slot,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import { dateKeyOf, nowWall } from '@/services/clinicTime'
import { pendingTaskOf } from '@/services/curemd'
import { candidatesForSlot } from '@/services/waitlist'
import { isFinished, isPresent } from '@/services/careFlow'

const emptyState = (): DemoState => ({
  appointments: [],
  waitlist: [],
  offers: [],
  openings: [],
  activity: []
})

/**
 * The one place the demo's data lives. The public site, the agenda, the CureMD inbox, the
 * waitlist and the overview all read and write through here, so a request made on the
 * website is at the front desk immediately and a cancellation declared there feeds back.
 */
export const useScheduleStore = defineStore('schedule', () => {
  const state = ref<DemoState>(emptyState())
  const ready = ref(false)
  const working = ref(false)

  const appointments = computed(() => state.value.appointments)
  const waitlist = computed(() => state.value.waitlist)
  const offers = computed(() => state.value.offers)
  const openings = computed(() => state.value.openings)
  const activity = computed<ActivityEvent[]>(() => state.value.activity)

  const refresh = async (): Promise<void> => {
    state.value = await schedulingApi.getState()
    ready.value = true
  }

  const ensureLoaded = async (): Promise<void> => {
    if (!ready.value) await refresh()
  }

  const byReference = (reference: string): Appointment | undefined =>
    appointments.value.find(
      (appointment) => appointment.reference.toLowerCase() === reference.toLowerCase()
    )

  const byId = (id: string): Appointment | undefined =>
    appointments.value.find((appointment) => appointment.id === id)

  const onDate = (dateKey: string): Appointment[] =>
    appointments.value
      .filter((appointment) => dateKeyOf(appointment.startWall) === dateKey)
      .sort((a, b) => a.startWall.localeCompare(b.startWall))

  const entryById = (id: string): WaitlistEntry | undefined =>
    waitlist.value.find((entry) => entry.id === id)

  /** Everything waiting on reception to do something by hand in CureMD. */
  const curemdQueue = computed(() =>
    appointments.value
      .map((appointment) => ({ appointment, task: pendingTaskOf(appointment) }))
      .filter((item): item is { appointment: Appointment; task: CuremdTask } => item.task !== null)
  )

  const taskCounts = computed(() => ({
    registration: curemdQueue.value.filter((item) => item.task === 'registration').length,
    change: curemdQueue.value.filter((item) => item.task === 'change').length,
    cancellation: curemdQueue.value.filter((item) => item.task === 'cancellation').length,
    total: curemdQueue.value.length
  }))

  const openOpenings = computed(() => openings.value.filter((opening) => opening.status === 'open'))
  const pendingOffers = computed(() => offers.value.filter((offer) => offer.status === 'pending'))

  const offerForOpening = (openingId: string): Offer | undefined =>
    pendingOffers.value.find((offer) => offer.openingId === openingId)

  /** How many people on the list a freed slot suits, from the live state. */
  const matchesForOpening = (opening: Opening): number =>
    candidatesForSlot(waitlist.value, opening.slot, { appointments: appointments.value }).length

  const totalMatches = computed(() =>
    openOpenings.value.reduce((total, opening) => total + matchesForOpening(opening), 0)
  )

  /** Wraps a write so the interface can disable controls and the cache stays in step. */
  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    working.value = true
    try {
      const result = await action()
      await refresh()
      return result
    } finally {
      working.value = false
    }
  }

  const requestAppointment = (input: RequestInput) =>
    run(() => schedulingApi.requestAppointment(input))

  const declareRegistration = (id: string, input: RegistrationInput) =>
    run(() => schedulingApi.declareRegistration(id, input))
  const confirmAppointment = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.confirmAppointment(id, guard))
  const requestChange = (
    id: string,
    slot: Pick<Slot, 'locationId' | 'startWall'>,
    guard?: Guarded & { source?: 'reception' | 'waitlist'; offerId?: string | null }
  ) => run(() => schedulingApi.requestChange(id, slot, guard))
  const declareChangeApplied = (id: string, guard?: Guarded & { curemdReference?: string | null }) =>
    run(() => schedulingApi.declareChangeApplied(id, guard))
  const abandonChange = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.abandonChange(id, guard))
  const requestCancellation = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.requestCancellation(id, guard))
  const declareCancellationDone = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.declareCancellationDone(id, guard))
  const markUnavailable = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.markUnavailable(id, guard))
  const proposeAlternative = (
    id: string,
    slot: Pick<Slot, 'locationId' | 'startWall'>,
    guard?: Guarded
  ) => run(() => schedulingApi.proposeAlternative(id, slot, guard))
  const acceptProposal = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.acceptProposal(id, guard))
  const setAttendance = (
    id: string,
    status: Extract<AppointmentStatus, 'arrived' | 'completed'>,
    guard?: Guarded
  ) => run(() => schedulingApi.setAttendance(id, status, guard))
  const addNote = (id: string, note: string, guard?: Guarded) =>
    run(() => schedulingApi.addNote(id, note, guard))

  // --- once the patient is in the building ---
  const recordArrival = (id: string, roomId: string | null, guard?: Guarded) =>
    run(() => schedulingApi.recordArrival(id, roomId, guard))
  const correctRoom = (id: string, roomId: string | null, guard?: Guarded) =>
    run(() => schedulingApi.correctRoom(id, roomId, guard))
  const finishVisit = (id: string, guard?: Guarded) =>
    run(() => schedulingApi.finishVisit(id, guard))
  const noteSlipRequested = (id: string) => run(() => schedulingApi.noteSlipRequested(id))

  /** Everyone currently in the building, earliest arrival first. */
  const inClinic = computed(() =>
    state.value.appointments
      .filter(isPresent)
      .sort((a, b) => a.visit!.arrivedAtWall.localeCompare(b.visit!.arrivedAtWall))
  )

  /** Visits that have been and gone, most recently finished first. */
  const finishedVisits = computed(() =>
    state.value.appointments
      .filter(isFinished)
      .sort((a, b) => (b.visit!.leftAtWall ?? '').localeCompare(a.visit!.leftAtWall ?? ''))
  )

  const joinWaitlist = (input: WaitlistInput) => run(() => schedulingApi.joinWaitlist(input))
  const withdrawFromWaitlist = (id: string) => run(() => schedulingApi.withdrawFromWaitlist(id))
  const updateWaitlistPreferences = (id: string, preferences: WaitlistPreferences) =>
    run(() => schedulingApi.updateWaitlistPreferences(id, preferences))

  const candidatesForOpening = (openingId: string) => schedulingApi.candidatesForOpening(openingId)
  const offerOpening = (openingId: string, entryId: string) =>
    run(() => schedulingApi.offerOpening(openingId, entryId))
  const respondToOffer = (offerId: string, response: OfferResponse) =>
    run(() => schedulingApi.respondToOffer(offerId, response))
  const dismissOpening = (id: string) => run(() => schedulingApi.dismissOpening(id))

  const loadScenario = () =>
    run(async () => {
      await schedulingApi.loadScenario()
    })
  const resetDemoData = () =>
    run(async () => {
      await schedulingApi.reset()
    })

  /** Minutes a CureMD task has been sitting in the inbox. */
  const taskAgeMinutes = (appointment: Appointment): number => {
    const task = pendingTaskOf(appointment)
    if (!task) return 0
    const since =
      task === 'registration'
        ? appointment.createdAtWall
        : task === 'change'
          ? (appointment.pendingChange?.requestedAtWall ?? appointment.createdAtWall)
          : (appointment.audit.find((entry) => entry.kind === 'cancellation-requested')?.atWall ??
            appointment.createdAtWall)
    const stamp = nowWall()
    return Math.max(0, Math.round((Date.parse(`${stamp}:00`) - Date.parse(`${since}:00`)) / 60000))
  }

  return {
    state,
    appointments,
    waitlist,
    offers,
    openings,
    activity,
    curemdQueue,
    taskCounts,
    openOpenings,
    pendingOffers,
    matchesForOpening,
    totalMatches,
    taskAgeMinutes,
    ready,
    working,
    refresh,
    ensureLoaded,
    byReference,
    byId,
    onDate,
    entryById,
    offerForOpening,
    requestAppointment,
    declareRegistration,
    confirmAppointment,
    requestChange,
    declareChangeApplied,
    abandonChange,
    requestCancellation,
    declareCancellationDone,
    markUnavailable,
    proposeAlternative,
    acceptProposal,
    setAttendance,
    addNote,
    inClinic,
    finishedVisits,
    recordArrival,
    correctRoom,
    finishVisit,
    noteSlipRequested,
    joinWaitlist,
    withdrawFromWaitlist,
    updateWaitlistPreferences,
    candidatesForOpening,
    offerOpening,
    respondToOffer,
    dismissOpening,
    loadScenario,
    resetDemoData
  }
})

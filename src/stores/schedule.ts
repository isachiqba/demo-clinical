import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { schedulingApi, type OfferResponse, type WaitlistInput } from '@/services/schedulingApi'
import type {
  ActivityEvent,
  Appointment,
  AppointmentStatus,
  DemoState,
  Offer,
  Opening,
  Slot,
  WaitlistEntry,
  WaitlistPreferences
} from '@/types'
import type { BookingInput } from '@/services/schedulingApi'
import { dateKeyOf, nowWall } from '@/services/clinicTime'
import { candidatesForSlot, heldSlots } from '@/services/waitlist'

const emptyState = (): DemoState => ({
  appointments: [],
  waitlist: [],
  offers: [],
  openings: [],
  activity: []
})

/**
 * The one place the demo's data lives. The public booking flow, the reception agenda, the
 * waitlist and the overview all read and write through here, so a booking made on the
 * website shows up at the front desk immediately and a cancellation there puts the slot
 * back on the website.
 */
export const useScheduleStore = defineStore('schedule', () => {
  const state = ref<DemoState>(emptyState())
  const ready = ref(false)
  const working = ref(false)

  const appointments = computed(() => state.value.appointments)
  const waitlist = computed(() => state.value.waitlist)
  const offers = computed(() => state.value.offers)
  const openings = computed(() => state.value.openings)
  const activity = computed(() => state.value.activity)

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

  const openOpenings = computed(() =>
    openings.value.filter((opening) => opening.status === 'open')
  )

  const pendingOffers = computed(() => offers.value.filter((offer) => offer.status === 'pending'))

  const offerForOpening = (openingId: string): Offer | undefined =>
    pendingOffers.value.find((offer) => offer.openingId === openingId)

  const offerForEntry = (entryId: string): Offer | undefined =>
    pendingOffers.value.find((offer) => offer.entryId === entryId)

  const recentActivity = computed<ActivityEvent[]>(() => activity.value)

  /** How many people on the list a freed slot suits, worked out from the live state. */
  const matchesForOpening = (opening: Opening): number =>
    candidatesForSlot(waitlist.value, opening.slot, {
      appointments: appointments.value,
      holds: heldSlots(offers.value, nowWall())
    }).length

  /** Everyone the open slots between them would suit. */
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

  const book = (input: BookingInput) => run(() => schedulingApi.book(input))
  const reschedule = (id: string, slot: Slot) => run(() => schedulingApi.reschedule(id, slot))
  const setStatus = (id: string, status: AppointmentStatus) =>
    run(() => schedulingApi.setStatus(id, status))
  const cancel = (id: string) => setStatus(id, 'cancelled')

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

  const totals = computed(() => ({
    all: appointments.value.length,
    active: appointments.value.filter((appointment) => appointment.status !== 'cancelled').length
  }))

  return {
    state,
    appointments,
    waitlist,
    offers,
    openings,
    activity: recentActivity,
    openOpenings,
    pendingOffers,
    matchesForOpening,
    totalMatches,
    ready,
    working,
    totals,
    refresh,
    ensureLoaded,
    byReference,
    byId,
    onDate,
    entryById,
    offerForOpening,
    offerForEntry,
    book,
    reschedule,
    setStatus,
    cancel,
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

export type { Opening, Offer, WaitlistEntry }

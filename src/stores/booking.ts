import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { isLocationId } from '@/data/locations'
import { isServiceId, serviceById } from '@/data/services'
import { todayKey } from '@/services/clinicTime'
import { STORAGE_KEYS, storage } from '@/services/storage'
import { BOOKING_STEPS } from '@/types'
import type {
  Appointment,
  BookingStep,
  Coverage,
  LocationChoice,
  PatientDetails,
  PatientType,
  ServiceId,
  Slot
} from '@/types'
import { useScheduleStore } from './schedule'

export interface BookingDraft {
  serviceId: ServiceId | null
  patientType: PatientType | null
  locationId: LocationChoice | null
  dateKey: string
  slot: Slot | null
  patient: PatientDetails
}

const emptyPatient = (): PatientDetails => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  coverage: ''
})

const emptyDraft = (): BookingDraft => ({
  serviceId: null,
  patientType: null,
  locationId: null,
  dateKey: todayKey(),
  slot: null,
  patient: emptyPatient()
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Restores a saved draft, dropping anything that is no longer a valid choice. */
const restoreDraft = (): BookingDraft => {
  // Versioned for the same reason the demo state is: a half-understood draft from an
  // older build is worse than no draft at all.
  const saved = storage.readVersioned<Partial<BookingDraft>>(STORAGE_KEYS.draft, {})
  const draft = { ...emptyDraft(), ...saved, patient: { ...emptyPatient(), ...saved.patient } }
  if (!isServiceId(draft.serviceId)) draft.serviceId = null
  if (draft.locationId !== 'any' && !isLocationId(draft.locationId)) draft.locationId = null
  return draft
}

export const useBookingStore = defineStore('booking', () => {
  const draft = ref<BookingDraft>(restoreDraft())
  const submitting = ref(false)
  const errorKey = ref<string | null>(null)
  const showErrors = ref(false)
  const lastConfirmed = ref<Appointment | null>(null)

  watch(draft, (value) => storage.writeVersioned(STORAGE_KEYS.draft, value), { deep: true })

  const service = computed(() => (draft.value.serviceId ? serviceById(draft.value.serviceId) : undefined))

  // --- validation ------------------------------------------------------------

  const fieldErrors = computed<Partial<Record<keyof PatientDetails, string>>>(() => {
    const patient = draft.value.patient
    const errors: Partial<Record<keyof PatientDetails, string>> = {}
    if (!patient.firstName.trim()) errors.firstName = 'booking.errors.firstName'
    if (!patient.lastName.trim()) errors.lastName = 'booking.errors.lastName'
    if (!patient.email.trim()) errors.email = 'booking.errors.emailMissing'
    else if (!EMAIL_PATTERN.test(patient.email.trim())) errors.email = 'booking.errors.emailInvalid'
    if (!patient.coverage) errors.coverage = 'booking.errors.coverage'
    return errors
  })

  const detailsValid = computed(() => Object.keys(fieldErrors.value).length === 0)

  const stepComplete = computed<Record<BookingStep, boolean>>(() => ({
    visit: Boolean(draft.value.serviceId && draft.value.patientType),
    place: Boolean(draft.value.locationId),
    when: Boolean(draft.value.slot),
    details: detailsValid.value
  }))

  const canEnter = (step: BookingStep): boolean => {
    const index = BOOKING_STEPS.indexOf(step)
    return BOOKING_STEPS.slice(0, index).every((earlier) => stepComplete.value[earlier])
  }

  /** The furthest step the current draft justifies, used to redirect deep links. */
  const furthestStep = computed<BookingStep>(() => {
    let last: BookingStep = BOOKING_STEPS[0]
    for (const step of BOOKING_STEPS) {
      if (!canEnter(step)) break
      last = step
    }
    return last
  })

  // --- selections ------------------------------------------------------------

  /** Any change above a chosen slot has to drop that slot: it may no longer exist. */
  const clearSlot = (): void => {
    draft.value.slot = null
  }

  const selectService = (serviceId: ServiceId): void => {
    if (draft.value.serviceId === serviceId) return
    draft.value.serviceId = serviceId
    clearSlot()
  }

  const selectPatientType = (patientType: PatientType): void => {
    draft.value.patientType = patientType
  }

  const selectLocation = (locationId: LocationChoice): void => {
    if (draft.value.locationId === locationId) return
    draft.value.locationId = locationId
    clearSlot()
  }

  const selectDate = (dateKey: string): void => {
    draft.value.dateKey = dateKey
  }

  const selectSlot = (slot: Slot | null): void => {
    draft.value.slot = slot
    if (slot) draft.value.dateKey = slot.startWall.slice(0, 10)
  }

  const updatePatient = (patch: Partial<PatientDetails>): void => {
    draft.value.patient = { ...draft.value.patient, ...patch }
  }

  const useSampleDetails = (): void => {
    draft.value.patient = {
      firstName: 'Sam',
      lastName: 'Rivera',
      email: 'sam.rivera@example.com',
      phone: '(555) 010-4477',
      coverage: 'insurance' as Coverage
    }
  }

  /** Pre-fills whatever a deep link knows, without inventing the rest. */
  const applyPreset = (preset: { serviceId?: unknown; locationId?: unknown }): void => {
    if (isServiceId(preset.serviceId)) selectService(preset.serviceId)
    if (preset.locationId === 'any' || isLocationId(preset.locationId)) {
      selectLocation(preset.locationId as LocationChoice)
    }
  }

  // --- submission ------------------------------------------------------------

  /** The public site never books: it asks the clinic for a time. */
  const submitRequest = async (): Promise<Appointment | null> => {
    if (submitting.value) return null
    const { serviceId, locationId, slot, patientType, patient } = draft.value
    if (!serviceId || !locationId || !slot || !patientType) return null
    if (!detailsValid.value) {
      showErrors.value = true
      return null
    }

    submitting.value = true
    errorKey.value = null
    try {
      const schedule = useScheduleStore()
      const result = await schedule.requestAppointment({
        serviceId,
        locationId,
        slot,
        patientType,
        patient: { ...patient, coverage: patient.coverage || 'self-pay' }
      })

      if (!result.ok) {
        errorKey.value =
          result.reason === 'duplicate' ? 'booking.errors.duplicate' : 'booking.errors.slotTaken'
        if (result.reason === 'slot-taken') clearSlot()
        return null
      }

      lastConfirmed.value = result.appointment
      return result.appointment
    } finally {
      submitting.value = false
    }
  }

  const reset = (): void => {
    draft.value = emptyDraft()
    errorKey.value = null
    showErrors.value = false
    storage.remove(STORAGE_KEYS.draft)
  }

  return {
    draft,
    service,
    submitting,
    errorKey,
    showErrors,
    lastConfirmed,
    fieldErrors,
    detailsValid,
    stepComplete,
    canEnter,
    furthestStep,
    selectService,
    selectPatientType,
    selectLocation,
    selectDate,
    selectSlot,
    updatePatient,
    useSampleDetails,
    applyPreset,
    submitRequest,
    reset
  }
})

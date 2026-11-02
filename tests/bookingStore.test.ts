import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBookingStore } from '@/stores/booking'
import { useScheduleStore } from '@/stores/schedule'
import { i18n, setLocale } from '@/i18n'
import { addDaysToKey, todayKey } from '@/services/clinicTime'
import { schedulingApi } from '@/services/schedulingApi'
import type { Slot } from '@/types'

const DAY = addDaysToKey(todayKey(), 10)

const aSlot = async (): Promise<Slot> => {
  const slots = await schedulingApi.getDaySlots({
    serviceId: 'primary-care',
    locationId: 'downtown',
    providerId: 'ap-elena-sandoval',
    dateKey: DAY
  })
  return slots[0]
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('booking draft', () => {
  it('gates each step on the one before it', () => {
    const booking = useBookingStore()
    expect(booking.canEnter('visit')).toBe(true)
    expect(booking.canEnter('place')).toBe(false)
    expect(booking.furthestStep).toBe('visit')

    booking.selectService('primary-care')
    expect(booking.canEnter('place')).toBe(false) // patient type still missing
    booking.selectPatientType('new')
    expect(booking.canEnter('place')).toBe(true)
    expect(booking.furthestStep).toBe('place')

    booking.selectLocation('downtown')
    booking.selectProvider('ap-elena-sandoval')
    expect(booking.canEnter('when')).toBe(true)
    expect(booking.canEnter('details')).toBe(false)
  })

  it('drops a chosen time when the appointment type changes', async () => {
    const booking = useBookingStore()
    booking.selectService('primary-care')
    booking.selectPatientType('existing')
    booking.selectLocation('downtown')
    booking.selectProvider('ap-elena-sandoval')
    booking.selectSlot(await aSlot())
    expect(booking.draft.slot).not.toBeNull()

    booking.selectService('annual-wellness')
    expect(booking.draft.slot).toBeNull()
  })

  it('drops a chosen time, and a clinician who does not work there, when the clinic changes', async () => {
    const booking = useBookingStore()
    booking.selectService('primary-care')
    booking.selectPatientType('existing')
    booking.selectLocation('downtown')
    booking.selectProvider('ap-elena-sandoval') // Downtown and Northside only
    booking.selectSlot(await aSlot())

    booking.selectLocation('westside')
    expect(booking.draft.slot).toBeNull()
    expect(booking.draft.providerId).toBeNull()
  })

  it('keeps a clinician who also works at the new clinic', () => {
    const booking = useBookingStore()
    booking.selectService('primary-care')
    booking.selectLocation('downtown')
    booking.selectProvider('ap-elena-sandoval')
    booking.selectLocation('northside')
    expect(booking.draft.providerId).toBe('ap-elena-sandoval')
  })

  it('validates the details field by field', () => {
    const booking = useBookingStore()
    expect(booking.detailsValid).toBe(false)
    expect(booking.fieldErrors.firstName).toBe('booking.errors.firstName')

    booking.updatePatient({ firstName: 'Sam', lastName: 'Rivera', coverage: 'insurance' })
    expect(booking.fieldErrors.email).toBe('booking.errors.emailMissing')

    booking.updatePatient({ email: 'not-an-email' })
    expect(booking.fieldErrors.email).toBe('booking.errors.emailInvalid')

    booking.updatePatient({ email: 'sam@example.com' })
    expect(booking.fieldErrors).toEqual({})
    expect(booking.detailsValid).toBe(true)
  })

  it('treats the phone number as optional', () => {
    const booking = useBookingStore()
    booking.useSampleDetails()
    expect(booking.detailsValid).toBe(true)
    booking.updatePatient({ phone: '' })
    expect(booking.detailsValid).toBe(true)
  })

  it('fills believable sample details', () => {
    const booking = useBookingStore()
    booking.useSampleDetails()
    expect(booking.draft.patient.email).toContain('@example.com')
    expect(booking.detailsValid).toBe(true)
  })

  it('confirms through the shared schedule, so reception sees it at once', async () => {
    const schedule = useScheduleStore()
    await schedule.refresh()
    const before = schedule.appointments.length

    const booking = useBookingStore()
    booking.selectService('primary-care')
    booking.selectPatientType('new')
    booking.selectLocation('downtown')
    booking.selectProvider('ap-elena-sandoval')
    booking.selectSlot(await aSlot())
    booking.useSampleDetails()

    const appointment = await booking.confirm()
    expect(appointment).not.toBeNull()
    expect(schedule.appointments.length).toBe(before + 1)
    expect(schedule.byReference(appointment!.reference)?.id).toBe(appointment!.id)
  })

  it('switching language leaves every selection alone', async () => {
    const booking = useBookingStore()
    booking.selectService('follow-up')
    booking.selectPatientType('existing')
    booking.selectLocation('northside')
    booking.selectProvider('any')
    booking.updatePatient({ firstName: 'Ada' })
    const before = JSON.parse(JSON.stringify(booking.draft))

    setLocale('es')
    expect(i18n.global.locale.value).toBe('es')
    expect(JSON.parse(JSON.stringify(booking.draft))).toEqual(before)

    setLocale('en')
    expect(JSON.parse(JSON.stringify(booking.draft))).toEqual(before)
  })

  it('applies a preset from a deep link without inventing the rest', () => {
    const booking = useBookingStore()
    booking.applyPreset({ serviceId: 'annual-wellness', locationId: 'any' })
    expect(booking.draft.serviceId).toBe('annual-wellness')
    expect(booking.draft.locationId).toBe('any')
    expect(booking.draft.patientType).toBeNull()
    expect(booking.furthestStep).toBe('visit')

    booking.applyPreset({ serviceId: 'nonsense', locationId: 'mars' })
    expect(booking.draft.serviceId).toBe('annual-wellness')
  })
})

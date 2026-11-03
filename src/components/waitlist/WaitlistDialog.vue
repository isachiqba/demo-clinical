<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import { addDaysToKey, todayKey } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Locale, LocationId, PatientDetails, ServiceId, TimeBand, WaitlistEntry } from '@/types'
import { TIME_BANDS } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Joining the waitlist from the public site. It asks only what the matching rules use,
 * and it is explicit that nothing is sent to anyone.
 */
const props = defineProps<{
  open: boolean
  preset: {
    serviceId: ServiceId | null
    locationId: LocationId | 'any' | null
    patient?: PatientDetails
    /** The booking this entry would replace, when the patient already has one. */
    linkedAppointmentId?: string | null
    /** Nothing later than this is of interest. */
    untilKey?: string
  }
}>()

const emit = defineEmits<{ close: []; joined: [entry: WaitlistEntry] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const serviceId = ref<ServiceId>('primary-care')
const clinicIds = ref<LocationId[]>([])
const fromKey = ref(todayKey())
const toKey = ref(addDaysToKey(todayKey(), 30))
const weekdays = ref<number[]>([1, 2, 3, 4, 5])
const bands = ref<TimeBand[]>([...TIME_BANDS])
const language = ref<Locale>('en')
const patient = ref<PatientDetails>({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  coverage: 'self-pay'
})

const submitting = ref(false)
const errorKey = ref<string | null>(null)
const showErrors = ref(false)

/** Fills the form from wherever the patient came in, each time it opens. */
watch(
  () => props.open,
  (open) => {
    if (!open) return
    errorKey.value = null
    showErrors.value = false

    serviceId.value = props.preset.serviceId ?? 'primary-care'
    clinicIds.value =
      props.preset.locationId && props.preset.locationId !== 'any'
        ? [props.preset.locationId]
        : locations.map((location) => location.id)
    fromKey.value = todayKey()
    toKey.value = props.preset.untilKey ?? addDaysToKey(todayKey(), 30)
    language.value = locale.value as Locale
    if (props.preset.patient) patient.value = { ...props.preset.patient }
  },
  { immediate: true }
)

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const fieldErrors = computed(() => {
  const errors: Record<string, string> = {}
  if (!clinicIds.value.length) errors.clinics = t('waitlist.pickClinic')
  if (!weekdays.value.length) errors.weekdays = t('waitlist.pickDay')
  if (!bands.value.length) errors.bands = t('waitlist.pickBand')
  if (!patient.value.firstName.trim()) errors.firstName = t('booking.errors.firstName')
  if (!patient.value.lastName.trim()) errors.lastName = t('booking.errors.lastName')
  if (!patient.value.email.trim()) errors.email = t('booking.errors.emailMissing')
  else if (!EMAIL_PATTERN.test(patient.value.email.trim())) {
    errors.email = t('booking.errors.emailInvalid')
  }
  return errors
})

const errorFor = (field: string): string | undefined =>
  showErrors.value ? fieldErrors.value[field] : undefined

const valid = computed(() => Object.keys(fieldErrors.value).length === 0)

const useSample = (): void => {
  patient.value = {
    firstName: 'Sam',
    lastName: 'Rivera',
    email: 'sam.rivera@example.com',
    phone: '(555) 010-4477',
    coverage: 'self-pay'
  }
}

const submit = async (): Promise<void> => {
  if (!valid.value) {
    showErrors.value = true
    return
  }
  submitting.value = true
  errorKey.value = null
  try {
    const result = await schedule.joinWaitlist({
      patient: { ...patient.value },
      preferences: {
        serviceId: serviceId.value,
        locationIds: [...clinicIds.value],
        fromKey: fromKey.value,
        toKey: toKey.value,
        weekdays: [...weekdays.value].sort(),
        bands: TIME_BANDS.filter((band) => bands.value.includes(band)),
        language: language.value
      },
      linkedAppointmentId: props.preset.linkedAppointmentId ?? null
    })
    if (!result.ok) {
      errorKey.value = result.reason === 'duplicate' ? 'waitlist.duplicate' : 'booking.errors.slotTaken'
      return
    }
    emit('joined', result.entry)
  } finally {
    submitting.value = false
  }
}

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
const lede = computed(() =>
  props.preset.linkedAppointmentId ? t('waitlist.linkedLede') : t('waitlist.lede')
)
</script>

<template>
  <AppDialog
    :open="open"
    :title="t('waitlist.title')"
    :close-label="t('common.close')"
    @close="emit('close')"
  >
    <p class="lede-sm">{{ lede }}</p>

    <p class="simulated">
      <AppIcon name="info" :size="17" />
      <span>{{ t('waitlist.simulated') }}</span>
    </p>

    <form class="form" novalidate @submit.prevent="submit">
      <AppField v-slot="{ id }" :label="t('waitlist.service')">
        <select :id="id" v-model="serviceId">
          <option v-for="service in services" :key="service.id" :value="service.id">
            {{ localized(service.name) }}
          </option>
        </select>
      </AppField>

      <fieldset class="group">
        <legend class="group__legend">{{ t('waitlist.clinics') }}</legend>
        <div class="chips">
          <button
            v-for="location in locations"
            :key="location.id"
            class="chip"
            type="button"
            :class="{ 'chip--on': clinicIds.includes(location.id) }"
            :aria-pressed="clinicIds.includes(location.id)"
            @click="clinicIds = toggle(clinicIds, location.id)"
          >
            {{ localized(location.name) }}
          </button>
        </div>
        <p v-if="errorFor('clinics')" class="group__error">{{ errorFor('clinics') }}</p>
      </fieldset>

      <fieldset class="group">
        <legend class="group__legend">{{ t('waitlist.dates') }}</legend>
        <div class="dates">
          <label class="dates__field">
            <span>{{ t('waitlist.from') }}</span>
            <input v-model="fromKey" type="date" :min="todayKey()" />
          </label>
          <label class="dates__field">
            <span>{{ t('waitlist.to') }}</span>
            <input v-model="toKey" type="date" :min="fromKey" />
          </label>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend class="group__legend">{{ t('waitlist.weekdays') }}</legend>
        <div class="chips">
          <button
            v-for="day in weekdayOrder"
            :key="day"
            class="chip chip--tight"
            type="button"
            :class="{ 'chip--on': weekdays.includes(day) }"
            :aria-pressed="weekdays.includes(day)"
            @click="weekdays = toggle(weekdays, day)"
          >
            {{ t(`waitlist.weekdayShort.${day}`) }}
          </button>
        </div>
        <p v-if="errorFor('weekdays')" class="group__error">{{ errorFor('weekdays') }}</p>
      </fieldset>

      <fieldset class="group">
        <legend class="group__legend">{{ t('waitlist.bands') }}</legend>
        <div class="chips">
          <button
            v-for="band in TIME_BANDS"
            :key="band"
            class="chip"
            type="button"
            :class="{ 'chip--on': bands.includes(band) }"
            :aria-pressed="bands.includes(band)"
            @click="bands = toggle(bands, band)"
          >
            {{ t(`waitlist.bands_.${band}`) }}
          </button>
        </div>
        <p v-if="errorFor('bands')" class="group__error">{{ errorFor('bands') }}</p>
      </fieldset>

      <AppField v-slot="{ id }" :label="t('waitlist.language')">
        <select :id="id" v-model="language">
          <option value="en">{{ t('language.en') }}</option>
          <option value="es">{{ t('language.es') }}</option>
        </select>
      </AppField>

      <fieldset class="group">
        <legend class="group__legend">{{ t('waitlist.patient') }}</legend>
        <AppButton class="group__sample" size="sm" variant="secondary" @click="useSample">
          {{ t('waitlist.sample') }}
        </AppButton>

        <div class="pair">
          <AppField
            v-slot="{ id }"
            :label="t('booking.details.firstName')"
            :error="errorFor('firstName')"
            required
          >
            <input :id="id" v-model="patient.firstName" type="text" autocomplete="given-name" />
          </AppField>
          <AppField
            v-slot="{ id }"
            :label="t('booking.details.lastName')"
            :error="errorFor('lastName')"
            required
          >
            <input :id="id" v-model="patient.lastName" type="text" autocomplete="family-name" />
          </AppField>
        </div>

        <div class="pair">
          <AppField
            v-slot="{ id }"
            :label="t('booking.details.email')"
            :error="errorFor('email')"
            required
          >
            <input :id="id" v-model="patient.email" type="email" autocomplete="email" />
          </AppField>
          <AppField
            v-slot="{ id }"
            :label="t('booking.details.phone')"
            :optional-label="t('common.optional')"
          >
            <input :id="id" v-model="patient.phone" type="tel" autocomplete="tel" />
          </AppField>
        </div>
      </fieldset>

      <p v-if="errorKey" class="form__error" role="alert">
        <AppIcon name="alert-circle" :size="17" />
        <span>{{ t(errorKey) }}</span>
      </p>
    </form>

    <template #actions>
      <AppButton :loading="submitting" icon-right="check" @click="submit">
        {{ submitting ? t('waitlist.submitting') : t('waitlist.submit') }}
      </AppButton>
      <AppButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.lede-sm {
  font-size: var(--text-sm);
  line-height: 1.55;
}

.simulated {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
  margin-top: var(--s5);
}

.group {
  border: none;
  padding: 0;
  margin: 0;
}

.group__legend {
  padding: 0;
  margin-bottom: var(--s3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.group__error {
  margin-top: var(--s2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--critical-fg);
}

.group__sample {
  margin-bottom: var(--s4);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.chip {
  min-height: 38px;
  padding-inline: var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--navy-600);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.14s var(--ease), background-color 0.14s var(--ease), color 0.14s var(--ease);
}

.chip--tight {
  padding-inline: var(--s3);
  min-width: 52px;
}

.chip:hover {
  border-color: var(--teal-500);
  color: var(--teal-700);
}

.chip.chip--on,
.chip.chip--on:hover {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}

.dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}

.dates__field {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.dates__field input {
  min-height: var(--tap);
  padding: var(--s2) var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-800);
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
  align-items: stretch;
}

.pair + .pair {
  margin-top: var(--s4);
}

.form__error {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--critical-bg);
  color: var(--critical-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

@media (max-width: 520px) {
  .pair,
  .dates {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime, zoneAbbreviation } from '@/services/clinicTime'
import { useBookingStore } from '@/stores/booking'
import type { BookingStep, PatientDetails } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import OptionCard from '@/components/ui/OptionCard.vue'

const { t, locale } = useI18n()
const booking = useBookingStore()
const emit = defineEmits<{ edit: [step: BookingStep] }>()

/** Errors appear once a field has been left, or once confirm has been attempted. */
const touched = ref<Partial<Record<keyof PatientDetails, boolean>>>({})
const sampleFilled = ref(false)

const errorFor = (field: keyof PatientDetails): string | undefined => {
  const key = booking.fieldErrors[field]
  if (!key) return undefined
  return touched.value[field] || booking.showErrors ? t(key) : undefined
}

const touch = (field: keyof PatientDetails): void => {
  touched.value = { ...touched.value, [field]: true }
}

const fillSample = (): void => {
  booking.useSampleDetails()
  touched.value = {}
  sampleFilled.value = true
  window.setTimeout(() => (sampleFilled.value = false), 4000)
}

const slot = computed(() => booking.draft.slot)

const summary = computed(() => {
  const current = slot.value
  if (!current) return []
  return [
    {
      key: 'service',
      label: t('confirmation.appointment'),
      value: `${localized(booking.service?.name)} · ${t('common.minutes', { count: current.durationMinutes })}`,
      step: 'visit' as BookingStep
    },
    {
      key: 'clinician',
      label: t('confirmation.clinician'),
      value: providerById(current.providerId)?.name ?? '',
      step: 'place' as BookingStep
    },
    {
      key: 'clinic',
      label: t('confirmation.clinic'),
      value: localized(locationById(current.locationId)?.name),
      step: 'place' as BookingStep
    },
    {
      key: 'when',
      label: t('confirmation.when'),
      value: `${formatWallDate(current.startWall, locale.value)}, ${formatWallTime(current.startWall, locale.value)} (${zoneAbbreviation(current.startWall)})`,
      step: 'when' as BookingStep
    }
  ]
})
</script>

<template>
  <section>
    <h1 class="step__title">{{ t('booking.details.title') }}</h1>
    <p class="step__lede">{{ t('booking.details.lede') }}</p>

    <div class="notice">
      <AppIcon name="alert-circle" :size="18" />
      <div class="notice__text">
        <p>{{ t('booking.details.fictionalNotice') }}</p>
        <AppButton size="sm" variant="secondary" @click="fillSample">
          {{ t('booking.details.sample') }}
        </AppButton>
        <p v-if="sampleFilled" class="notice__done" role="status">
          {{ t('booking.details.sampleDone') }}
        </p>
      </div>
    </div>

    <form class="form" novalidate @submit.prevent>
      <div class="form__row">
        <AppField
          v-slot="{ id, describedBy }"
          :label="t('booking.details.firstName')"
          :error="errorFor('firstName')"
          required
        >
          <input
            :id="id"
            :value="booking.draft.patient.firstName"
            type="text"
            autocomplete="given-name"
            :aria-describedby="describedBy"
            :aria-invalid="Boolean(errorFor('firstName'))"
            @input="booking.updatePatient({ firstName: ($event.target as HTMLInputElement).value })"
            @blur="touch('firstName')"
          />
        </AppField>

        <AppField
          v-slot="{ id, describedBy }"
          :label="t('booking.details.lastName')"
          :error="errorFor('lastName')"
          required
        >
          <input
            :id="id"
            :value="booking.draft.patient.lastName"
            type="text"
            autocomplete="family-name"
            :aria-describedby="describedBy"
            :aria-invalid="Boolean(errorFor('lastName'))"
            @input="booking.updatePatient({ lastName: ($event.target as HTMLInputElement).value })"
            @blur="touch('lastName')"
          />
        </AppField>
      </div>

      <div class="form__row">
        <AppField
          v-slot="{ id, describedBy }"
          :label="t('booking.details.email')"
          :hint="t('booking.details.emailHint')"
          :error="errorFor('email')"
          required
        >
          <input
            :id="id"
            :value="booking.draft.patient.email"
            type="email"
            inputmode="email"
            autocomplete="email"
            :aria-describedby="describedBy"
            :aria-invalid="Boolean(errorFor('email'))"
            @input="booking.updatePatient({ email: ($event.target as HTMLInputElement).value })"
            @blur="touch('email')"
          />
        </AppField>

        <AppField
          v-slot="{ id, describedBy }"
          :label="t('booking.details.phone')"
          :hint="t('booking.details.phoneHint')"
          :optional-label="t('common.optional')"
        >
          <input
            :id="id"
            :value="booking.draft.patient.phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            :aria-describedby="describedBy"
            @input="booking.updatePatient({ phone: ($event.target as HTMLInputElement).value })"
          />
        </AppField>
      </div>

      <fieldset class="coverage">
        <legend class="coverage__legend">
          {{ t('booking.details.coverage') }}
        </legend>
        <div class="coverage__grid">
          <OptionCard
            name="coverage"
            :title="t('booking.details.insurance')"
            :description="t('booking.details.insuranceHelp')"
            :selected="booking.draft.patient.coverage === 'insurance'"
            compact
            @select="booking.updatePatient({ coverage: 'insurance' })"
          />
          <OptionCard
            name="coverage"
            :title="t('booking.details.selfPay')"
            :description="t('booking.details.selfPayHelp')"
            :selected="booking.draft.patient.coverage === 'self-pay'"
            compact
            @select="booking.updatePatient({ coverage: 'self-pay' })"
          />
        </div>
        <p v-if="errorFor('coverage')" class="coverage__error">{{ errorFor('coverage') }}</p>
        <p class="coverage__note">{{ t('booking.details.noPolicy') }}</p>
      </fieldset>
    </form>

    <section v-if="slot" class="review">
      <h2 class="review__title">{{ t('booking.details.review') }}</h2>
      <dl class="review__list">
        <div v-for="row in summary" :key="row.key" class="review__row">
          <div>
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
          <button class="review__edit" type="button" @click="emit('edit', row.step)">
            {{ t('common.change') }}
          </button>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.step__title {
  font-size: var(--text-3xl);
}

.step__lede {
  margin-top: var(--s3);
  max-width: 54ch;
  color: var(--navy-600);
}

.notice {
  display: flex;
  gap: var(--s3);
  margin-top: var(--s6);
  padding: var(--s4) var(--s5);
  border: 1px solid var(--caution-bg);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
}

.notice svg {
  margin-top: 3px;
}

.notice__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s3);
  font-size: var(--text-sm);
  line-height: 1.55;
}

.notice__done {
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
  margin-top: var(--s6);
}

.form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s4);
  align-items: stretch;
}

.coverage {
  border: none;
  padding: 0;
  margin: 0;
}

.coverage__legend {
  padding: 0;
  margin-bottom: var(--s3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.coverage__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}

.coverage__error {
  margin-top: var(--s2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--critical-fg);
}

.coverage__note {
  margin-top: var(--s3);
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.review {
  margin-top: var(--s7);
  padding: var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.review__title {
  font-size: var(--text-xl);
  margin-bottom: var(--s2);
}

.review__list {
  margin: 0;
}

.review__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  padding-block: var(--s4);
  border-bottom: 1px solid var(--border);
}

.review__row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.review__row dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.review__row dd {
  margin: 2px 0 0;
  font-weight: 500;
  color: var(--navy-800);
}

.review__edit {
  flex: none;
  min-height: 36px;
  padding-inline: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-600);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.16s var(--ease), color 0.16s var(--ease), background-color 0.16s var(--ease);
}

.review__edit:hover {
  border-color: var(--teal-500);
  color: var(--teal-700);
  background: var(--teal-50);
}

@media (max-width: 720px) {
  .form__row,
  .coverage__grid {
    grid-template-columns: 1fr;
  }
}
</style>

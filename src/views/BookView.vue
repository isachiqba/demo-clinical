<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { providerById } from '@/data/providers'
import { useBookingStore } from '@/stores/booking'
import { useScheduleStore } from '@/stores/schedule'
import { BOOKING_STEPS } from '@/types'
import type { BookingStep } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BookingProgress from '@/components/booking/BookingProgress.vue'
import BookingSummary from '@/components/booking/BookingSummary.vue'
import StepVisit from '@/components/booking/StepVisit.vue'
import StepPlace from '@/components/booking/StepPlace.vue'
import StepWhen from '@/components/booking/StepWhen.vue'
import StepDetails from '@/components/booking/StepDetails.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const booking = useBookingStore()
const schedule = useScheduleStore()

const stepViews = {
  visit: StepVisit,
  place: StepPlace,
  when: StepWhen,
  details: StepDetails
} as const

const current = computed<BookingStep>(() => (route.params.step as BookingStep) ?? 'visit')
const index = computed(() => BOOKING_STEPS.indexOf(current.value))
const isLast = computed(() => index.value === BOOKING_STEPS.length - 1)

/**
 * Deep links from the website carry what the visitor already chose. A clinician link
 * also implies a clinic, since a clinician only works at some of them.
 */
const applyQuery = (): void => {
  const { service, location, provider } = route.query
  if (!service && !location && !provider) return

  booking.applyPreset({ serviceId: service, locationId: location })

  if (typeof provider === 'string') {
    const match = providerById(provider)
    if (match) {
      if (!booking.draft.serviceId) booking.selectService(match.serviceIds[0])
      if (!booking.draft.locationId) booking.selectLocation(match.locationIds[0])
      booking.selectProvider(match.id)
    }
  }

  void router.replace({ name: 'book', params: { step: booking.furthestStep } })
}

onMounted(() => {
  void schedule.ensureLoaded()
  applyQuery()
})

watch(() => route.query, applyQuery)

const canAdvance = computed(() => booking.stepComplete[current.value])

const go = (step: BookingStep): void => {
  void router.push({ name: 'book', params: { step } })
}

const next = (): void => {
  const upcoming = BOOKING_STEPS[index.value + 1]
  if (upcoming) go(upcoming)
}

const back = (): void => {
  const previous = BOOKING_STEPS[index.value - 1]
  if (previous) go(previous)
  else void router.push({ name: 'home' })
}

const confirm = async (): Promise<void> => {
  const appointment = await booking.confirm()
  if (!appointment) {
    // A lost slot sends the patient back to the calendar; a field problem stays put.
    if (booking.errorKey === 'booking.errors.slotTaken') go('when')
    return
  }
  booking.reset()
  void router.push({ name: 'confirmation', params: { reference: appointment.reference } })
}

const attemptConfirm = (): void => {
  if (!booking.detailsValid) {
    booking.showErrors = true
    // Send the keyboard to the first field that needs fixing, not to the error summary.
    void nextTick(() => {
      const target = document.querySelector<HTMLElement>('.book__main [aria-invalid="true"]')
      target?.focus()
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return
  }
  void confirm()
}

const liveError = computed(() => (booking.errorKey ? t(booking.errorKey) : ''))
const showFieldWarning = computed(
  () => isLast.value && booking.showErrors && !booking.detailsValid
)

const reachable = (step: BookingStep): boolean => booking.canEnter(step)
</script>

<template>
  <div class="book">
    <div class="page-width book__grid">
      <div class="book__main">
        <BookingProgress :current="current" :reachable="reachable" @go="go" />

        <div class="book__panel">
          <Transition name="step" mode="out-in">
            <component :is="stepViews[current]" :key="current" @edit="go" />
          </Transition>
        </div>

        <p v-if="liveError" class="book__error" role="alert">
          <AppIcon name="alert-circle" :size="18" />
          <span>{{ liveError }}</span>
        </p>
        <p v-else-if="showFieldWarning" class="book__error" role="alert">
          <AppIcon name="alert-circle" :size="18" />
          <span>{{ t('booking.errors.fixFields') }}</span>
        </p>

        <nav class="book__nav" :aria-label="t('booking.title')">
          <AppButton variant="quiet" icon-left="arrow-left" @click="back">
            {{ t('common.back') }}
          </AppButton>

          <AppButton
            v-if="!isLast"
            size="lg"
            icon-right="arrow-right"
            :disabled="!canAdvance"
            @click="next"
          >
            {{ t('common.continue') }}
          </AppButton>

          <AppButton
            v-else
            size="lg"
            icon-right="check"
            :loading="booking.submitting"
            @click="attemptConfirm"
          >
            {{ booking.submitting ? t('booking.details.confirming') : t('booking.details.confirm') }}
          </AppButton>
        </nav>

        <p v-if="!canAdvance && !isLast" class="book__hint">{{ t('booking.errors.pickOne') }}</p>
      </div>

      <BookingSummary class="book__aside" />
    </div>
  </div>
</template>

<style scoped>
.book {
  padding-block: var(--s7) var(--s9);
  background: var(--paper);
}

.book__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--s7);
  align-items: start;
}

.book__panel {
  margin-top: var(--s6);
}

.book__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin-top: var(--s7);
  padding-top: var(--s5);
  border-top: 1px solid var(--border);
}

.book__error {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  margin-top: var(--s6);
  padding: var(--s4);
  border-radius: var(--radius-sm);
  background: var(--critical-bg);
  color: var(--critical-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.book__error svg {
  margin-top: 2px;
}

.book__hint {
  margin-top: var(--s3);
  font-size: var(--text-xs);
  color: var(--text-soft);
  text-align: right;
}

.step-enter-active,
.step-leave-active {
  transition: opacity 0.14s var(--ease);
}

.step-enter-from,
.step-leave-to {
  opacity: 0;
}

@media (max-width: 1040px) {
  .book__grid {
    grid-template-columns: 1fr;
    gap: var(--s6);
  }

  .book__aside {
    order: -1;
  }
}

@media (max-width: 560px) {
  .book {
    padding-block: var(--s5) var(--s8);
  }

  .book__nav {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .book__hint {
    text-align: center;
  }
}
</style>

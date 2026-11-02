<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { localized } from '@/i18n'
import {
  addDaysToKey,
  daysBetweenKeys,
  formatWallDate,
  formatWallTime,
  todayKey,
  zoneAbbreviation
} from '@/services/clinicTime'
import { schedulingApi } from '@/services/schedulingApi'
import { useBookingStore } from '@/stores/booking'
import type { Slot } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import WaitlistDialog from '@/components/waitlist/WaitlistDialog.vue'
import MonthCalendar from './MonthCalendar.vue'
import SlotList from './SlotList.vue'

const { t, locale } = useI18n()
const booking = useBookingStore()

const monthKey = ref(`${booking.draft.dateKey.slice(0, 8)}01`)
const counts = ref<Record<string, number>>({})
const daySlots = ref<Slot[]>([])
const loadingMonth = ref(false)
const loadingDay = ref(false)
const nextOpening = ref<Slot | null>(null)
/** The soonest opening for the current search, used to judge how hard the wait is. */
const earliest = ref<Slot | null>(null)

const search = computed(() => ({
  serviceId: booking.draft.serviceId!,
  locationId: booking.draft.locationId!,
  providerId: booking.draft.providerId!
}))

const ready = computed(() =>
  Boolean(booking.draft.serviceId && booking.draft.locationId && booking.draft.providerId)
)

const daysInMonth = (key: string): number => {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const loadMonth = async (): Promise<void> => {
  if (!ready.value) return
  loadingMonth.value = true
  counts.value = await schedulingApi.getDayCounts({
    ...search.value,
    fromKey: monthKey.value,
    days: daysInMonth(monthKey.value)
  })
  loadingMonth.value = false
}

const loadDay = async (): Promise<void> => {
  if (!ready.value) return
  loadingDay.value = true
  daySlots.value = await schedulingApi.getDaySlots({
    ...search.value,
    dateKey: booking.draft.dateKey
  })
  loadingDay.value = false

  if (daySlots.value.length === 0) {
    nextOpening.value = await schedulingApi.getFirstAvailable({
      ...search.value,
      fromKey: booking.draft.dateKey
    })
  } else {
    nextOpening.value = null
  }
}

const loadEarliest = async (): Promise<void> => {
  if (!ready.value) return
  earliest.value = await schedulingApi.getFirstAvailable({ ...search.value, fromKey: todayKey() })
}

const reload = async (): Promise<void> => {
  await Promise.all([loadMonth(), loadDay(), loadEarliest()])
}

onMounted(reload)

watch(
  () => [booking.draft.serviceId, booking.draft.locationId, booking.draft.providerId],
  () => void reload()
)

watch(monthKey, () => void loadMonth())
watch(() => booking.draft.dateKey, () => void loadDay())

const onSelectDate = (dateKey: string): void => {
  booking.selectDate(dateKey)
}

const onSelectMonth = (key: string): void => {
  monthKey.value = key
}

/** Jump the calendar and the day list to the first genuinely free time. */
const goToNextOpening = (): void => {
  const slot = nextOpening.value
  if (!slot) return
  const key = slot.startWall.slice(0, 10)
  monthKey.value = `${key.slice(0, 8)}01`
  booking.selectDate(key)
}

const allowAnyProvider = (): void => booking.selectProvider('any')
const allowAnyLocation = (): void => booking.selectLocation('any')

/**
 * How far away the soonest appointment is. A wait of a week or more is the moment a
 * patient gives up and goes elsewhere, so that is when the waitlist is worth saying out
 * loud; otherwise it stays a quiet line under the times.
 */
const daysToEarliest = computed(() =>
  earliest.value ? daysBetweenKeys(todayKey(), earliest.value.startWall.slice(0, 10)) : null
)

const waitIsLong = computed(() => (daysToEarliest.value ?? 0) >= 7)

const waitNote = computed(() => {
  const days = daysToEarliest.value
  if (days === null) return ''
  if (days <= 1) return t('waitlist.farPromptTomorrow')
  return t('waitlist.farPrompt', { days })
})

const waitlistOpen = ref(false)
const joinedReference = ref<string | null>(null)

const waitlistPreset = computed(() => ({
  serviceId: booking.draft.serviceId,
  locationId: booking.draft.locationId,
  providerId: booking.draft.providerId
}))

const providerName = computed(() =>
  booking.draft.providerId === 'any'
    ? t('booking.when.firstAvailableLabel')
    : providerById(booking.draft.providerId ?? '')?.name ?? ''
)

const locationName = computed(() =>
  booking.draft.locationId === 'any'
    ? t('booking.when.anyLocationLabel')
    : localized(locationById(booking.draft.locationId ?? '')?.name)
)

const lede = computed(() =>
  booking.draft.providerId === 'any'
    ? t('booking.when.ledeAny', { location: locationName.value })
    : t('booking.when.ledeProvider', { provider: providerName.value, location: locationName.value })
)

const dayHeading = computed(() => {
  const offset = daysBetweenKeys(todayKey(), booking.draft.dateKey)
  const date = formatWallDate(booking.draft.dateKey, locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  if (offset === 0) return `${t('common.today')} · ${date}`
  if (offset === 1) return `${t('common.tomorrow')} · ${date}`
  return date
})

const countLabel = computed(() =>
  daySlots.value.length === 0
    ? t('booking.when.noneLabel')
    : t('booking.when.someLabel', { count: daySlots.value.length })
)

const nextOpeningLabel = computed(() => {
  const slot = nextOpening.value
  if (!slot) return ''
  return `${formatWallDate(slot.startWall, locale.value, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatWallTime(slot.startWall, locale.value)}`
})

const showWho = computed(
  () => booking.draft.providerId === 'any' || booking.draft.locationId === 'any'
)

const chosenLine = computed(() => {
  const slot = booking.draft.slot
  if (!slot) return ''
  return t('booking.when.chosen', {
    time: formatWallTime(slot.startWall, locale.value),
    provider: providerById(slot.providerId)?.name ?? '',
    location: localized(locationById(slot.locationId)?.name)
  })
})

/** Offered when today has nothing: tomorrow is often enough of a nudge. */
const canRelaxProvider = computed(() => booking.draft.providerId !== 'any')
const canRelaxLocation = computed(() => booking.draft.locationId !== 'any')
const tomorrowKey = computed(() => addDaysToKey(todayKey(), 1))
</script>

<template>
  <section>
    <h1 class="step__title">{{ t('booking.when.title') }}</h1>
    <p class="step__lede">{{ lede }}</p>

    <div class="when">
      <MonthCalendar
        :month-key="monthKey"
        :selected="booking.draft.dateKey"
        :counts="counts"
        :loading="loadingMonth"
        @select="onSelectDate"
        @month="onSelectMonth"
      />

      <div class="when__day">
        <header class="when__head">
          <h2 class="when__date">{{ dayHeading }}</h2>
          <p class="when__count" aria-live="polite">
            {{ loadingDay ? t('booking.when.loading') : countLabel }}
          </p>
        </header>

        <div v-if="loadingDay" class="when__loading">
          <span class="when__spinner" aria-hidden="true" />
          <span>{{ t('booking.when.loading') }}</span>
        </div>

        <SlotList
          v-else-if="daySlots.length"
          :slots="daySlots"
          :selected-id="booking.draft.slot?.id ?? null"
          :show-who="showWho"
          @select="booking.selectSlot($event)"
        />

        <div v-else class="when__empty">
          <h3 class="when__empty-title">{{ t('booking.when.empty.title') }}</h3>
          <p v-if="nextOpening" class="when__empty-body">{{ t('booking.when.empty.body') }}</p>
          <p v-else class="when__empty-body">{{ t('booking.when.empty.nothing') }}</p>

          <div class="when__empty-actions">
            <AppButton v-if="nextOpening" size="sm" icon-right="arrow-right" @click="goToNextOpening">
              {{ t('booking.when.empty.nextDay', { when: nextOpeningLabel }) }}
            </AppButton>
            <AppButton v-if="canRelaxProvider" size="sm" variant="secondary" @click="allowAnyProvider">
              {{ t('booking.when.empty.anyProvider') }}
            </AppButton>
            <AppButton v-if="canRelaxLocation" size="sm" variant="secondary" @click="allowAnyLocation">
              {{ t('booking.when.empty.anyLocation') }}
            </AppButton>
          </div>

          <div v-if="!joinedReference" class="when__waitlist">
            <AppButton size="sm" variant="quiet" icon-left="users" @click="waitlistOpen = true">
              {{ t('waitlist.trigger') }}
            </AppButton>
          </div>
        </div>

        <p v-if="chosenLine" class="when__chosen" role="status">
          <AppIcon name="check-circle" :size="17" />
          <span>{{ chosenLine }}</span>
        </p>

        <!--
          Offered from the moment times appear, not only when a day is empty: the usual
          problem is not "no times" but "no times that suit me". It sits under the slots
          and never competes with them, because a booking is worth more than a sign-up.
        -->
        <p v-if="joinedReference" class="when__joined" role="status">
          <AppIcon name="check-circle" :size="17" />
          <span>{{ t('waitlist.onListBody', { reference: joinedReference }) }}</span>
        </p>
        <div
          v-else-if="daySlots.length && !loadingDay"
          class="when__ask"
          :class="{ 'when__ask--loud': waitIsLong }"
        >
          <p class="when__ask-text">
            <span>{{ t('waitlist.inlinePrompt') }}</span>
            <span v-if="waitIsLong" class="when__ask-note">{{ waitNote }}</span>
          </p>
          <AppButton
            size="sm"
            :variant="waitIsLong ? 'secondary' : 'quiet'"
            icon-left="users"
            @click="waitlistOpen = true"
          >
            {{ t('waitlist.trigger') }}
          </AppButton>
        </div>

        <p class="when__zone">
          {{ t('common.clinicTime', { zone: zoneAbbreviation(tomorrowKey) }) }}
        </p>
      </div>
    </div>

    <WaitlistDialog
      :open="waitlistOpen"
      :preset="waitlistPreset"
      @close="waitlistOpen = false"
      @joined="
        (entry) => {
          joinedReference = entry.reference
          waitlistOpen = false
        }
      "
    />
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

.when {
  display: grid;
  grid-template-columns: minmax(300px, 0.85fr) 1fr;
  gap: var(--s6);
  margin-top: var(--s6);
  align-items: start;
}

.when__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  padding-bottom: var(--s3);
  margin-bottom: var(--s5);
  border-bottom: 1px solid var(--border);
}

.when__date {
  font-size: var(--text-xl);
  text-transform: capitalize;
}

.when__count {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--teal-700);
}

.when__loading {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding-block: var(--s7);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.when__spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--teal-200);
  border-top-color: var(--teal-600);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.when__empty {
  padding: var(--s5);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--paper);
}

.when__empty-title {
  font-size: var(--text-lg);
}

.when__empty-body {
  margin-top: var(--s2);
  font-size: var(--text-sm);
  color: var(--navy-600);
}

.when__empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s4);
}

.when__waitlist {
  margin-top: var(--s4);
  padding-top: var(--s4);
  border-top: 1px dashed var(--border-strong);
}

.when__ask {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  margin-top: var(--s5);
  padding-top: var(--s4);
  border-top: 1px dashed var(--border-strong);
}

.when__ask-text {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.when__ask-note {
  display: block;
  font-size: var(--text-xs);
}

/* A wait of a week or more deserves saying out loud. */
.when__ask--loud {
  padding: var(--s4);
  border: 1px solid var(--teal-200);
  border-radius: var(--radius-sm);
  background: var(--teal-50);
}

.when__ask--loud .when__ask-text {
  color: var(--teal-800);
  font-weight: 500;
}

.when__ask--loud .when__ask-note {
  color: var(--teal-700);
  font-weight: 400;
}

.when__joined {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--positive-bg);
  color: var(--positive-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.when__chosen {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s5);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--positive-bg);
  color: var(--positive-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.when__chosen svg {
  margin-top: 2px;
}

.when__zone {
  margin-top: var(--s4);
  font-size: var(--text-2xs);
  color: var(--text-soft);
}

@media (max-width: 880px) {
  .when {
    grid-template-columns: 1fr;
  }
}
</style>

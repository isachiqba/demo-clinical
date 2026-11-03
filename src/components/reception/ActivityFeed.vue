<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import type { ActivityEvent } from '@/types'

/** What has happened in this session, newest first. Nothing is invented or inferred. */
const props = defineProps<{ events: ActivityEvent[]; limit?: number }>()

const { t, locale } = useI18n()

const shown = computed(() => props.events.slice(0, props.limit ?? 12))

const moment = (wall?: string): string =>
  wall
    ? `${formatWallDate(wall, locale.value, { day: 'numeric', month: 'short' })}, ${formatWallTime(wall, locale.value)}`
    : ''

const paramsFor = (event: ActivityEvent): Record<string, string | number> => ({
  patient: event.detail.patient ?? '',
  service: event.detail.service ? localized(serviceById(event.detail.service)?.name) : '',
  when: moment(event.detail.when),
  was: moment(event.detail.was),
  reference: event.detail.reference ?? '',
  count: event.detail.count ?? 0
})

/** The one pluralised sentence needs its count passing separately. */
const sentence = (event: ActivityEvent): string =>
  event.kind === 'opening-detected'
    ? t(`reception.activity.${event.kind}`, paramsFor(event), event.detail.count ?? 0)
    : t(`reception.activity.${event.kind}`, paramsFor(event))

const TONES: Record<string, string> = {
  'request-created': 'accent',
  'registration-declared': 'accent',
  'appointment-confirmed': 'good',
  'change-requested': 'warn',
  'change-applied': 'good',
  'change-abandoned': 'neutral',
  'cancellation-requested': 'warn',
  'cancellation-completed': 'neutral',
  'marked-unavailable': 'warn',
  'alternative-proposed': 'accent',
  'alternative-accepted': 'good',
  'opening-detected': 'accent',
  'offer-sent': 'accent',
  'offer-accepted': 'good',
  'offer-declined': 'neutral',
  'offer-expired': 'neutral',
  'note-added': 'neutral'
}

const toneOf = (event: ActivityEvent): string => TONES[event.kind] ?? 'neutral'
</script>

<template>
  <ol v-if="shown.length" class="feed">
    <li v-for="event in shown" :key="event.id" class="feed__row">
      <span class="feed__dot" :class="`feed__dot--${toneOf(event)}`" aria-hidden="true" />
      <span class="feed__time">{{ formatWallTime(event.atWall, locale) }}</span>
      <span class="feed__text">{{ sentence(event) }}</span>
    </li>
  </ol>
  <p v-else class="feed__empty">{{ t('reception.overview.activity.none') }}</p>
</template>

<style scoped>
.feed {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feed__row {
  display: grid;
  grid-template-columns: 10px 62px 1fr;
  gap: var(--s3);
  align-items: baseline;
  padding-block: var(--s3);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
}

.feed__row:last-child {
  border-bottom: none;
}

.feed__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--navy-200);
  transform: translateY(-1px);
}

.feed__dot--accent {
  background: var(--teal-600);
}
.feed__dot--good {
  background: var(--positive-fg);
}
.feed__dot--warn {
  background: var(--caution-fg);
}

.feed__time {
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--navy-200);
  white-space: nowrap;
}

.feed__text {
  color: var(--navy-700);
  line-height: 1.45;
}

.feed__empty {
  padding-block: var(--s5);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

@media (max-width: 520px) {
  .feed__row {
    grid-template-columns: 10px 1fr;
    row-gap: var(--s1);
  }

  .feed__time {
    grid-column: 2;
  }
}
</style>

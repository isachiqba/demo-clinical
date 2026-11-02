<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime, zoneAbbreviation } from '@/services/clinicTime'
import { useBookingStore } from '@/stores/booking'
import AppIcon from '@/components/ui/AppIcon.vue'

const { t, locale } = useI18n()
const booking = useBookingStore()

interface Row {
  key: string
  icon: string
  label: string
  value: string
}

const rows = computed<Row[]>(() => {
  const draft = booking.draft
  const list: Row[] = []

  if (booking.service) {
    list.push({
      key: 'service',
      icon: booking.service.icon,
      label: t('booking.summary.service'),
      value: `${localized(booking.service.name)} · ${t('common.minutes', { count: booking.service.durationMinutes })}`
    })
  }

  if (draft.patientType) {
    list.push({
      key: 'patientType',
      icon: 'user',
      label: t('booking.summary.patientType'),
      value: t(`reception.patientType.${draft.patientType}`)
    })
  }

  if (draft.locationId) {
    list.push({
      key: 'location',
      icon: 'map-pin',
      label: t('booking.summary.location'),
      value:
        draft.slot
          ? localized(locationById(draft.slot.locationId)?.name)
          : draft.locationId === 'any'
            ? t('booking.place.anyLocation')
            : localized(locationById(draft.locationId)?.name)
    })
  }

  if (draft.providerId) {
    list.push({
      key: 'provider',
      icon: 'users',
      label: t('booking.summary.provider'),
      value:
        draft.slot
          ? providerById(draft.slot.providerId)?.name ?? ''
          : draft.providerId === 'any'
            ? t('booking.place.firstAvailable')
            : providerById(draft.providerId)?.name ?? ''
    })
  }

  if (draft.slot) {
    list.push({
      key: 'when',
      icon: 'calendar',
      label: t('booking.summary.when'),
      value: `${formatWallDate(draft.slot.startWall, locale.value)}, ${formatWallTime(draft.slot.startWall, locale.value)}`
    })
  }

  return list
})
</script>

<template>
  <aside class="sum" :aria-label="t('booking.summary.title')">
    <h2 class="sum__title">{{ t('booking.summary.title') }}</h2>

    <p v-if="!rows.length" class="sum__empty">{{ t('booking.summary.empty') }}</p>

    <dl v-else class="sum__rows">
      <div v-for="row in rows" :key="row.key" class="sum__row">
        <span class="sum__icon"><AppIcon :name="row.icon" :size="16" /></span>
        <div class="sum__text">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </div>
    </dl>

    <p class="sum__zone">{{ t('common.clinicTime', { zone: zoneAbbreviation() }) }}</p>
  </aside>
</template>

<style scoped>
.sum {
  position: sticky;
  top: calc(var(--header-h) + var(--s4));
  padding: var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.sum__title {
  font-size: var(--text-lg);
  margin-bottom: var(--s4);
}

.sum__empty {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.sum__rows {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
  margin: 0;
}

.sum__row {
  display: flex;
  gap: var(--s3);
}

.sum__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: var(--radius-xs);
  background: var(--teal-50);
  color: var(--teal-700);
}

.sum__text {
  min-width: 0;
}

.sum__text dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.sum__text dd {
  margin: 1px 0 0;
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.45;
  color: var(--navy-800);
}

.sum__zone {
  margin-top: var(--s5);
  padding-top: var(--s4);
  border-top: 1px solid var(--border);
  font-size: var(--text-2xs);
  color: var(--text-soft);
}

@media (max-width: 1040px) {
  .sum {
    position: static;
  }
}
</style>

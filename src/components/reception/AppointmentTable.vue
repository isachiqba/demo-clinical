<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import type { Appointment } from '@/types'
import StatusPill from './StatusPill.vue'

defineProps<{ appointments: Appointment[]; selectedId: string | null; showDate?: boolean }>()
const emit = defineEmits<{ open: [appointment: Appointment] }>()

const { locale } = useI18n()
</script>

<template>
  <ul class="rows">
    <li v-for="appointment in appointments" :key="appointment.id">
      <button
        class="row"
        :class="{ 'row--on': appointment.id === selectedId, 'row--off': appointment.status === 'cancelled' }"
        type="button"
        :aria-pressed="appointment.id === selectedId"
        @click="emit('open', appointment)"
      >
        <span class="row__when">
          <span class="row__time">{{ formatWallTime(appointment.startWall, locale) }}</span>
          <span v-if="showDate" class="row__date">
            {{ formatWallDate(appointment.startWall, locale, { day: 'numeric', month: 'short' }) }}
          </span>
        </span>

        <span class="row__main">
          <span class="row__patient">
            {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
          </span>
          <span class="row__meta">
            {{ localized(serviceById(appointment.serviceId)?.name) }} ·
            {{ providerById(appointment.providerId)?.name }} ·
            {{ localized(locationById(appointment.locationId)?.name) }}
          </span>
        </span>

        <span class="row__ref">{{ appointment.reference }}</span>
        <StatusPill :status="appointment.status" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.rows {
  list-style: none;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.rows li + li {
  border-top: 1px solid var(--border);
}

.row {
  display: grid;
  grid-template-columns: 88px 1fr auto auto;
  gap: var(--s4);
  align-items: center;
  width: 100%;
  padding: var(--s3) var(--s4);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s var(--ease);
}

.row:hover {
  background: var(--teal-50);
}

.row.row--on,
.row.row--on:hover {
  background: var(--teal-50);
  box-shadow: inset 3px 0 0 var(--teal-600);
}

.row--off .row__patient {
  color: var(--navy-400);
}

.row__when {
  display: flex;
  flex-direction: column;
}

.row__time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--navy-800);
  font-size: var(--text-sm);
}

.row__date {
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.row__main {
  min-width: 0;
}

.row__patient {
  display: block;
  font-weight: 600;
  color: var(--navy-800);
  font-size: var(--text-sm);
}

.row__meta {
  display: block;
  font-size: var(--text-2xs);
  color: var(--navy-400);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: 72px 1fr;
    grid-template-areas:
      'when main'
      'ref  status';
    row-gap: var(--s2);
    padding-block: var(--s4);
  }

  .row__when {
    grid-area: when;
  }
  .row__main {
    grid-area: main;
  }
  .row__ref {
    grid-area: ref;
  }
  .row :deep(.pill) {
    grid-area: status;
    justify-self: start;
  }
  .row__meta {
    white-space: normal;
  }
}
</style>

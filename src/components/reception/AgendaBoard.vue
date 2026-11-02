<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providers } from '@/data/providers'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { formatClock, formatWallTime, minutesOf } from '@/services/clinicTime'
import type { Appointment } from '@/types'

/** A day grid: one column per clinician, appointments placed by their start time. */
const props = defineProps<{ appointments: Appointment[]; selectedId: string | null }>()
const emit = defineEmits<{ open: [appointment: Appointment] }>()

const { t, locale } = useI18n()

/** Tall enough that a 20-minute appointment still fits two lines of text. */
const PX_PER_MINUTE = 1.7
const DAY_START = 7 * 60
const DAY_END = 19 * 60 + 30

const columns = computed(() =>
  providers
    .map((provider) => ({
      provider,
      items: props.appointments
        .filter((appointment) => appointment.providerId === provider.id)
        .sort((a, b) => a.startWall.localeCompare(b.startWall))
    }))
    .filter((column) => column.items.length > 0 || props.appointments.length === 0)
)

const hours = computed(() => {
  const marks: number[] = []
  for (let minute = DAY_START; minute <= DAY_END; minute += 60) marks.push(minute)
  return marks
})

const boardHeight = computed(() => (DAY_END - DAY_START) * PX_PER_MINUTE)

const place = (appointment: Appointment) => ({
  top: `${(minutesOf(appointment.startWall) - DAY_START) * PX_PER_MINUTE}px`,
  height: `${Math.max(appointment.durationMinutes * PX_PER_MINUTE - 4, 34)}px`
})

/** Short appointments only have room for the name, so the second line is dropped
    rather than left half-cut. */
const isShort = (appointment: Appointment): boolean => appointment.durationMinutes < 30
</script>

<template>
  <div class="board">
    <div class="board__head">
      <span class="board__corner" />
      <div
        v-for="column in columns"
        :key="column.provider.id"
        class="board__col-head"
      >
        <img
          class="board__face"
          :src="column.provider.image"
          :alt="t('demo.illustrativeShort')"
          width="30"
          height="30"
        />
        <span class="board__name">{{ column.provider.name }}</span>
      </div>
    </div>

    <div class="board__body" :style="{ height: `${boardHeight}px` }">
      <div class="board__axis">
        <span
          v-for="minute in hours"
          :key="minute"
          class="board__hour"
          :style="{ top: `${(minute - DAY_START) * PX_PER_MINUTE}px` }"
        >
          {{ formatClock(minute, locale) }}
        </span>
      </div>

      <div class="board__cols">
        <div
          v-for="minute in hours"
          :key="`line-${minute}`"
          class="board__line"
          :style="{ top: `${(minute - DAY_START) * PX_PER_MINUTE}px` }"
          aria-hidden="true"
        />

        <div v-for="column in columns" :key="column.provider.id" class="board__col">
          <button
            v-for="appointment in column.items"
            :key="appointment.id"
            class="slotcard"
            :class="[
              `slotcard--${appointment.status}`,
              { 'slotcard--on': appointment.id === selectedId }
            ]"
            type="button"
            :style="place(appointment)"
            :aria-pressed="appointment.id === selectedId"
            @click="emit('open', appointment)"
          >
            <span class="slotcard__line">
              <span class="slotcard__time">{{ formatWallTime(appointment.startWall, locale) }}</span>
              <span class="slotcard__name">
                {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
              </span>
            </span>
            <span v-if="!isShort(appointment)" class="slotcard__meta">
              {{ localized(serviceById(appointment.serviceId)?.name) }} ·
              {{ localized(locationById(appointment.locationId)?.name) }} ·
              {{ t(`reception.status.${appointment.status}`) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.board__head {
  display: grid;
  grid-template-columns: 76px repeat(v-bind('columns.length'), minmax(0, 1fr));
  border-bottom: 1px solid var(--border);
  background: var(--paper);
}

.board__col-head {
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: var(--s3);
  border-left: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.board__face {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 22%;
}

.board__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board__body {
  position: relative;
  display: grid;
  grid-template-columns: 76px 1fr;
}

.board__axis {
  position: relative;
  border-right: 1px solid var(--border);
}

.board__hour {
  position: absolute;
  right: var(--s2);
  transform: translateY(-50%);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--navy-200);
  white-space: nowrap;
}

.board__cols {
  position: relative;
  display: grid;
  grid-template-columns: repeat(v-bind('columns.length'), minmax(0, 1fr));
}

.board__line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dotted var(--border);
}

.board__col {
  position: relative;
  border-left: 1px solid var(--border);
}

.slotcard {
  position: absolute;
  left: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px var(--s2);
  border: 1px solid var(--teal-200);
  border-left: 3px solid var(--teal-600);
  border-radius: var(--radius-xs);
  background: var(--teal-50);
  text-align: left;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.14s var(--ease), border-color 0.14s var(--ease);
}

.slotcard:hover {
  box-shadow: var(--shadow-sm);
}

.slotcard--on {
  outline: 2px solid var(--navy-800);
  outline-offset: 1px;
}

.slotcard--arrived {
  background: var(--caution-bg);
  border-color: #e8d2a8;
  border-left-color: var(--caution-fg);
}

.slotcard--completed {
  background: var(--positive-bg);
  border-color: #c4ddc9;
  border-left-color: var(--positive-fg);
}

.slotcard--cancelled {
  background: var(--paper-deep);
  border-color: var(--border);
  border-left-color: var(--navy-200);
}

.slotcard__line {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  min-width: 0;
}

.slotcard__time {
  flex: none;
  font-size: var(--text-2xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--navy-600);
}

.slotcard__name {
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.25;
  color: var(--navy-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slotcard__meta {
  font-size: var(--text-2xs);
  line-height: 1.3;
  color: var(--navy-400);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

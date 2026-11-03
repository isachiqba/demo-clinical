<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { blocksAt } from '@/data/doctor'
import { roomById } from '@/data/rooms'
import { isPresent } from '@/services/careFlow'
import { formatClock, formatWallTime, minutesOf, weekdayOfKey } from '@/services/clinicTime'
import type { Appointment, LocationId } from '@/types'
import { APPOINTMENT_STATUSES } from '@/types'
import StatusPill from './StatusPill.vue'

/**
 * The day, one column per clinic. Appointments are placed on a ten-minute grid, and each
 * card carries both states: what the clinic has agreed, and what is still to be done by
 * hand in CureMD.
 */
const props = defineProps<{
  appointments: Appointment[]
  selectedId: string | null
  /** Clinics to show; all three when reception has not filtered. */
  locationIds: LocationId[]
  /** The day being shown, so each column can say whether the doctor is there. */
  dateKey: string
}>()

const emit = defineEmits<{ open: [appointment: Appointment] }>()

const { t, locale } = useI18n()

/*
 * The scale of the board. A ten-minute slot is PX_PER_MINUTE * 10 tall, and every card has
 * to fit inside its own slot — a card that spilled over would hide the next appointment.
 * The patients who are in the building get a taller card with their room on it, so the
 * scale is set by that card rather than by the compact one.
 */
const PX_PER_MINUTE = 3.6
const DAY_START = 7 * 60
const DAY_END = 19 * 60 + 30

/**
 * One doctor, so a column is only live on the days he sits there. The hours come from the
 * same blocks the booking grid is built from, which is why an empty column is information
 * rather than an oversight.
 */
const columns = computed(() =>
  locations
    .filter((location) => props.locationIds.includes(location.id))
    .map((location) => ({
      location,
      sessions: blocksAt(weekdayOfKey(props.dateKey), location.id).map(
        (block) =>
          `${formatClock(block.startsAt, locale.value)}–${formatClock(block.endsAt, locale.value)}`
      ),
      items: props.appointments
        .filter((appointment) => appointment.locationId === location.id)
        .sort((a, b) => a.startWall.localeCompare(b.startWall))
    }))
)

const hours = computed(() => {
  const marks: number[] = []
  for (let minute = DAY_START; minute <= DAY_END; minute += 60) marks.push(minute)
  return marks
})

const boardHeight = computed(() => (DAY_END - DAY_START) * PX_PER_MINUTE)

const place = (appointment: Appointment) => ({
  top: `${(minutesOf(appointment.startWall) - DAY_START) * PX_PER_MINUTE}px`
})

/** The room the patient is in, for the taller card. */
const roomOf = (appointment: Appointment): string => {
  const id = appointment.visit?.roomId
  return id ? localized(roomById(id)?.name) : t('reception.floor.noRoom')
}

const isInactive = (appointment: Appointment): boolean =>
  appointment.status === 'cancelled' || appointment.status === 'unavailable'
</script>

<template>
  <div class="board">
    <!-- Names each colour, so the board does not ask anyone to decode it from hue alone. -->
    <ul class="legend">
      <li v-for="status in APPOINTMENT_STATUSES" :key="status" class="legend__item">
        <span class="legend__swatch" :class="`card--${status}`" aria-hidden="true" />
        <span>{{ t(`reception.status.${status}`) }}</span>
      </li>
    </ul>

    <div class="board__head">
      <span class="board__corner" />
      <div v-for="column in columns" :key="column.location.id" class="board__col-head">
        <span class="board__col-name">{{ localized(column.location.name) }}</span>
        <span v-if="column.sessions.length" class="board__col-hours">
          {{ column.sessions.join(' · ') }}
        </span>
        <span v-else class="board__col-away">{{ t('reception.agenda.notHere') }}</span>
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

        <div v-for="column in columns" :key="column.location.id" class="board__col">
          <button
            v-for="appointment in column.items"
            :key="appointment.id"
            class="card"
            :class="[
              `card--${appointment.status}`,
              {
                'card--on': appointment.id === selectedId,
                'card--off': isInactive(appointment),
                'card--present': isPresent(appointment)
              }
            ]"
            type="button"
            :style="place(appointment)"
            :aria-pressed="appointment.id === selectedId"
            :aria-label="`${formatWallTime(appointment.startWall, locale)} ${appointment.patient.firstName} ${appointment.patient.lastName} — ${t(`reception.status.${appointment.status}`)}, ${t(`reception.curemd.status.${appointment.curemd.status}`)}`"
            @click="emit('open', appointment)"
          >
            <span class="card__time">{{ formatWallTime(appointment.startWall, locale) }}</span>
            <span class="card__body">
              <span class="card__name">
                {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
              </span>
              <!-- Only for whoever is in the building: where to find them. -->
              <span v-if="isPresent(appointment)" class="card__room">
                {{ roomOf(appointment) }}
              </span>
            </span>
            <span class="card__marks" aria-hidden="true">
              <StatusPill kind="appointment" :status="appointment.status" compact />
              <StatusPill kind="curemd" :status="appointment.curemd.status" compact />
            </span>
            <span class="sr-only">{{ localized(serviceById(appointment.serviceId)?.name) }}</span>
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

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  margin: 0 0 var(--s4);
  padding: 0;
  list-style: none;
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--text-2xs);
  color: var(--navy-600);
}

.legend__swatch {
  width: 16px;
  height: 10px;
  flex: none;
  border-radius: 2px;
  border-width: 1px;
  border-style: solid;
  border-left-width: 3px;
}

.board__head {
  display: grid;
  grid-template-columns: 76px repeat(v-bind('columns.length'), minmax(0, 1fr));
  border-bottom: 1px solid var(--border);
  background: var(--paper);
}

.board__col-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--s3);
  border-left: 1px solid var(--border);
}

.board__col-name,
.board__col-hours,
.board__col-away {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board__col-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.board__col-hours {
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--teal-700);
}

.board__col-away {
  font-size: var(--text-2xs);
  color: var(--text-soft);
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

.card {
  position: absolute;
  left: 3px;
  right: 3px;
  /* Fits inside a ten-minute slot (36px) with room to breathe. */
  height: 24px;
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: 0 var(--s2);
  border: 1px solid var(--teal-200);
  border-left: 3px solid var(--teal-600);
  border-radius: var(--radius-xs);
  background: var(--teal-50);
  text-align: left;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.14s var(--ease);
}

.card:hover {
  box-shadow: var(--shadow-sm);
}

/*
 * The patient is in the building. Their card is taller and carries the room, because that
 * is what the desk is asked for while they are here. It still fits inside its own slot, so
 * it never hides the appointment after it.
 */
.card--present {
  height: 34px;
  align-items: stretch;
  padding-block: 2px;
  box-shadow: var(--shadow-xs);
}

.card--present .card__time {
  align-self: center;
}

.card--present .card__marks {
  align-self: center;
}

/* Two lines inside a 34px card: the line heights are fixed so the room is never clipped
   by a descender. */
.card__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-width: 0;
}

.card__room {
  font-size: 10px;
  line-height: 12px;
  font-weight: 600;
  color: var(--navy-600);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card.card--on {
  outline: 2px solid var(--navy-800);
  outline-offset: 1px;
}

/*
 * One colour per appointment status, so a day reads at a glance.
 *
 * Colour is never the only cue: every card also carries its two status marks, which are
 * told apart by shape and icon, and the legend above the board names each colour. The
 * board stays usable in greyscale and to anyone who does not see these hues apart.
 */
.card--requested {
  background: var(--caution-bg);
  border-color: #e8d2a8;
  border-left-color: var(--caution-fg);
}

/* Confirmed keeps the teal the card already had. */
.card--confirmed {
  background: var(--teal-50);
  border-color: var(--teal-200);
  border-left-color: var(--teal-600);
}

.card--arrived {
  background: var(--navy-100);
  border-color: #c4d2e2;
  border-left-color: var(--navy-600);
}

/* Finished visits, in red, as asked for. */
.card--completed {
  background: var(--critical-bg);
  border-color: #efc9c2;
  border-left-color: var(--critical-fg);
}

.card--cancelled {
  background: var(--paper-deep);
  border-color: var(--border);
  border-left-color: var(--navy-200);
}

.card--unavailable {
  background: var(--sage-50);
  border-color: var(--sage-200);
  border-left-color: var(--sage-600);
}

/* Cancelled and closed-as-unavailable are struck through and dimmed, so they read as
   "not happening" without relying on how pale the colour is. */
.card--off {
  opacity: 0.72;
}

.card--off .card__time,
.card--off .card__name {
  text-decoration: line-through;
}

/* The card is one line tall, so neither piece of text may wrap: a wrapped name was
   being cut in half by the card's own overflow. The name gives up its space first. */
.card__time {
  flex: none;
  font-size: var(--text-2xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--navy-700);
  white-space: nowrap;
}

.card__name {
  min-width: 0;
  font-size: var(--text-2xs);
  line-height: 15px;
  font-weight: 600;
  color: var(--navy-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__marks {
  display: flex;
  flex: none;
  gap: 2px;
}
</style>

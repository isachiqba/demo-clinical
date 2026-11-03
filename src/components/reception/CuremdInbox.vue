<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, CuremdTask, LocationId } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import StatusPill from './StatusPill.vue'

/**
 * Everything waiting on somebody to go into CureMD and do it by hand.
 *
 * Oldest task first, because that is the one most likely to have been forgotten. The date
 * of the appointment and the age of the task are deliberately shown apart: a booking for
 * next month can still be a job that has been sitting here since Monday.
 */
const emit = defineEmits<{
  act: [payload: { task: CuremdTask; appointment: Appointment }]
  open: [appointment: Appointment]
}>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const clinicFilter = ref<LocationId | ''>('')
const taskFilter = ref<CuremdTask | ''>('')
const dateFilter = ref('')
const query = ref('')

const rows = computed(() =>
  schedule.curemdQueue
    .filter(({ appointment, task }) => {
      if (clinicFilter.value && appointment.locationId !== clinicFilter.value) return false
      if (taskFilter.value && task !== taskFilter.value) return false
      if (dateFilter.value && !appointment.startWall.startsWith(dateFilter.value)) return false
      if (query.value.trim()) {
        const needle = query.value.trim().toLowerCase()
        const hay = [
          appointment.patient.firstName,
          appointment.patient.lastName,
          appointment.reference,
          appointment.curemd.reference ?? ''
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // Oldest task first.
    .sort(
      (a, b) => schedule.taskAgeMinutes(b.appointment) - schedule.taskAgeMinutes(a.appointment)
    )
)

const anyFilter = computed(
  () =>
    Boolean(clinicFilter.value) ||
    Boolean(taskFilter.value) ||
    Boolean(dateFilter.value) ||
    query.value.trim().length > 0
)

const clearFilters = (): void => {
  clinicFilter.value = ''
  taskFilter.value = ''
  dateFilter.value = ''
  query.value = ''
}

/** "4 h" or "20 min": how long the job has been sitting here. */
const age = (appointment: Appointment): string => {
  const minutes = schedule.taskAgeMinutes(appointment)
  if (minutes < 60) return t('reception.curemd.ageMinutes', { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 48) return t('reception.curemd.ageHours', { count: hours })
  return t('reception.curemd.ageDays', { count: Math.round(hours / 24) })
}

/** The time this job is about: the new one for a change, otherwise the booked one. */
const targetWall = (appointment: Appointment, task: CuremdTask): string =>
  task === 'change' && appointment.pendingChange
    ? appointment.pendingChange.startWall
    : appointment.startWall

const tasks: CuremdTask[] = ['registration', 'change', 'cancellation']
</script>

<template>
  <section class="inbox" :aria-label="t('reception.curemd.inbox')">
    <header class="inbox__head">
      <div>
        <h2 class="inbox__title">
          {{ t('reception.curemd.inbox') }}
          <span v-if="schedule.taskCounts.total" class="inbox__count">
            {{ schedule.taskCounts.total }}
          </span>
        </h2>
        <p class="inbox__lede">{{ t('reception.curemd.inboxLede') }}</p>
      </div>
    </header>

    <ul class="summary">
      <li v-for="task in tasks" :key="task" class="summary__item">
        <span class="summary__value">{{ schedule.taskCounts[task] }}</span>
        <span class="summary__label">{{ t(`reception.curemd.task.${task}`) }}</span>
      </li>
    </ul>

    <div class="filters">
      <label class="filters__search">
        <AppIcon name="search" :size="17" />
        <span class="sr-only">{{ t('reception.filters.search') }}</span>
        <input v-model="query" type="search" :placeholder="t('reception.curemd.searchPlaceholder')" />
      </label>

      <label class="filters__field">
        <span class="sr-only">{{ t('reception.filters.location') }}</span>
        <select v-model="clinicFilter">
          <option value="">{{ t('reception.filters.allLocations') }}</option>
          <option v-for="location in locations" :key="location.id" :value="location.id">
            {{ localized(location.name) }}
          </option>
        </select>
      </label>

      <label class="filters__field">
        <span class="sr-only">{{ t('reception.curemd.operation') }}</span>
        <select v-model="taskFilter">
          <option value="">{{ t('reception.curemd.allOperations') }}</option>
          <option v-for="task in tasks" :key="task" :value="task">
            {{ t(`reception.curemd.task.${task}`) }}
          </option>
        </select>
      </label>

      <label class="filters__field">
        <span class="sr-only">{{ t('reception.curemd.appointmentDate') }}</span>
        <input v-model="dateFilter" type="date" />
      </label>

      <AppButton v-if="anyFilter" variant="quiet" size="sm" icon-left="x" @click="clearFilters">
        {{ t('reception.filters.clear') }}
      </AppButton>
    </div>

    <ul v-if="rows.length" class="rows">
      <li v-for="{ appointment, task } in rows" :key="appointment.id" class="row">
        <button class="row__open" type="button" @click="emit('open', appointment)">
          <span class="row__who">
            <span class="row__name">
              {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
            </span>
            <span class="row__ref">{{ appointment.reference }}</span>
          </span>

          <span class="row__what">
            <span class="row__service">
              {{ localized(serviceById(appointment.serviceId)?.name) }} ·
              {{ localized(locations.find((l) => l.id === appointment.locationId)?.name) }}
            </span>
            <span class="row__when">
              {{ t('reception.curemd.appointmentDate') }}:
              {{ formatWallDate(targetWall(appointment, task), locale, { day: 'numeric', month: 'short' }) }},
              {{ formatWallTime(targetWall(appointment, task), locale) }}
            </span>
          </span>

          <span class="row__task">
            <StatusPill kind="curemd" :status="appointment.curemd.status" />
            <span class="row__age">{{ t('reception.curemd.waiting', { age: age(appointment) }) }}</span>
            <span v-if="appointment.curemd.reference" class="row__external">
              {{ appointment.curemd.reference }}
            </span>
          </span>
        </button>

        <AppButton
          class="row__action"
          size="sm"
          icon-left="database"
          :disabled="schedule.working"
          @click="emit('act', { task, appointment })"
        >
          {{ t(`reception.curemd.dialog.${task}.action`) }}
        </AppButton>
      </li>
    </ul>

    <p v-else class="empty">
      <span>{{ anyFilter ? t('reception.curemd.noneFiltered') : t('reception.curemd.none') }}</span>
      <span class="empty__hint">{{ t('reception.curemd.noneHint') }}</span>
    </p>
  </section>
</template>

<style scoped>
.inbox__title {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: var(--text-xl);
}

.inbox__count {
  min-width: 26px;
  padding: 0 var(--s2);
  border-radius: var(--radius-pill);
  background: var(--caution-fg);
  color: #fff;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 700;
  text-align: center;
}

.inbox__lede {
  margin-top: 2px;
  max-width: 64ch;
  font-size: var(--text-sm);
  color: var(--navy-400);
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s3);
  margin-top: var(--s5);
  list-style: none;
  padding: 0;
}

.summary__item {
  padding: var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.summary__value {
  display: block;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: 1.1;
  color: var(--navy-800);
}

.summary__label {
  display: block;
  margin-top: var(--s1);
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
  margin-top: var(--s5);
}

.filters__search {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex: 1 1 200px;
  min-width: 170px;
  padding-inline: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-400);
}

.filters__search input {
  flex: 1;
  min-width: 0;
  min-height: 38px;
  border: none;
  background: transparent;
  font-size: var(--text-sm);
}

.filters__search input:focus {
  outline: none;
}

.filters__search:focus-within {
  border-color: var(--teal-500);
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.filters__field select,
.filters__field input {
  min-height: 40px;
  padding: 0 var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}

.rows {
  margin-top: var(--s4);
  list-style: none;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
}

.row + .row {
  border-top: 1px solid var(--border);
}

.row__open {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: var(--s4);
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.row__name {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-800);
}

.row__ref {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.row__service,
.row__when {
  display: block;
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.row__service {
  font-size: var(--text-xs);
  color: var(--navy-600);
}

.row__task {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.row__age {
  font-size: var(--text-2xs);
  font-weight: 600;
  color: var(--caution-fg);
}

.row__external {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-2xs);
  color: var(--navy-200);
}

.row__action {
  flex: none;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  margin-top: var(--s4);
  padding: var(--s8) var(--s5);
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--navy-600);
}

.empty__hint {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

@media (max-width: 860px) {
  .summary {
    grid-template-columns: 1fr;
  }

  .row__open {
    grid-template-columns: 1fr;
    gap: var(--s2);
  }

  .row__task {
    align-items: flex-start;
  }

  .row__action {
    width: 100%;
  }
}
</style>

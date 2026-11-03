<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { localized } from '@/i18n'
import {
  addDaysToKey,
  dateKeyOf,
  formatWallDate,
  formatWallTime,
  todayKey
} from '@/services/clinicTime'
import { schedulingApi } from '@/services/schedulingApi'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, Slot } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Picks another time at the same clinic, for one of two jobs:
 *
 *  - `reschedule` asks for a change. If the appointment is already in CureMD the new time
 *    is only *held*; it does not become the patient's time until reception says they have
 *    changed it there.
 *  - `propose` puts a time to a patient whose request could not be met. It changes
 *    nothing until the patient accepts.
 *
 * Only slots the service reports as free are offered, and the choice is re-validated on
 * submit, so two open panels cannot produce a clash.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    appointment: Appointment | null
    mode?: 'reschedule' | 'propose'
  }>(),
  { mode: 'reschedule' }
)
const emit = defineEmits<{ close: []; moved: [appointment: Appointment] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const dateKey = ref(todayKey())
const slots = ref<Slot[]>([])
const chosen = ref<Slot | null>(null)
const loading = ref(false)
const failed = ref(false)

const load = async (): Promise<void> => {
  const appointment = props.appointment
  if (!appointment) return
  loading.value = true
  const found = await schedulingApi.getDaySlots({
    serviceId: appointment.serviceId,
    locationId: appointment.locationId,
    dateKey: dateKey.value
  })
  slots.value = found
  chosen.value = null
  loading.value = false
}

watch(
  () => props.open,
  (open) => {
    if (!open || !props.appointment) return
    failed.value = false
    dateKey.value = dateKeyOf(props.appointment.startWall)
    void load()
  }
)

watch(dateKey, () => {
  if (props.open) void load()
})

const currentLabel = computed(() => {
  const appointment = props.appointment
  if (!appointment) return ''
  return `${formatWallDate(appointment.startWall, locale.value)}, ${formatWallTime(appointment.startWall, locale.value)}`
})

const whereLabel = computed(() =>
  props.appointment ? localized(locationById(props.appointment.locationId)?.name) : ''
)

const minDate = todayKey()
const maxDate = addDaysToKey(todayKey(), 120)

const submit = async (): Promise<void> => {
  if (!props.appointment || !chosen.value) return
  failed.value = false
  const guard = { expectedVersion: props.appointment.version }
  const result =
    props.mode === 'propose'
      ? await schedule.proposeAlternative(props.appointment.id, chosen.value, guard)
      : await schedule.requestChange(props.appointment.id, chosen.value, guard)
  if (!result.ok) {
    failed.value = true
    await load()
    return
  }
  emit('moved', result.appointment)
}
</script>

<template>
  <AppDialog
    :open="open"
    :title="t(mode === 'propose' ? 'reception.propose.title' : 'reception.reschedule.title')"
    :close-label="t('common.close')"
    @close="emit('close')"
  >
    <p class="lede-sm">
      {{ t(mode === 'propose' ? 'reception.propose.lede' : 'reception.reschedule.lede') }}
    </p>
    <p class="current">
      {{ t('reception.reschedule.current', { when: currentLabel }) }} · {{ whereLabel }}
    </p>

    <label class="picker">
      <span class="picker__label">{{ t('reception.filters.date') }}</span>
      <input v-model="dateKey" type="date" :min="minDate" :max="maxDate" />
    </label>

    <p v-if="failed" class="failed" role="alert">
      <AppIcon name="alert-circle" :size="17" />
      <span>{{ t('reception.reschedule.failed') }}</span>
    </p>

    <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
    <p v-else-if="!slots.length" class="muted">{{ t('reception.reschedule.noSlots') }}</p>

    <ul v-else class="times">
      <li v-for="slot in slots" :key="slot.id">
        <button
          class="time"
          type="button"
          :class="{ 'time--on': chosen?.id === slot.id }"
          :aria-pressed="chosen?.id === slot.id"
          @click="chosen = slot"
        >
          {{ formatWallTime(slot.startWall, locale) }}
        </button>
      </li>
    </ul>

    <template #actions>
      <AppButton :disabled="!chosen" :loading="schedule.working" @click="submit">
        {{
          schedule.working
            ? t('reception.reschedule.moving')
            : t(mode === 'propose' ? 'reception.propose.confirm' : 'reception.reschedule.confirm')
        }}
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

.current {
  margin-top: var(--s3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-800);
}

.picker {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  margin-top: var(--s5);
}

.picker__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.picker input {
  min-height: var(--tap);
  padding: var(--s2) var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.failed {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3);
  border-radius: var(--radius-sm);
  background: var(--critical-bg);
  color: var(--critical-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.muted {
  margin-top: var(--s5);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.times {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: var(--s2);
  margin-top: var(--s5);
  list-style: none;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
}

.time {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color 0.14s var(--ease), background-color 0.14s var(--ease), color 0.14s var(--ease);
}

.time:hover {
  border-color: var(--teal-500);
  background: var(--teal-50);
}

.time.time--on,
.time.time--on:hover {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}
</style>

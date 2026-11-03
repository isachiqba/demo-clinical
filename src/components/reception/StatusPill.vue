<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppointmentStatus, CuremdStatus } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * One of the two states an appointment carries. They are deliberately different shapes as
 * well as different colours — a square mark for the appointment, a rounded one for
 * CureMD, each with its own icon — so they can be told apart without relying on colour.
 */
const props = defineProps<{
  kind: 'appointment' | 'curemd'
  status: AppointmentStatus | CuremdStatus
  /** Hides the text, leaving the mark and an accessible label. Used in dense views. */
  compact?: boolean
}>()

const { t } = useI18n()

const APPOINTMENT_ICON: Record<string, string> = {
  requested: 'clock',
  confirmed: 'check',
  arrived: 'user',
  completed: 'check-circle',
  cancelled: 'x',
  unavailable: 'ban'
}

const CUREMD_ICON: Record<string, string> = {
  'pending-registration': 'upload',
  registered: 'database',
  'change-pending': 'calendar-clock',
  'cancellation-pending': 'ban',
  cancelled: 'x',
  'not-required': 'minus'
}

const icon = computed(() =>
  props.kind === 'appointment'
    ? (APPOINTMENT_ICON[props.status] ?? 'info')
    : (CUREMD_ICON[props.status] ?? 'info')
)

const label = computed(() =>
  props.kind === 'appointment'
    ? t(`reception.status.${props.status}`)
    : t(`reception.curemd.status.${props.status}`)
)

const prefix = computed(() =>
  props.kind === 'curemd' ? t('reception.curemd.short') : t('reception.statusShort')
)
</script>

<template>
  <span
    class="pill"
    :class="[`pill--${kind}`, `pill--${status}`, { 'pill--compact': compact }]"
    :title="`${prefix}: ${label}`"
  >
    <AppIcon :name="icon" :size="12" :stroke-width="2.4" />
    <span :class="compact ? 'sr-only' : 'pill__text'">{{ prefix }}: {{ label }}</span>
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  padding: 2px var(--s2);
  font-size: var(--text-2xs);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

/* Square for the appointment, rounded for CureMD: shape carries the difference. */
.pill--appointment {
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--navy-600);
}

.pill--curemd {
  border-radius: var(--radius-pill);
  border: 1px dashed var(--border-strong);
  background: var(--paper-deep);
  color: var(--navy-600);
}

.pill--compact {
  padding: 2px;
}

/* Appointment states */
.pill--requested {
  border-color: #e0c48f;
  background: var(--caution-bg);
  color: var(--caution-fg);
}
.pill--confirmed,
.pill--arrived {
  border-color: var(--teal-200);
  background: var(--teal-50);
  color: var(--teal-700);
}
.pill--completed {
  border-color: #c4ddc9;
  background: var(--positive-bg);
  color: var(--positive-fg);
}
.pill--cancelled,
.pill--unavailable {
  color: var(--navy-400);
}

/* CureMD states */
.pill--pending-registration {
  border-color: #e0c48f;
  background: var(--caution-bg);
  color: var(--caution-fg);
}
.pill--registered {
  border-color: var(--teal-200);
  background: var(--teal-50);
  color: var(--teal-700);
}
.pill--change-pending,
.pill--cancellation-pending {
  border-color: #d9b7ae;
  background: var(--critical-bg);
  color: var(--critical-fg);
}
.pill--not-required {
  color: var(--navy-200);
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import {
  addMinutesToWall,
  formatWallDate,
  formatWallTime,
  zoneAbbreviation
} from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import { APPOINTMENT_STATUSES } from '@/types'
import type { Appointment, AppointmentStatus } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import StatusPill from './StatusPill.vue'

const props = defineProps<{ appointment: Appointment | null }>()
const emit = defineEmits<{ close: []; reschedule: [appointment: Appointment] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const askCancel = ref(false)
const panel = ref<HTMLElement | null>(null)

/** Opening the panel moves focus into it, so keyboard users are not left behind. */
watch(
  () => props.appointment?.id,
  async (id) => {
    if (!id) return
    await nextTick()
    panel.value?.focus()
  }
)

const service = computed(() => serviceById(props.appointment?.serviceId ?? ''))
const provider = computed(() => providerById(props.appointment?.providerId ?? ''))
const location = computed(() => locationById(props.appointment?.locationId ?? ''))

const whenLabel = computed(() => {
  const appointment = props.appointment
  if (!appointment) return ''
  const end = addMinutesToWall(appointment.startWall, appointment.durationMinutes)
  return `${formatWallDate(appointment.startWall, locale.value)} · ${formatWallTime(appointment.startWall, locale.value)}–${formatWallTime(end, locale.value)} ${zoneAbbreviation(appointment.startWall)}`
})

const setStatus = async (status: AppointmentStatus): Promise<void> => {
  if (!props.appointment) return
  await schedule.setStatus(props.appointment.id, status)
}

const confirmCancel = async (): Promise<void> => {
  if (props.appointment) await schedule.cancel(props.appointment.id)
  askCancel.value = false
}

const statuses = APPOINTMENT_STATUSES.filter((status) => status !== 'cancelled')
</script>

<template>
  <Transition name="panel">
    <aside
      v-if="appointment"
      ref="panel"
      class="panel"
      tabindex="-1"
      :aria-label="t('reception.detail.title')"
    >
      <header class="panel__head">
        <div>
          <p class="panel__label">{{ t('reception.detail.reference') }}</p>
          <p class="panel__ref">{{ appointment.reference }}</p>
        </div>
        <button class="panel__close" type="button" :aria-label="t('reception.detail.close')" @click="emit('close')">
          <AppIcon name="x" :size="18" />
        </button>
      </header>

      <div class="panel__scroll">
        <StatusPill :status="appointment.status" />

        <dl class="panel__rows">
          <div>
            <dt>{{ t('reception.detail.patient') }}</dt>
            <dd>{{ appointment.patient.firstName }} {{ appointment.patient.lastName }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.patientType') }}</dt>
            <dd>{{ t(`reception.patientType.${appointment.patientType}`) }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.contact') }}</dt>
            <dd>
              {{ appointment.patient.email }}<br />
              <span class="muted">{{ appointment.patient.phone || t('reception.detail.noPhone') }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.appointment') }}</dt>
            <dd>
              {{ localized(service?.name) }}
              <span class="muted">· {{ t('common.minutes', { count: appointment.durationMinutes }) }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.clinician') }}</dt>
            <dd>{{ provider?.name }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.clinic') }}</dt>
            <dd>{{ localized(location?.name) }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.when') }}</dt>
            <dd>{{ whenLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('confirmation.payment') }}</dt>
            <dd>{{ t(`reception.coverage.${appointment.patient.coverage || 'self-pay'}`) }}</dd>
          </div>
        </dl>

        <p class="panel__booked">
          {{ t('reception.detail.booked', { when: formatWallDate(appointment.createdAtWall, locale) }) }}
        </p>

        <section class="panel__block">
          <h3 class="panel__heading">{{ t('reception.status.change') }}</h3>
          <div class="panel__statuses" role="group" :aria-label="t('reception.status.change')">
            <button
              v-for="status in statuses"
              :key="status"
              class="chip"
              type="button"
              :class="{ 'chip--on': appointment.status === status }"
              :aria-pressed="appointment.status === status"
              :disabled="schedule.working"
              @click="setStatus(status)"
            >
              {{ t(`reception.status.${status}`) }}
            </button>
          </div>
        </section>

        <section class="panel__block">
          <h3 class="panel__heading">{{ t('reception.detail.actions') }}</h3>
          <div class="panel__actions">
            <AppButton
              variant="secondary"
              icon-left="calendar-clock"
              :disabled="appointment.status === 'cancelled'"
              @click="emit('reschedule', appointment)"
            >
              {{ t('reception.detail.reschedule') }}
            </AppButton>
            <AppButton
              variant="critical"
              icon-left="ban"
              :disabled="appointment.status === 'cancelled'"
              @click="askCancel = true"
            >
              {{ t('reception.detail.cancel') }}
            </AppButton>
          </div>
        </section>
      </div>

      <AppDialog
        :open="askCancel"
        :title="t('reception.detail.cancelTitle')"
        :close-label="t('common.close')"
        @close="askCancel = false"
      >
        <p>
          {{
            t('reception.detail.cancelBody', {
              patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
              service: localized(service?.name),
              when: whenLabel
            })
          }}
        </p>
        <template #actions>
          <AppButton variant="critical" :loading="schedule.working" @click="confirmCancel">
            {{ t('reception.detail.cancelConfirm') }}
          </AppButton>
          <AppButton variant="secondary" @click="askCancel = false">{{ t('common.keep') }}</AppButton>
        </template>
      </AppDialog>
    </aside>
  </Transition>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  max-height: calc(100vh - var(--s8));
  position: sticky;
  top: var(--s4);
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-bottom: 1px solid var(--border);
}

.panel__label {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.panel__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--navy-800);
}

.panel__close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--navy-400);
  cursor: pointer;
}

.panel__close:hover {
  background: var(--paper-deep);
  color: var(--navy-800);
}

.panel__scroll {
  padding: var(--s5);
  overflow-y: auto;
}

.panel__rows {
  display: grid;
  gap: var(--s4);
  margin: var(--s4) 0 0;
}

.panel__rows dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.panel__rows dd {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--navy-800);
  line-height: 1.45;
  word-break: break-word;
}

.muted {
  color: var(--navy-400);
  font-weight: 400;
}

.panel__booked {
  margin-top: var(--s4);
  font-size: var(--text-2xs);
  color: var(--text-soft);
}

.panel__block {
  margin-top: var(--s6);
  padding-top: var(--s5);
  border-top: 1px solid var(--border);
}

.panel__heading {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.panel__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.chip {
  min-height: 36px;
  padding-inline: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--navy-600);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.14s var(--ease), background-color 0.14s var(--ease), color 0.14s var(--ease);
}

.chip:hover:not(:disabled) {
  border-color: var(--teal-500);
  color: var(--teal-700);
}

.chip.chip--on,
.chip.chip--on:hover {
  background: var(--navy-800);
  border-color: var(--navy-800);
  color: #fff;
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel__actions {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.16s var(--ease);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .panel {
    position: static;
    max-height: none;
  }
}
</style>

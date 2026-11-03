<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { roomById } from '@/data/rooms'
import { canRecordArrival } from '@/services/careFlow'
import { formatWallDate, formatWallTime, zoneAbbreviation } from '@/services/clinicTime'
import { pendingTaskOf } from '@/services/curemd'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, CuremdTask } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import StatusPill from './StatusPill.vue'

/**
 * One appointment, in full: both its states, what is still to be done in CureMD, and the
 * trail of what reception has declared so far.
 */
const props = defineProps<{ appointment: Appointment | null }>()
const emit = defineEmits<{
  close: []
  reschedule: [appointment: Appointment]
  curemd: [payload: { task: CuremdTask; appointment: Appointment }]
  propose: [appointment: Appointment]
  arrival: [appointment: Appointment]
  slip: [appointment: Appointment]
}>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const askCancel = ref(false)
const panel = ref<HTMLElement | null>(null)

watch(
  () => props.appointment?.id,
  async (id) => {
    if (!id) return
    await nextTick()
    panel.value?.focus()
  }
)

const service = computed(() => serviceById(props.appointment?.serviceId ?? ''))
const location = computed(() => locationById(props.appointment?.locationId ?? ''))
const task = computed(() => (props.appointment ? pendingTaskOf(props.appointment) : null))

const moment = (wall: string): string =>
  `${formatWallDate(wall, locale.value)} · ${formatWallTime(wall, locale.value)} ${zoneAbbreviation(wall)}`

const whenLabel = computed(() => (props.appointment ? moment(props.appointment.startWall) : ''))

const registered = computed(() => props.appointment?.curemd.registered ?? null)

const isRequest = computed(() => props.appointment?.status === 'requested')
const isClosed = computed(
  () => props.appointment?.status === 'cancelled' || props.appointment?.status === 'unavailable'
)

const confirmCancel = async (): Promise<void> => {
  if (props.appointment) {
    await schedule.requestCancellation(props.appointment.id, {
      expectedVersion: props.appointment.version
    })
  }
  askCancel.value = false
}

const markUnavailable = async (): Promise<void> => {
  if (!props.appointment) return
  await schedule.markUnavailable(props.appointment.id, {
    expectedVersion: props.appointment.version
  })
}

const acceptProposal = async (): Promise<void> => {
  if (!props.appointment) return
  await schedule.acceptProposal(props.appointment.id, {
    expectedVersion: props.appointment.version
  })
}

/** Checking in goes through the dialog, so the desk can confirm who is standing there. */
const canArrive = computed(() =>
  props.appointment ? canRecordArrival(props.appointment) : false
)

const roomLabel = computed(() => {
  const id = props.appointment?.visit?.roomId
  return id ? localized(roomById(id)?.name) : t('reception.floor.noRoom')
})

const clock = (wall: string): string => formatWallTime(wall, locale.value)

/** Once the visit is over, the record is history: there is nothing left to act on. */
const visitFinished = computed(() => props.appointment?.visit?.stage === 'finished')

const finishVisit = async (): Promise<void> => {
  if (!props.appointment) return
  await schedule.finishVisit(props.appointment.id, {
    expectedVersion: props.appointment.version
  })
}

const complete = async (): Promise<void> => {
  if (!props.appointment) return
  await schedule.setAttendance(props.appointment.id, 'completed', {
    expectedVersion: props.appointment.version
  })
}
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
        <button
          class="panel__close"
          type="button"
          :aria-label="t('reception.detail.close')"
          @click="emit('close')"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </header>

      <div class="panel__scroll">
        <div class="panel__states">
          <StatusPill kind="appointment" :status="appointment.status" />
          <StatusPill kind="curemd" :status="appointment.curemd.status" />
        </div>

        <!-- The one thing reception still has to do by hand. -->
        <section v-if="task" class="todo">
          <h3 class="todo__title">{{ t(`reception.curemd.task.${task}`) }}</h3>
          <p class="todo__body">{{ t(`reception.curemd.taskBody.${task}`) }}</p>
          <AppButton
            size="sm"
            icon-left="database"
            @click="emit('curemd', { task, appointment })"
          >
            {{ t(`reception.curemd.dialog.${task}.action`) }}
          </AppButton>
        </section>

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
            <dd>{{ localized(service?.name) }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.clinic') }}</dt>
            <dd>{{ localized(location?.name) }}</dd>
          </div>
          <div>
            <dt>{{ isRequest ? t('reception.detail.requestedTime') : t('reception.detail.when') }}</dt>
            <dd>{{ whenLabel }}</dd>
          </div>
          <div>
            <dt>{{ t('confirmation.payment') }}</dt>
            <dd>{{ t(`reception.coverage.${appointment.patient.coverage || 'self-pay'}`) }}</dd>
          </div>
        </dl>

        <!-- What reception says is in CureMD, kept apart from what is proposed. -->
        <section class="block">
          <h3 class="panel__heading">{{ t('reception.curemd.title') }}</h3>
          <dl class="panel__rows">
            <div v-if="registered">
              <dt>{{ t('reception.curemd.currentTime') }}</dt>
              <dd>{{ moment(registered.startWall) }}</dd>
            </div>
            <div v-if="appointment.pendingChange">
              <dt>{{ t('reception.curemd.newTime') }}</dt>
              <dd class="pending">{{ moment(appointment.pendingChange.startWall) }}</dd>
            </div>
            <div v-if="appointment.curemd.reference">
              <dt>{{ t('reception.curemd.reference') }}</dt>
              <dd>{{ appointment.curemd.reference }}</dd>
            </div>
            <div v-if="appointment.curemd.declaredAtWall">
              <dt>{{ t('reception.curemd.declaredBy') }}</dt>
              <dd>
                {{ appointment.curemd.operator }}
                <span class="muted">· {{ moment(appointment.curemd.declaredAtWall) }}</span>
              </dd>
            </div>
            <div v-if="!registered && !appointment.pendingChange">
              <dt>{{ t('reception.curemd.title') }}</dt>
              <dd class="muted">{{ t('reception.curemd.nothingYet') }}</dd>
            </div>
          </dl>
        </section>

        <!-- An alternative put to the patient, waiting on them. -->
        <section v-if="appointment.proposal" class="block proposal">
          <h3 class="panel__heading">{{ t('reception.detail.proposed') }}</h3>
          <p class="proposal__when">{{ moment(appointment.proposal.startWall) }}</p>
          <p class="proposal__body">{{ t('reception.detail.proposedBody') }}</p>
          <AppButton size="sm" variant="secondary" :loading="schedule.working" @click="acceptProposal">
            {{ t('reception.detail.simulateAccept') }}
          </AppButton>
        </section>

        <!-- Where the patient has got to inside the building. A third state, kept apart
             from the appointment status and from the CureMD record above. -->
        <section v-if="appointment.visit" class="block visit">
          <h3 class="panel__heading">{{ t('reception.floor.title') }}</h3>
          <dl class="panel__rows">
            <div>
              <dt>{{ t('reception.floor.stageLabel') }}</dt>
              <dd>{{ t(`reception.stage.${appointment.visit.stage}`) }}</dd>
            </div>
            <div v-if="appointment.visit.stage === 'in-clinic'">
              <dt>{{ t('reception.floor.roomLabel') }}</dt>
              <dd>{{ roomLabel }}</dd>
            </div>
            <div>
              <dt>{{ t('reception.floor.arrivedLabel') }}</dt>
              <dd>{{ clock(appointment.visit.arrivedAtWall) }} · {{ appointment.visit.arrivedBy }}</dd>
            </div>
            <div v-if="appointment.visit.leftAtWall">
              <dt>{{ t('reception.floor.leftLabel') }}</dt>
              <dd>{{ clock(appointment.visit.leftAtWall) }}</dd>
            </div>
            <div v-if="appointment.visit.printsRequested">
              <dt>{{ t('reception.floor.printsLabel') }}</dt>
              <dd>{{ t('reception.floor.printsValue', { count: appointment.visit.printsRequested }) }}</dd>
            </div>
          </dl>
          <p class="panel__caveat">{{ t('reception.floor.panelNote') }}</p>
        </section>

        <section class="block">
          <h3 class="panel__heading">{{ t('reception.detail.actions') }}</h3>

          <!-- The visit is over. Nothing about this appointment is still to be decided, so
               the only thing left worth offering is the next appointment. -->
          <template v-if="visitFinished">
            <p class="panel__caveat">{{ t('reception.detail.finishedNote') }}</p>
            <div class="panel__actions">
              <AppButton :to="{ name: 'book' }" icon-left="calendar">
                {{ t('reception.detail.bookAnother') }}
              </AppButton>
            </div>
          </template>

          <div v-else class="panel__actions">
            <AppButton
              v-if="isRequest"
              variant="secondary"
              icon-left="calendar-clock"
              @click="emit('propose', appointment)"
            >
              {{ t('reception.detail.proposeAlternative') }}
            </AppButton>
            <AppButton
              v-if="!isClosed"
              variant="secondary"
              icon-left="calendar-clock"
              @click="emit('reschedule', appointment)"
            >
              {{ t('reception.detail.reschedule') }}
            </AppButton>
            <AppButton
              v-if="canArrive"
              variant="secondary"
              icon-left="log-in"
              @click="emit('arrival', appointment)"
            >
              {{ t('reception.arrival.action') }}
            </AppButton>
            <AppButton
              v-if="appointment.visit"
              variant="secondary"
              icon-left="printer"
              @click="emit('slip', appointment)"
            >
              {{ t('reception.floor.printSlip') }}
            </AppButton>
            <AppButton
              v-if="appointment.visit"
              :loading="schedule.working"
              @click="finishVisit"
            >
              {{ t('reception.floor.finishVisit') }}
            </AppButton>
            <AppButton
              v-if="!appointment.visit && appointment.status === 'arrived'"
              variant="secondary"
              icon-left="check-circle"
              :loading="schedule.working"
              @click="complete"
            >
              {{ t('reception.status.completed') }}
            </AppButton>
            <AppButton
              v-if="isRequest"
              variant="critical"
              icon-left="ban"
              :loading="schedule.working"
              @click="markUnavailable"
            >
              {{ t('reception.detail.markUnavailable') }}
            </AppButton>
            <AppButton
              v-if="!isClosed && appointment.curemd.status !== 'cancellation-pending'"
              variant="critical"
              icon-left="ban"
              @click="askCancel = true"
            >
              {{ t('reception.detail.cancel') }}
            </AppButton>
          </div>
        </section>

        <!-- Who declared what, and when. -->
        <section class="block">
          <h3 class="panel__heading">{{ t('reception.detail.history') }}</h3>
          <ol class="trail">
            <li v-for="entry in appointment.audit.slice(0, 8)" :key="entry.id">
              <span class="trail__when">{{ formatWallTime(entry.atWall, locale) }}</span>
              <span class="trail__what">
                {{ t(`reception.audit.${entry.kind}`) }}
                <span class="muted">· {{ entry.operator }}</span>
              </span>
            </li>
          </ol>
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
            t(
              appointment.curemd.status === 'pending-registration'
                ? 'reception.detail.cancelBodyRequest'
                : 'reception.detail.cancelBodyRegistered',
              {
                patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
                when: whenLabel
              }
            )
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
  /* Nothing may paint past the rounded corners, however long the record gets. */
  overflow: hidden;
  outline: none;
  max-height: calc(100vh - var(--s8));
  position: sticky;
  top: var(--s4);
}

.panel__head {
  display: flex;
  flex: none;
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

/*
 * The scrolling part of the record.
 *
 * `min-height: 0` is what makes it scroll at all: a flex item defaults to `min-height:
 * auto`, so without this it refuses to shrink below its content and the panel grows past
 * its own max-height, spilling the rest of the record outside the card.
 */
.panel__scroll {
  flex: 1;
  min-height: 0;
  padding: var(--s5);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.panel__states {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.todo {
  margin-top: var(--s4);
  padding: var(--s4);
  border: 1px solid var(--caution-bg);
  border-left: 3px solid var(--caution-fg);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
}

.todo__title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--caution-fg);
}

.todo__body {
  margin: var(--s1) 0 var(--s3);
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--caution-fg);
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

.pending {
  color: var(--critical-fg) !important;
}

.muted {
  color: var(--navy-400);
  font-weight: 400;
}

.block {
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

.panel__caveat {
  margin-top: var(--s3);
  font-size: var(--text-2xs);
  line-height: 1.5;
  color: var(--text-soft);
}

.proposal__when {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-800);
}

.proposal__body {
  margin: var(--s1) 0 var(--s3);
  font-size: var(--text-xs);
  color: var(--navy-400);
}

.panel__actions {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.trail {
  list-style: none;
  padding: 0;
  margin: 0;
}

.trail li {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: var(--s2);
  padding-block: var(--s2);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-xs);
}

.trail li:last-child {
  border-bottom: none;
}

.trail__when {
  font-variant-numeric: tabular-nums;
  color: var(--navy-200);
}

.trail__what {
  color: var(--navy-600);
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

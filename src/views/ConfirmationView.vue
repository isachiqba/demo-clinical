<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { providerById } from '@/data/providers'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { downloadIcs } from '@/services/calendarFile'
import {
  addMinutesToWall,
  formatWallDate,
  formatWallTime,
  zoneAbbreviation
} from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Locale } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import WaitlistDialog from '@/components/waitlist/WaitlistDialog.vue'

const { t, locale } = useI18n()
const route = useRoute()
const schedule = useScheduleStore()

const askCancel = ref(false)
const waitlistOpen = ref(false)
const askLeave = ref(false)

onMounted(() => void schedule.ensureLoaded())

/** The patient's own waitlist entry for this booking, if they asked to be told. */
const waitlistEntry = computed(() =>
  schedule.waitlist.find(
    (entry) =>
      entry.linkedAppointmentId === appointment.value?.id &&
      entry.status !== 'withdrawn' &&
      entry.status !== 'accepted'
  )
)

const waitlistPreset = computed(() => ({
  serviceId: appointment.value?.serviceId ?? null,
  locationId: appointment.value?.locationId ?? null,
  providerId: appointment.value?.providerId ?? null,
  patient: appointment.value?.patient,
  linkedAppointmentId: appointment.value?.id ?? null,
  // Only something before the appointment they already hold is of any use.
  untilKey: appointment.value ? appointment.value.startWall.slice(0, 10) : undefined
}))

const leaveWaitlist = async (): Promise<void> => {
  const entry = waitlistEntry.value
  if (entry) await schedule.withdrawFromWaitlist(entry.id)
  askLeave.value = false
}

const appointment = computed(() => schedule.byReference(String(route.params.reference)))
const service = computed(() => serviceById(appointment.value?.serviceId ?? ''))
const provider = computed(() => providerById(appointment.value?.providerId ?? ''))
const location = computed(() => locationById(appointment.value?.locationId ?? ''))

const whenLong = computed(() => {
  const current = appointment.value
  if (!current) return ''
  const end = addMinutesToWall(current.startWall, current.durationMinutes)
  return `${formatWallDate(current.startWall, locale.value)}, ${formatWallTime(current.startWall, locale.value)}–${formatWallTime(end, locale.value)} (${zoneAbbreviation(current.startWall)})`
})

const cancelled = computed(() => appointment.value?.status === 'cancelled')

const confirmCancel = async (): Promise<void> => {
  if (appointment.value) await schedule.cancel(appointment.value.id)
  askCancel.value = false
}

const saveIcs = (): void => {
  if (appointment.value) downloadIcs(appointment.value, locale.value as Locale)
}
</script>

<template>
  <div class="wrap">
    <div class="page-width page-width--narrow">
      <template v-if="appointment">
        <AppBadge tone="caution">{{ t('confirmation.simulated') }}</AppBadge>

        <h1 class="title">{{ t('confirmation.title') }}</h1>
        <p class="body">{{ t('confirmation.body') }}</p>

        <article class="ticket" :class="{ 'ticket--off': cancelled }">
          <header class="ticket__head">
            <div>
              <p class="ticket__label">{{ t('confirmation.reference') }}</p>
              <p class="ticket__ref">{{ appointment.reference }}</p>
            </div>
            <AppBadge :tone="cancelled ? 'critical' : 'positive'">
              {{ t(`reception.status.${appointment.status}`) }}
            </AppBadge>
          </header>

          <dl class="ticket__rows">
            <div>
              <dt>{{ t('confirmation.appointment') }}</dt>
              <dd>
                {{ localized(service?.name) }}
                <span class="muted">· {{ t('common.minutes', { count: appointment.durationMinutes }) }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ t('confirmation.when') }}</dt>
              <dd>{{ whenLong }}</dd>
            </div>
            <div>
              <dt>{{ t('confirmation.clinician') }}</dt>
              <dd>{{ provider?.name }}</dd>
            </div>
            <div>
              <dt>{{ t('confirmation.clinic') }}</dt>
              <dd>
                {{ localized(location?.name) }}
                <span class="muted">· {{ location?.phone }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ t('confirmation.patient') }}</dt>
              <dd>
                {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
                <span class="muted">· {{ t(`reception.patientType.${appointment.patientType}`) }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ t('confirmation.payment') }}</dt>
              <dd>{{ t(`reception.coverage.${appointment.patient.coverage || 'self-pay'}`) }}</dd>
            </div>
          </dl>
        </article>

        <p v-if="cancelled" class="cancelled" role="status">
          <AppIcon name="info" :size="18" />
          <span>{{ t('confirmation.cancelled') }}</span>
        </p>

        <div class="actions">
          <AppButton v-if="!cancelled" icon-left="download" @click="saveIcs">
            {{ t('confirmation.addToCalendar') }}
          </AppButton>
          <AppButton v-if="!cancelled" variant="critical" icon-left="ban" @click="askCancel = true">
            {{ t('confirmation.manage') }}
          </AppButton>
          <AppButton variant="secondary" :to="{ name: 'book' }">
            {{ t('confirmation.bookAnother') }}
          </AppButton>
        </div>

        <p v-if="!cancelled" class="fineprint ics-note">{{ t('confirmation.calendarNote') }}</p>

        <section v-if="!cancelled" class="sooner">
          <template v-if="waitlistEntry">
            <h2 class="sooner__title">
              <AppIcon name="check-circle" :size="19" />
              <span>{{ t('waitlist.onList') }}</span>
            </h2>
            <p class="sooner__body">
              {{ t('waitlist.onListLinked', { reference: waitlistEntry.reference }) }}
            </p>
            <AppButton variant="secondary" size="sm" @click="askLeave = true">
              {{ t('waitlist.leave') }}
            </AppButton>
          </template>

          <template v-else>
            <h2 class="sooner__title">{{ t('waitlist.triggerAfterBooking') }}</h2>
            <p class="sooner__body">{{ t('waitlist.linkedLede') }}</p>
            <AppButton variant="secondary" icon-left="users" @click="waitlistOpen = true">
              {{ t('waitlist.trigger') }}
            </AppButton>
          </template>
        </section>

        <div class="reception-link">
          <AppButton
            variant="secondary"
            icon-left="calendar-clock"
            :to="{ name: 'reception', query: { ref: appointment.reference } }"
          >
            {{ t('confirmation.openReception') }}
          </AppButton>
        </div>
      </template>

      <template v-else-if="schedule.ready">
        <h1 class="title">{{ t('confirmation.notFound') }}</h1>
        <p class="body">{{ t('confirmation.notFoundBody') }}</p>
        <div class="actions">
          <AppButton :to="{ name: 'book' }">{{ t('nav.book') }}</AppButton>
          <AppButton variant="secondary" :to="{ name: 'home' }">{{ t('notFound.action') }}</AppButton>
        </div>
      </template>

      <p v-else class="body">{{ t('common.loading') }}</p>
    </div>

    <WaitlistDialog
      :open="waitlistOpen"
      :preset="waitlistPreset"
      @close="waitlistOpen = false"
      @joined="waitlistOpen = false"
    />

    <AppDialog
      :open="askLeave"
      :title="t('waitlist.leaveTitle')"
      :close-label="t('common.close')"
      @close="askLeave = false"
    >
      <p>{{ t('waitlist.leaveBody') }}</p>
      <template #actions>
        <AppButton variant="critical" :loading="schedule.working" @click="leaveWaitlist">
          {{ t('waitlist.leaveConfirm') }}
        </AppButton>
        <AppButton variant="secondary" @click="askLeave = false">{{ t('common.cancel') }}</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      :open="askCancel"
      :title="t('confirmation.cancelTitle')"
      :close-label="t('common.close')"
      @close="askCancel = false"
    >
      <p v-if="appointment">
        {{ t('confirmation.cancelBody', { service: localized(service?.name), when: whenLong }) }}
      </p>
      <template #actions>
        <AppButton variant="critical" :loading="schedule.working" @click="confirmCancel">
          {{ t('confirmation.cancelConfirm') }}
        </AppButton>
        <AppButton variant="secondary" @click="askCancel = false">{{ t('common.keep') }}</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.wrap {
  padding-block: var(--s9) var(--s10);
  background: var(--sage-50);
}

.title {
  margin-top: var(--s4);
  font-size: var(--text-4xl);
}

.body {
  margin-top: var(--s4);
  max-width: 58ch;
  color: var(--navy-600);
  line-height: 1.65;
}

.ticket {
  margin-top: var(--s7);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.ticket--off {
  opacity: 0.72;
}

.ticket__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  padding: var(--s5) var(--s6);
  background: var(--navy-800);
  color: #fff;
}

.ticket__label {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.ticket__ref {
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-2xl);
  letter-spacing: 0.06em;
}

.ticket__rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s5);
  margin: 0;
  padding: var(--s6);
}

.ticket__rows dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.ticket__rows dd {
  margin: var(--s1) 0 0;
  font-weight: 500;
  color: var(--navy-800);
  line-height: 1.45;
}

.muted {
  color: var(--navy-400);
  font-weight: 400;
}

.cancelled {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  margin-top: var(--s5);
  padding: var(--s4);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s6);
}

.ics-note {
  margin-top: var(--s3);
}

.sooner {
  margin-top: var(--s7);
  padding: var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.sooner__title {
  display: flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--text-lg);
  color: var(--navy-800);
}

.sooner__body {
  margin: var(--s2) 0 var(--s4);
  max-width: 58ch;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

.reception-link {
  margin-top: var(--s6);
  padding-top: var(--s6);
  border-top: 1px solid var(--border);
}

@media (max-width: 620px) {
  .ticket__rows {
    grid-template-columns: 1fr;
    gap: var(--s4);
    padding: var(--s5);
  }

  .ticket__head {
    padding: var(--s4) var(--s5);
  }

  .actions > * {
    width: 100%;
  }
}
</style>

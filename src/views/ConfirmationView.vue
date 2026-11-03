<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { canExportIcs, downloadIcs } from '@/services/calendarFile'
import { formatWallDate, formatWallTime, zoneAbbreviation } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Locale } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import WaitlistDialog from '@/components/waitlist/WaitlistDialog.vue'

/**
 * What the patient sees after asking for a time.
 *
 * It is careful never to call a request an appointment: the clinic has to check its own
 * diary in CureMD first. Nothing is sent to the patient either, and the page says so.
 */
const { t, locale } = useI18n()
const route = useRoute()
const schedule = useScheduleStore()

const askCancel = ref(false)
const waitlistOpen = ref(false)
const askLeave = ref(false)

onMounted(() => void schedule.ensureLoaded())

const appointment = computed(() => schedule.byReference(String(route.params.reference)))
const service = computed(() => serviceById(appointment.value?.serviceId ?? ''))
const location = computed(() => locationById(appointment.value?.locationId ?? ''))

const status = computed(() => appointment.value?.status ?? 'requested')
const isRequest = computed(() => status.value === 'requested')
const isConfirmed = computed(
  () => status.value === 'confirmed' || status.value === 'arrived' || status.value === 'completed'
)
const isClosed = computed(() => status.value === 'cancelled' || status.value === 'unavailable')

/** A move the clinic has agreed but not yet put into CureMD is not the patient's time yet. */
const changePending = computed(() => Boolean(appointment.value?.pendingChange))
const cancellationPending = computed(
  () => appointment.value?.curemd.status === 'cancellation-pending'
)

const whenLong = computed(() => {
  const current = appointment.value
  if (!current) return ''
  return `${formatWallDate(current.startWall, locale.value)}, ${formatWallTime(current.startWall, locale.value)} (${zoneAbbreviation(current.startWall)})`
})

const headline = computed(() => {
  if (isClosed.value) return t(`confirmation.headline.${status.value}`)
  if (cancellationPending.value) return t('confirmation.headline.cancellationPending')
  if (changePending.value) return t('confirmation.headline.changePending')
  if (isConfirmed.value) return t('confirmation.headline.confirmed')
  return t('confirmation.headline.requested')
})

const body = computed(() => {
  if (isClosed.value) return t(`confirmation.body.${status.value}`)
  if (cancellationPending.value) return t('confirmation.body.cancellationPending')
  if (changePending.value) return t('confirmation.body.changePending')
  if (isConfirmed.value) return t('confirmation.body.confirmed')
  return t('confirmation.body.requested')
})

const tone = computed(() => {
  if (isClosed.value) return 'neutral'
  if (isConfirmed.value && !changePending.value && !cancellationPending.value) return 'positive'
  return 'caution'
})

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
  patient: appointment.value?.patient,
  linkedAppointmentId: appointment.value?.id ?? null,
  untilKey: appointment.value ? appointment.value.startWall.slice(0, 10) : undefined
}))

const leaveWaitlist = async (): Promise<void> => {
  const entry = waitlistEntry.value
  if (entry) await schedule.withdrawFromWaitlist(entry.id)
  askLeave.value = false
}

const confirmCancel = async (): Promise<void> => {
  if (appointment.value) await schedule.requestCancellation(appointment.value.id)
  askCancel.value = false
}

const canDownload = computed(() => (appointment.value ? canExportIcs(appointment.value) : false))

const saveIcs = (): void => {
  if (appointment.value) downloadIcs(appointment.value, locale.value as Locale)
}
</script>

<template>
  <div class="wrap">
    <div class="page-width page-width--narrow">
      <template v-if="appointment">
        <AppBadge :tone="tone">{{ t(`confirmation.state.${status}`) }}</AppBadge>

        <h1 class="title">{{ headline }}</h1>
        <p class="body">{{ body }}</p>
        <p class="body body--quiet">{{ t('confirmation.nothingSent') }}</p>

        <article class="ticket" :class="{ 'ticket--off': isClosed }">
          <header class="ticket__head">
            <div>
              <p class="ticket__label">{{ t('confirmation.reference') }}</p>
              <p class="ticket__ref">{{ appointment.reference }}</p>
            </div>
          </header>

          <dl class="ticket__rows">
            <div>
              <dt>{{ t('confirmation.appointment') }}</dt>
              <dd>{{ localized(service?.name) }}</dd>
            </div>
            <div>
              <dt>{{ isRequest ? t('confirmation.requestedTime') : t('confirmation.when') }}</dt>
              <dd>{{ whenLong }}</dd>
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
              <dd>{{ appointment.patient.firstName }} {{ appointment.patient.lastName }}</dd>
            </div>
          </dl>

          <p v-if="changePending && appointment.pendingChange" class="ticket__change">
            <AppIcon name="calendar-clock" :size="17" />
            <span>
              {{
                t('confirmation.changeProposed', {
                  when: `${formatWallDate(appointment.pendingChange.startWall, locale)}, ${formatWallTime(appointment.pendingChange.startWall, locale)}`
                })
              }}
            </span>
          </p>
        </article>

        <div class="actions">
          <AppButton v-if="canDownload" icon-left="download" @click="saveIcs">
            {{ t('confirmation.addToCalendar') }}
          </AppButton>
          <AppButton
            v-if="!isClosed && !cancellationPending"
            variant="critical"
            icon-left="ban"
            @click="askCancel = true"
          >
            {{ isRequest ? t('confirmation.cancelRequest') : t('confirmation.cancelAppointment') }}
          </AppButton>
          <AppButton variant="secondary" :to="{ name: 'book' }">
            {{ t('confirmation.bookAnother') }}
          </AppButton>
        </div>

        <p v-if="canDownload" class="fineprint ics-note">{{ t('confirmation.calendarNote') }}</p>
        <p v-else-if="!isClosed" class="fineprint ics-note">{{ t('confirmation.calendarLater') }}</p>

        <section v-if="!isClosed" class="sooner">
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
            icon-left="log-in"
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
      :title="isRequest ? t('confirmation.cancelRequestTitle') : t('confirmation.cancelTitle')"
      :close-label="t('common.close')"
      @close="askCancel = false"
    >
      <p v-if="appointment">
        {{
          t(isRequest ? 'confirmation.cancelRequestBody' : 'confirmation.cancelBody', {
            service: localized(service?.name),
            when: whenLong
          })
        }}
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

.body--quiet {
  margin-top: var(--s2);
  font-size: var(--text-sm);
  color: var(--text-soft);
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

.ticket__change {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  padding: var(--s4) var(--s6);
  border-top: 1px solid var(--border);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.muted {
  color: var(--navy-400);
  font-weight: 400;
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

  .actions > * {
    width: 100%;
  }
}
</style>

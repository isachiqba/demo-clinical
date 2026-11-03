<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, CuremdTask } from '@/types'
import { DEMO_OPERATOR } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Recording, by hand, that something has been done in CureMD.
 *
 * The dialog sends nothing anywhere. It shows the operator exactly what they should have
 * typed into the other system, asks them to confirm they did it, and writes that
 * declaration down with their name and the time. It also carries the version of the
 * appointment it was opened on: if anything changed underneath, the write is refused and
 * the operator is asked to look again.
 */
const props = defineProps<{
  open: boolean
  task: CuremdTask | null
  appointment: Appointment | null
}>()

const emit = defineEmits<{ close: []; done: [] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const reference = ref('')
const confirmed = ref(false)
const alsoConfirm = ref(true)
const note = ref('')
const errorKey = ref<string | null>(null)
/** The version this dialog is looking at. */
const openedVersion = ref(0)

watch(
  () => [props.open, props.appointment?.id],
  () => {
    if (!props.open || !props.appointment) return
    reference.value = props.appointment.curemd.reference ?? ''
    confirmed.value = false
    alsoConfirm.value = props.task === 'registration'
    note.value = ''
    errorKey.value = null
    openedVersion.value = props.appointment.version
  },
  { immediate: true }
)

/** True once the record moved under the dialog; the operator has to re-read it. */
const outOfDate = computed(
  () => Boolean(props.appointment) && props.appointment!.version !== openedVersion.value
)

const service = computed(() => localized(serviceById(props.appointment?.serviceId ?? '')?.name))

/** What the operator should be typing into CureMD: the new time for a change. */
const target = computed(() => {
  const appointment = props.appointment
  if (!appointment) return null
  if (props.task === 'change' && appointment.pendingChange) {
    return {
      startWall: appointment.pendingChange.startWall,
      locationId: appointment.pendingChange.locationId
    }
  }
  return { startWall: appointment.startWall, locationId: appointment.locationId }
})

const targetLabel = computed(() =>
  target.value
    ? `${formatWallDate(target.value.startWall, locale.value)}, ${formatWallTime(target.value.startWall, locale.value)}`
    : ''
)

const targetClinic = computed(() =>
  target.value ? localized(locationById(target.value.locationId)?.name) : ''
)

/** For a change, what reception says is in CureMD at the moment. */
const currentlyRegistered = computed(() => {
  const registered = props.appointment?.curemd.registered
  if (!registered) return null
  return {
    when: `${formatWallDate(registered.startWall, locale.value)}, ${formatWallTime(registered.startWall, locale.value)}`,
    clinic: localized(locationById(registered.locationId)?.name)
  }
})

const title = computed(() =>
  props.task ? t(`reception.curemd.dialog.${props.task}.title`) : ''
)

const submit = async (): Promise<void> => {
  const appointment = props.appointment
  if (!appointment || !props.task || !confirmed.value) return
  errorKey.value = null

  const guard = { expectedVersion: openedVersion.value }
  const result =
    props.task === 'registration'
      ? await schedule.declareRegistration(appointment.id, {
          ...guard,
          curemdReference: reference.value,
          confirmNow: alsoConfirm.value,
          note: note.value.trim() || undefined
        })
      : props.task === 'change'
        ? await schedule.declareChangeApplied(appointment.id, {
            ...guard,
            curemdReference: reference.value
          })
        : await schedule.declareCancellationDone(appointment.id, guard)

  if (!result.ok) {
    errorKey.value =
      result.reason === 'stale'
        ? 'reception.curemd.dialog.stale'
        : 'reception.curemd.dialog.failed'
    return
  }
  emit('done')
}
</script>

<template>
  <AppDialog :open="open" :title="title" :close-label="t('common.close')" @close="emit('close')">
    <template v-if="appointment && task">
      <p class="lede">{{ t(`reception.curemd.dialog.${task}.lede`) }}</p>

      <p class="notice">
        <AppIcon name="info" :size="17" />
        <span>{{ t('reception.curemd.dialog.noData') }}</span>
      </p>

      <section class="what">
        <h3 class="what__title">{{ t('reception.curemd.dialog.whatToEnter') }}</h3>
        <dl class="what__rows">
          <div>
            <dt>{{ t('reception.detail.patient') }}</dt>
            <dd>{{ appointment.patient.firstName }} {{ appointment.patient.lastName }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.appointment') }}</dt>
            <dd>{{ service }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.detail.clinic') }}</dt>
            <dd>{{ targetClinic }}</dd>
          </div>
          <div>
            <dt>{{ task === 'change' ? t('reception.curemd.newTime') : t('reception.detail.when') }}</dt>
            <dd class="what__strong">{{ targetLabel }}</dd>
          </div>
        </dl>

        <p v-if="task === 'change' && currentlyRegistered" class="what__was">
          {{
            t('reception.curemd.currentlyRegistered', {
              when: currentlyRegistered.when,
              clinic: currentlyRegistered.clinic
            })
          }}
        </p>
      </section>

      <AppField
        v-if="task !== 'cancellation'"
        v-slot="{ id }"
        :label="t('reception.curemd.dialog.reference')"
        :hint="t('reception.curemd.dialog.referenceHint')"
        :optional-label="t('common.optional')"
      >
        <input :id="id" v-model="reference" type="text" autocomplete="off" />
      </AppField>

      <AppField
        v-if="task === 'registration'"
        v-slot="{ id }"
        :label="t('reception.curemd.dialog.note')"
        :optional-label="t('common.optional')"
      >
        <input :id="id" v-model="note" type="text" maxlength="120" />
      </AppField>

      <label class="check">
        <input v-model="confirmed" type="checkbox" />
        <span>{{ t(`reception.curemd.dialog.${task}.confirm`) }}</span>
      </label>

      <label v-if="task === 'registration'" class="check check--quiet">
        <input v-model="alsoConfirm" type="checkbox" />
        <span>{{ t('reception.curemd.dialog.alsoConfirm') }}</span>
      </label>

      <p class="operator">
        {{ t('reception.curemd.dialog.operator', { name: DEMO_OPERATOR.name }) }}
      </p>

      <p v-if="outOfDate" class="warn" role="alert">
        <AppIcon name="alert-circle" :size="17" />
        <span>{{ t('reception.curemd.dialog.changedUnderneath') }}</span>
      </p>

      <p v-if="errorKey" class="warn" role="alert">
        <AppIcon name="alert-circle" :size="17" />
        <span>{{ t(errorKey) }}</span>
      </p>
    </template>

    <template #actions>
      <AppButton
        :disabled="!confirmed || outOfDate"
        :loading="schedule.working"
        icon-right="check"
        @click="submit"
      >
        {{ task ? t(`reception.curemd.dialog.${task}.action`) : '' }}
      </AppButton>
      <AppButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.lede {
  font-size: var(--text-sm);
  line-height: 1.55;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.what {
  margin-top: var(--s5);
  padding: var(--s4) var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--paper);
}

.what__title {
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.what__rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
  margin: var(--s3) 0 0;
}

.what__rows dt {
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.what__rows dd {
  margin: 1px 0 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--navy-800);
}

.what__strong {
  font-weight: 700 !important;
}

.what__was {
  margin-top: var(--s3);
  padding-top: var(--s3);
  border-top: 1px dashed var(--border-strong);
  font-size: var(--text-xs);
  color: var(--navy-400);
}

.check {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  margin-top: var(--s5);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--navy-800);
  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  flex: none;
  accent-color: var(--teal-600);
}

.check--quiet {
  margin-top: var(--s3);
  color: var(--navy-600);
}

.operator {
  margin-top: var(--s4);
  font-size: var(--text-2xs);
  color: var(--text-soft);
}

.warn {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--critical-bg);
  color: var(--critical-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

@media (max-width: 520px) {
  .what__rows {
    grid-template-columns: 1fr;
  }
}
</style>

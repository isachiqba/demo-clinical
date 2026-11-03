<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { HOLD_MINUTES } from '@/services/schedulingApi'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Offer, Opening, WaitlistEntry } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Offering a freed slot to one waiting patient.
 *
 * The preview is what the patient would read, in their own language. Nothing is sent —
 * there is no patient to send it to — so the answer is simulated instead, from controls
 * kept visibly apart from the ordinary front-desk actions.
 */
const props = defineProps<{
  open: boolean
  opening: Opening | null
  entry: WaitlistEntry | null
  offer: Offer | null
}>()

const emit = defineEmits<{ close: []; changed: [] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const resultKey = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) resultKey.value = null
  }
)

const slot = computed(() => props.offer?.slot ?? props.opening?.slot ?? null)
const patientLanguage = computed(() => props.entry?.preferences.language ?? 'en')

/** The message is written in the patient's language, not the receptionist's. */
const say = (key: string, params: Record<string, unknown> = {}): string =>
  t(key, params, { locale: patientLanguage.value })

const patientName = computed(() =>
  props.entry ? `${props.entry.patient.firstName} ${props.entry.patient.lastName}` : ''
)

const clinicName = computed(() => (slot.value ? localized(locationById(slot.value.locationId)?.name) : ''))

const messageDetails = computed(() => {
  const current = slot.value
  if (!current) return ''
  return say('reception.offer.details', {
    service: serviceById(current.serviceId)?.name[patientLanguage.value] ?? '',
    date: formatWallDate(current.startWall, patientLanguage.value),
    time: formatWallTime(current.startWall, patientLanguage.value)
  })
})

const replacedAppointment = computed(() => {
  const id = props.entry?.linkedAppointmentId
  return id ? schedule.byId(id) : undefined
})

const holdLabel = computed(() =>
  props.offer ? formatWallTime(props.offer.holdUntilWall, locale.value) : ''
)

const sendOffer = async (): Promise<void> => {
  if (!props.opening || !props.entry) return
  const result = await schedule.offerOpening(props.opening.id, props.entry.id)
  if (!result.ok) {
    resultKey.value = `reception.offer.result.${result.reason === 'slot-taken' ? 'slotTaken' : 'closed'}`
    return
  }
  emit('changed')
}

const respond = async (response: 'accept' | 'decline' | 'expire'): Promise<void> => {
  if (!props.offer) return
  const swap = Boolean(replacedAppointment.value)
  const result = await schedule.respondToOffer(props.offer.id, response)

  if (!result.ok) {
    resultKey.value = `reception.offer.result.${result.reason === 'slot-taken' ? 'slotTaken' : 'closed'}`
    return
  }

  resultKey.value =
    response === 'accept'
      ? swap
        ? 'reception.offer.result.acceptedSwap'
        : 'reception.offer.result.accepted'
      : response === 'decline'
        ? 'reception.offer.result.declined'
        : 'reception.offer.result.expired'
  emit('changed')
}

const pending = computed(() => props.offer?.status === 'pending')
const settled = computed(() => Boolean(props.offer) && !pending.value)
</script>

<template>
  <AppDialog
    :open="open"
    :title="t('reception.offer.title')"
    :close-label="t('common.close')"
    @close="emit('close')"
  >
    <template v-if="slot && entry">
      <article class="message">
        <header class="message__head">
          <AppBadge tone="caution">{{ t('reception.offer.simulated') }}</AppBadge>
          <span class="message__to">{{ t('reception.offer.to', { name: patientName }) }}</span>
        </header>

        <p class="message__line">{{ say('reception.offer.greeting', { name: entry.patient.firstName }) }}</p>
        <p class="message__line">{{ say('reception.offer.body', { clinic: clinicName }) }}</p>
        <p class="message__details">{{ messageDetails }}</p>
        <p v-if="replacedAppointment" class="message__line">
          {{
            say('reception.offer.replaces', {
              when: formatWallDate(replacedAppointment.startWall, patientLanguage)
            })
          }}
        </p>

        <div class="message__actions" aria-hidden="true">
          <span class="message__button message__button--primary">{{ say('reception.offer.accept') }}</span>
          <span class="message__button">{{ say('reception.offer.decline') }}</span>
        </div>

        <p v-if="pending" class="message__hold">
          {{ say('reception.offer.holdUntil', { time: holdLabel }) }}
        </p>
      </article>

      <p class="explain">
        <AppIcon name="info" :size="16" />
        <span>{{ t('reception.offer.explain') }}</span>
      </p>

      <section v-if="pending" class="simulate">
        <h3 class="simulate__title">{{ t('reception.offer.simulate.title') }}</h3>
        <p class="simulate__lede">{{ t('reception.offer.simulate.lede') }}</p>
        <div class="simulate__actions">
          <AppButton size="sm" :loading="schedule.working" @click="respond('accept')">
            {{ t('reception.offer.simulate.accept') }}
          </AppButton>
          <AppButton size="sm" variant="secondary" :disabled="schedule.working" @click="respond('decline')">
            {{ t('reception.offer.simulate.decline') }}
          </AppButton>
          <AppButton size="sm" variant="secondary" :disabled="schedule.working" @click="respond('expire')">
            {{ t('reception.offer.simulate.expire') }}
          </AppButton>
        </div>
      </section>

      <p v-if="resultKey" class="result" :class="{ 'result--bad': resultKey.includes('slotTaken') || resultKey.includes('closed') }" role="status">
        {{ t(resultKey) }}
      </p>
    </template>

    <template #actions>
      <AppButton
        v-if="!offer"
        :loading="schedule.working"
        icon-right="arrow-right"
        @click="sendOffer"
      >
        {{ t('reception.offer.send') }}
      </AppButton>
      <AppButton variant="secondary" @click="emit('close')">
        {{ settled ? t('common.close') : t('common.cancel') }}
      </AppButton>
      <p v-if="!offer" class="hold-note">
        {{ t('reception.offer.sendBody', { minutes: HOLD_MINUTES }) }}
      </p>
    </template>
  </AppDialog>
</template>

<style scoped>
.message {
  padding: var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--paper);
}

.message__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  padding-bottom: var(--s4);
  margin-bottom: var(--s4);
  border-bottom: 1px solid var(--border);
}

.message__to {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--navy-400);
}

.message__line {
  margin-top: var(--s2);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-800);
}

.message__details {
  margin-top: var(--s3);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-800);
}

.message__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s4);
}

.message__button {
  padding: var(--s2) var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--navy-400);
  background: var(--surface);
}

.message__button--primary {
  background: var(--teal-600);
  border-color: var(--teal-600);
  color: #fff;
}

.message__hold {
  margin-top: var(--s4);
  font-size: var(--text-xs);
  color: var(--caution-fg);
  font-weight: 600;
}

.explain {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--text-soft);
}

.simulate {
  margin-top: var(--s5);
  padding: var(--s4);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--paper-deep);
}

.simulate__title {
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-400);
}

.simulate__lede {
  margin-top: var(--s1);
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.simulate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s3);
}

.result {
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--positive-bg);
  color: var(--positive-fg);
  font-size: var(--text-sm);
  font-weight: 500;
}

.result--bad {
  background: var(--critical-bg);
  color: var(--critical-fg);
}

.hold-note {
  flex-basis: 100%;
  font-size: var(--text-xs);
  color: var(--text-soft);
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById } from '@/data/locations'
import { roomsAt } from '@/data/rooms'
import { serviceById } from '@/data/services'
import { localized } from '@/i18n'
import { roomRefusal } from '@/services/careFlow'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import StatusPill from './StatusPill.vue'

/**
 * Checking in a patient who is standing at the desk: one dialog, one action.
 *
 * It does the whole of the front desk's job at that moment — confirm who it is, give them
 * a room, record the arrival — and then offers the slip, which is the next thing anyone
 * would reach for. Splitting that across three screens only made it easier to forget one.
 *
 * The CureMD state is shown **separately** and never folded in: if the appointment still
 * has to be entered there by hand, the arrival is allowed anyway — the patient is here,
 * that is a fact — and the task stays in the inbox.
 */
const props = defineProps<{ open: boolean; appointment: Appointment | null }>()
const emit = defineEmits<{
  close: []
  arrived: [appointment: Appointment]
  print: [appointment: Appointment]
}>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const chosenRoom = ref<string | null>(null)
/** Set once the arrival is recorded, so the dialog can offer the slip before closing. */
const done = ref<Appointment | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    chosenRoom.value = null
    done.value = null
  }
)

const when = computed(() => {
  const found = props.appointment
  if (!found) return ''
  return `${formatWallDate(found.startWall, locale.value)}, ${formatWallTime(found.startWall, locale.value)}`
})

const clinic = computed(() => localized(locationById(props.appointment?.locationId ?? '')?.name))
const service = computed(() => localized(serviceById(props.appointment?.serviceId ?? '')?.name))

/** The rooms at this clinic, with whichever are already taken marked as such. */
const rooms = computed(() => {
  const found = props.appointment
  if (!found) return []
  return roomsAt(found.locationId).map((room) => ({
    room,
    taken: roomRefusal(room.id, found, schedule.appointments) !== null
  }))
})

const anyFree = computed(() => rooms.value.some((entry) => !entry.taken))

/** The registration is still to be done by hand, and recording an arrival will not do it. */
const curemdPending = computed(() => props.appointment?.curemd.status === 'pending-registration')

const submit = async (): Promise<void> => {
  const found = props.appointment
  if (!found) return
  const result = await schedule.recordArrival(found.id, chosenRoom.value, {
    expectedVersion: found.version
  })
  if (result.ok) done.value = result.appointment
}

const finish = (): void => {
  if (done.value) emit('arrived', done.value)
}

const printNow = (): void => {
  if (done.value) emit('print', done.value)
}
</script>

<template>
  <AppDialog
    :open="open"
    :title="done ? t('reception.arrival.doneTitle') : t('reception.arrival.title')"
    :close-label="t('common.close')"
    @close="done ? finish() : emit('close')"
  >
    <template v-if="appointment">
      <!-- Step two: recorded. Offer the slip, which is the next thing anyone reaches for. -->
      <template v-if="done">
        <p class="recorded">
          <AppIcon name="check-circle" :size="18" />
          <span>
            {{
              t('reception.arrival.recorded', {
                patient: `${done.patient.firstName} ${done.patient.lastName}`,
                time: formatWallTime(done.visit!.arrivedAtWall, locale)
              })
            }}
          </span>
        </p>
        <p class="recorded__room">
          {{
            done.visit!.roomId
              ? t('reception.arrival.recordedRoom', { room: localized(rooms.find((r) => r.room.id === done!.visit!.roomId)?.room.name) })
              : t('reception.arrival.recordedNoRoom')
          }}
        </p>
      </template>

      <template v-else>
        <p class="lede">{{ t('reception.arrival.lede') }}</p>

        <dl class="who">
          <div>
            <dt>{{ t('reception.arrival.patient') }}</dt>
            <dd class="who__name">
              {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
            </dd>
          </div>
          <div>
            <dt>{{ t('reception.arrival.reference') }}</dt>
            <dd>{{ appointment.reference }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.arrival.when') }}</dt>
            <dd>{{ when }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.arrival.clinic') }}</dt>
            <dd>{{ clinic }}</dd>
          </div>
          <div>
            <dt>{{ t('reception.arrival.service') }}</dt>
            <dd>{{ service }}</dd>
          </div>
        </dl>

        <div class="states">
          <StatusPill kind="appointment" :status="appointment.status" />
          <StatusPill kind="curemd" :status="appointment.curemd.status" />
        </div>

        <p v-if="curemdPending" class="warn" role="status">
          <AppIcon name="alert-circle" :size="18" />
          <span>{{ t('reception.arrival.curemdWarning') }}</span>
        </p>

        <section class="rooms">
          <h3 class="rooms__title">{{ t('reception.arrival.room') }}</h3>
          <p class="rooms__note">{{ t('reception.arrival.roomNote') }}</p>

          <div class="rooms__grid">
            <button
              v-for="entry in rooms"
              :key="entry.room.id"
              type="button"
              class="room"
              :class="{ 'room--on': chosenRoom === entry.room.id }"
              :disabled="entry.taken"
              :aria-pressed="chosenRoom === entry.room.id"
              @click="chosenRoom = entry.room.id"
            >
              <span>{{ localized(entry.room.name) }}</span>
              <span v-if="entry.taken" class="room__taken">{{ t('reception.floor.taken') }}</span>
            </button>
          </div>

          <button
            type="button"
            class="later"
            :class="{ 'later--on': chosenRoom === null }"
            :aria-pressed="chosenRoom === null"
            @click="chosenRoom = null"
          >
            {{ t('reception.arrival.roomLater') }}
          </button>

          <p v-if="!anyFree" class="rooms__full">{{ t('reception.arrival.allTaken') }}</p>
        </section>
      </template>
    </template>

    <template #actions>
      <template v-if="done">
        <AppButton icon-left="printer" @click="printNow">
          {{ t('reception.arrival.printNow') }}
        </AppButton>
        <AppButton variant="secondary" @click="finish">{{ t('common.close') }}</AppButton>
      </template>
      <template v-else>
        <AppButton :loading="schedule.working" @click="submit">
          {{ t('reception.arrival.confirm') }}
        </AppButton>
        <AppButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
      </template>
    </template>
  </AppDialog>
</template>

<style scoped>
.lede {
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--navy-600);
}

.who {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--s4);
  margin: var(--s5) 0 0;
  padding: var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--paper-deep);
}

.who dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.who dd {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--navy-800);
}

.who__name {
  font-size: var(--text-md) !important;
  font-weight: 600;
}

.states {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s4);
}

.warn {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.warn svg {
  margin-top: 2px;
  flex: none;
}

.rooms {
  margin-top: var(--s5);
  padding-top: var(--s5);
  border-top: 1px solid var(--border);
}

.rooms__title {
  font-size: var(--text-md);
}

.rooms__note {
  margin-top: var(--s1);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.rooms__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s4);
}

.room {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
  cursor: pointer;
}

.room:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.room--on,
.room--on:hover {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}

.room__taken {
  font-size: var(--text-2xs);
  font-weight: 500;
}

.later {
  margin-top: var(--s3);
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-600);
  text-decoration: underline;
  cursor: pointer;
}

.later--on {
  color: var(--teal-700);
}

.rooms__full {
  margin-top: var(--s3);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.recorded {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--navy-800);
}

.recorded svg {
  margin-top: 2px;
  flex: none;
  color: var(--positive-fg);
}

.recorded__room {
  margin-top: var(--s3);
  font-size: var(--text-sm);
  color: var(--navy-600);
}
</style>

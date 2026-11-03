<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { locationById, locations } from '@/data/locations'
import { roomById, roomsAt } from '@/data/rooms'
import { localized } from '@/i18n'
import { minutesSince, roomRefusal } from '@/services/careFlow'
import { formatWallTime, nowWall } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, LocationId } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import StatusPill from './StatusPill.vue'

/**
 * Who is in the building right now.
 *
 * Each card carries only what the desk needs to see at a glance, and two actions: print
 * the slip, finish the visit. Correcting a room is a secondary thing — it happens when
 * somebody picked the wrong one — so it sits behind a menu rather than competing with the
 * work.
 *
 * The appointment status and the CureMD record are shown as their own marks, apart from
 * the visit state, because they answer different questions.
 */
const emit = defineEmits<{
  open: [appointment: Appointment]
  print: [appointment: Appointment]
}>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const clinicFilter = ref<LocationId | 'all'>('all')
const stageFilter = ref<'in-clinic' | 'finished'>('in-clinic')

const matchesClinic = (appointment: Appointment): boolean =>
  clinicFilter.value === 'all' || appointment.locationId === clinicFilter.value

const present = computed(() => schedule.inClinic.filter(matchesClinic))
const finished = computed(() => schedule.finishedVisits.filter(matchesClinic))

const shown = computed(() => (stageFilter.value === 'finished' ? finished.value : present.value))

const roomName = (appointment: Appointment): string => {
  const id = appointment.visit?.roomId
  if (!id) return t('reception.floor.noRoom')
  return localized(roomById(id)?.name)
}

const here = (appointment: Appointment): number =>
  minutesSince(appointment.visit!.arrivedAtWall, nowWall())

/** Open menu, by appointment id. Only one at a time. */
const menuFor = ref<string | null>(null)
const correcting = ref<string | null>(null)

const roomChoices = (appointment: Appointment) =>
  roomsAt(appointment.locationId).map((room) => ({
    room,
    taken: roomRefusal(room.id, appointment, schedule.appointments) !== null
  }))

const correct = async (appointment: Appointment, roomId: string | null): Promise<void> => {
  await schedule.correctRoom(appointment.id, roomId, { expectedVersion: appointment.version })
  correcting.value = null
  menuFor.value = null
}

const finish = async (appointment: Appointment): Promise<void> => {
  await schedule.finishVisit(appointment.id, { expectedVersion: appointment.version })
  menuFor.value = null
}
</script>

<template>
  <section class="floor">
    <header class="floor__head">
      <h2 class="floor__title">{{ t('reception.floor.title') }}</h2>
      <p class="floor__lede">{{ t('reception.floor.lede') }}</p>
    </header>

    <div class="filters">
      <label class="filters__field">
        <span>{{ t('reception.filters.location') }}</span>
        <select v-model="clinicFilter">
          <option value="all">{{ t('reception.filters.allLocations') }}</option>
          <option v-for="location in locations" :key="location.id" :value="location.id">
            {{ localized(location.name) }}
          </option>
        </select>
      </label>

      <div class="toggle" role="group" :aria-label="t('reception.floor.stageFilter')">
        <button
          type="button"
          class="toggle__btn"
          :class="{ 'toggle__btn--on': stageFilter === 'in-clinic' }"
          :aria-pressed="stageFilter === 'in-clinic'"
          @click="stageFilter = 'in-clinic'"
        >
          {{ t('reception.stage.in-clinic') }}
          <span class="toggle__count">{{ present.length }}</span>
        </button>
        <button
          type="button"
          class="toggle__btn"
          :class="{ 'toggle__btn--on': stageFilter === 'finished' }"
          :aria-pressed="stageFilter === 'finished'"
          @click="stageFilter = 'finished'"
        >
          {{ t('reception.stage.finished') }}
          <span class="toggle__count">{{ finished.length }}</span>
        </button>
      </div>
    </div>

    <p v-if="!shown.length" class="empty">
      {{ stageFilter === 'finished' ? t('reception.floor.noneFinished') : t('reception.floor.nobody') }}
    </p>

    <ul v-else class="people">
      <li v-for="appointment in shown" :key="appointment.id" class="person">
        <div class="person__main">
          <button type="button" class="person__name" @click="emit('open', appointment)">
            {{ appointment.patient.firstName }} {{ appointment.patient.lastName }}
          </button>
          <p class="person__meta">
            {{ localized(locationById(appointment.locationId)?.name) }} ·
            {{ t('reception.floor.appointmentAt', { time: formatWallTime(appointment.startWall, locale) }) }}
            ·
            {{ t('reception.floor.arrivedAt', { time: formatWallTime(appointment.visit!.arrivedAtWall, locale) }) }}
            <template v-if="appointment.visit!.leftAtWall">
              ·
              {{ t('reception.floor.leftAt', { time: formatWallTime(appointment.visit!.leftAtWall, locale) }) }}
            </template>
            <template v-else>· {{ t('reception.floor.here', { count: here(appointment) }) }}</template>
          </p>
        </div>

        <div class="person__states">
          <span class="stage">{{ t(`reception.stage.${appointment.visit!.stage}`) }}</span>
          <span v-if="appointment.visit!.stage === 'in-clinic'" class="room">
            <AppIcon name="door-open" :size="15" />
            {{ roomName(appointment) }}
          </span>
          <StatusPill kind="appointment" :status="appointment.status" compact />
          <StatusPill kind="curemd" :status="appointment.curemd.status" compact />
        </div>

        <div v-if="appointment.visit!.stage === 'in-clinic'" class="person__actions">
          <AppButton size="sm" variant="secondary" icon-left="printer" @click="emit('print', appointment)">
            {{ t('reception.floor.printSlip') }}
          </AppButton>
          <AppButton size="sm" @click="finish(appointment)">
            {{ t('reception.floor.finishVisit') }}
          </AppButton>

          <div class="more">
            <button
              type="button"
              class="more__btn"
              :aria-expanded="menuFor === appointment.id"
              :aria-label="t('reception.floor.moreActions')"
              @click="menuFor = menuFor === appointment.id ? null : appointment.id; correcting = null"
            >
              <AppIcon name="chevron-down" :size="16" />
            </button>

            <div v-if="menuFor === appointment.id" class="more__menu">
              <button
                v-if="correcting !== appointment.id"
                type="button"
                class="more__item"
                @click="correcting = appointment.id"
              >
                {{ t('reception.floor.correctRoom') }}
              </button>

              <div v-else class="picker">
                <p class="picker__label">{{ t('reception.floor.correctRoomLabel') }}</p>
                <div class="picker__rooms">
                  <button
                    v-for="choice in roomChoices(appointment)"
                    :key="choice.room.id"
                    type="button"
                    class="picker__room"
                    :class="{ 'picker__room--on': appointment.visit!.roomId === choice.room.id }"
                    :disabled="choice.taken"
                    @click="correct(appointment, choice.room.id)"
                  >
                    {{ localized(choice.room.name) }}
                    <span v-if="choice.taken" class="picker__taken">{{ t('reception.floor.taken') }}</span>
                  </button>
                  <button
                    v-if="appointment.visit!.roomId"
                    type="button"
                    class="picker__room"
                    @click="correct(appointment, null)"
                  >
                    {{ t('reception.floor.noRoomYet') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.floor__title {
  font-size: var(--text-xl);
}

.floor__lede {
  margin-top: var(--s2);
  max-width: 62ch;
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--navy-600);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--s4);
  margin: var(--s5) 0;
}

.filters__field {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 170px;
}

.filters__field span {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.filters__field select {
  min-height: var(--tap);
  padding: 0 var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.toggle {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--paper-deep);
}

.toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 38px;
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-600);
  cursor: pointer;
}

.toggle__btn--on {
  background: var(--surface);
  color: var(--navy-800);
  box-shadow: var(--shadow-xs);
}

.toggle__count {
  font-variant-numeric: tabular-nums;
  color: var(--text-soft);
}

.empty {
  padding: var(--s6);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--text-soft);
}

.people {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.person {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) auto;
  align-items: center;
  gap: var(--s3) var(--s5);
  padding: var(--s4) var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.person__name {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--navy-800);
  text-align: left;
  cursor: pointer;
}

.person__name:hover {
  text-decoration: underline;
}

.person__meta {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.person__states {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s2);
}

.stage,
.room {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px var(--s3);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.stage {
  background: var(--navy-800);
  color: #fff;
}

.room {
  border: 1px solid var(--border-strong);
  color: var(--navy-700);
}

.person__actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

.more {
  position: relative;
}

.more__btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-600);
  cursor: pointer;
}

.more__btn:hover {
  border-color: var(--teal-500);
}

.more__menu {
  position: absolute;
  right: 0;
  z-index: 5;
  min-width: 230px;
  margin-top: var(--s2);
  padding: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-md);
}

.more__item {
  width: 100%;
  padding: var(--s2) var(--s3);
  border: 0;
  border-radius: var(--radius-xs);
  background: none;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
  text-align: left;
  cursor: pointer;
}

.more__item:hover {
  background: var(--paper-deep);
}

.picker__label {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.picker__rooms {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s3);
}

.picker__room {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 36px;
  padding: 0 var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
  cursor: pointer;
}

.picker__room:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.picker__room--on {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}

.picker__taken {
  font-size: var(--text-2xs);
  font-weight: 500;
}

@media (max-width: 760px) {
  .person {
    grid-template-columns: 1fr;
  }

  .person__states {
    justify-content: flex-start;
  }

  .more__menu {
    right: auto;
    left: 0;
  }
}
</style>

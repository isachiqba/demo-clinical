<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { demoAnchorKey } from '@/data/demoSchedule'
import { scenarioIds } from '@/data/demoScenario'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import { addDaysToKey, dateKeyOf, formatWallDate, todayKey } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import { APPOINTMENT_STATUSES } from '@/types'
import type { Appointment, AppointmentStatus, CuremdTask, LocationId } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher.vue'
import LogoMark from '@/components/layout/LogoMark.vue'
import AgendaBoard from '@/components/reception/AgendaBoard.vue'
import AppointmentPanel from '@/components/reception/AppointmentPanel.vue'
import AppointmentTable from '@/components/reception/AppointmentTable.vue'
import CuremdDialog from '@/components/reception/CuremdDialog.vue'
import ArrivalDialog from '@/components/reception/ArrivalDialog.vue'
import CareSlip from '@/components/reception/CareSlip.vue'
import ClinicFloor from '@/components/reception/ClinicFloor.vue'
import CuremdInbox from '@/components/reception/CuremdInbox.vue'
import OverviewPanel from '@/components/reception/OverviewPanel.vue'
import RescheduleDialog from '@/components/reception/RescheduleDialog.vue'
import WaitlistPanel from '@/components/reception/WaitlistPanel.vue'

/**
 * The front desk. It reads and writes the same records as the public site, and keeps the
 * two states apart throughout: what the clinic has agreed with the patient, and what is
 * still to be typed into CureMD by hand.
 */
const { t, locale } = useI18n()
const route = useRoute()
const schedule = useScheduleStore()

type Mode = 'overview' | 'curemd' | 'floor' | 'agenda' | 'list' | 'waitlist'

const mode = ref<Mode>('overview')
const dateKey = ref(demoAnchorKey())
const locationFilter = ref<LocationId | ''>('')
const statusFilter = ref<AppointmentStatus | ''>('')
const query = ref('')

const selectedId = ref<string | null>(null)
const rescheduling = ref<Appointment | null>(null)
const proposing = ref<Appointment | null>(null)
const curemdTask = ref<CuremdTask | null>(null)
const curemdAppointment = ref<Appointment | null>(null)

const askReset = ref(false)
const resetDone = ref(false)
const scenarioLoaded = ref(false)
const scriptedMissing = ref(false)

onMounted(async () => {
  await schedule.ensureLoaded()
  const reference = route.query.ref
  if (typeof reference === 'string') {
    const match = schedule.byReference(reference)
    if (match) {
      dateKey.value = dateKeyOf(match.startWall)
      mode.value = 'list'
      selectedId.value = match.id
    }
  }
})

const matchesFilters = (appointment: Appointment): boolean => {
  if (locationFilter.value && appointment.locationId !== locationFilter.value) return false
  if (statusFilter.value && appointment.status !== statusFilter.value) return false
  if (query.value.trim()) {
    const needle = query.value.trim().toLowerCase()
    const hay = [
      appointment.patient.firstName,
      appointment.patient.lastName,
      appointment.reference,
      appointment.curemd.reference ?? '',
      appointment.patient.email
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

const dayAppointments = computed(() => schedule.onDate(dateKey.value).filter(matchesFilters))

const listAppointments = computed(() => {
  const searching = query.value.trim().length > 0
  const base = searching ? [...schedule.appointments] : schedule.onDate(dateKey.value)
  return base.filter(matchesFilters).sort((a, b) => a.startWall.localeCompare(b.startWall))
})

const selected = computed(() => (selectedId.value ? (schedule.byId(selectedId.value) ?? null) : null))

const visibleClinics = computed<LocationId[]>(() =>
  locationFilter.value ? [locationFilter.value] : locations.map((location) => location.id)
)

/** The day's headline figures, kept in the clinic's own terms. */
const dayStats = computed(() => {
  const today = schedule.onDate(dateKey.value)
  return {
    total: today.filter((a) => a.status !== 'cancelled' && a.status !== 'unavailable').length,
    requested: today.filter((a) => a.status === 'requested').length,
    confirmed: today.filter((a) => a.status === 'confirmed' || a.status === 'arrived').length,
    cancelled: today.filter((a) => a.status === 'cancelled').length
  }
})

const anyFilter = computed(
  () => Boolean(locationFilter.value) || Boolean(statusFilter.value) || query.value.trim().length > 0
)

const clearFilters = (): void => {
  locationFilter.value = ''
  statusFilter.value = ''
  query.value = ''
}

const shiftDay = (delta: number): void => {
  dateKey.value = addDaysToKey(dateKey.value, delta)
}

const openAppointment = (appointment: Appointment): void => {
  selectedId.value = appointment.id
}

const openFromInbox = (appointment: Appointment): void => {
  mode.value = 'agenda'
  clearFilters()
  dateKey.value = dateKeyOf(appointment.startWall)
  selectedId.value = appointment.id
}

// --- the patient is in the building --------------------------------------
const arrivalFor = ref<Appointment | null>(null)
const slipFor = ref<Appointment | null>(null)

const openArrival = (appointment: Appointment): void => {
  arrivalFor.value = appointment
}

/** After checking in, show them on the clinic floor. */
const afterArrival = (appointment: Appointment): void => {
  arrivalFor.value = null
  selectedId.value = appointment.id
  mode.value = 'floor'
}

/** "Print the slip" straight from the arrival dialog: close it, open the sheet. */
const printAfterArrival = (appointment: Appointment): void => {
  arrivalFor.value = null
  mode.value = 'floor'
  slipFor.value = appointment
}

const openSlip = (appointment: Appointment): void => {
  slipFor.value = appointment
}

/** The slip must always show what is true now, not what was true when it opened. */
const liveSlip = computed(() =>
  slipFor.value ? (schedule.byId(slipFor.value.id) ?? slipFor.value) : null
)

const startCuremd = (payload: { task: CuremdTask; appointment: Appointment }): void => {
  curemdTask.value = payload.task
  curemdAppointment.value = payload.appointment
}

const closeCuremd = (): void => {
  curemdTask.value = null
  curemdAppointment.value = null
}

/** Keep the dialog pointed at the live record while it is open. */
const curemdLive = computed(() =>
  curemdAppointment.value ? (schedule.byId(curemdAppointment.value.id) ?? null) : null
)

const onMoved = (appointment: Appointment): void => {
  rescheduling.value = null
  selectedId.value = appointment.id
}

const onProposed = (appointment: Appointment): void => {
  proposing.value = null
  selectedId.value = appointment.id
}

// --- demo controls -----------------------------------------------------------

const loadScenario = async (): Promise<void> => {
  await schedule.loadScenario()
  scenarioLoaded.value = true
  window.setTimeout(() => (scenarioLoaded.value = false), 4000)
}

const openScripted = (id: string, target: Mode = 'agenda'): void => {
  const appointment = schedule.byId(id)
  if (!appointment) {
    scriptedMissing.value = true
    window.setTimeout(() => (scriptedMissing.value = false), 4000)
    return
  }
  mode.value = target
  clearFilters()
  dateKey.value = dateKeyOf(appointment.startWall)
  selectedId.value = appointment.id
}

const confirmReset = async (): Promise<void> => {
  await schedule.resetDemoData()
  askReset.value = false
  selectedId.value = null
  clearFilters()
  mode.value = 'overview'
  dateKey.value = demoAnchorKey()
  resetDone.value = true
  window.setTimeout(() => (resetDone.value = false), 4000)
}

const openAgendaFor = (payload: { locationId: LocationId; dateKey: string }): void => {
  mode.value = 'agenda'
  locationFilter.value = payload.locationId
  dateKey.value = payload.dateKey
  selectedId.value = null
}

const dateLabel = computed(() =>
  formatWallDate(dateKey.value, locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
)

watch([locationFilter, statusFilter], () => {
  if (selected.value && !matchesFilters(selected.value)) selectedId.value = null
})

const isAgendaMode = computed(() => mode.value === 'agenda' || mode.value === 'list')
const openingsWaiting = computed(() => schedule.openOpenings.length)
const matchesWaiting = computed(() => schedule.totalMatches)
</script>

<template>
  <div class="rec">
    <aside class="rec__rail">
      <RouterLink class="rec__brand" :to="{ name: 'home' }">
        <LogoMark compact />
      </RouterLink>

      <p class="rec__desk">{{ t('reception.subtitle') }}</p>

      <nav class="rec__nav" :aria-label="t('reception.title')">
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'overview' }"
          :aria-pressed="mode === 'overview'"
          @click="mode = 'overview'"
        >
          <AppIcon name="chart" :size="17" />
          <span>{{ t('reception.nav.overview') }}</span>
        </button>
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'curemd' }"
          :aria-pressed="mode === 'curemd'"
          @click="mode = 'curemd'"
        >
          <AppIcon name="inbox" :size="17" />
          <span>{{ t('reception.nav.curemd') }}</span>
          <span v-if="schedule.taskCounts.total" class="rec__badge rec__badge--warn">
            {{ schedule.taskCounts.total }}
          </span>
        </button>
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'floor' }"
          :aria-pressed="mode === 'floor'"
          @click="mode = 'floor'"
        >
          <AppIcon name="door-open" :size="17" />
          <span>{{ t('reception.nav.floor') }}</span>
          <span v-if="schedule.inClinic.length" class="rec__badge">
            {{ schedule.inClinic.length }}
          </span>
        </button>
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'agenda' }"
          :aria-pressed="mode === 'agenda'"
          @click="mode = 'agenda'"
        >
          <AppIcon name="calendar" :size="17" />
          <span>{{ t('reception.nav.agenda') }}</span>
        </button>
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'list' }"
          :aria-pressed="mode === 'list'"
          @click="mode = 'list'"
        >
          <AppIcon name="list" :size="17" />
          <span>{{ t('reception.nav.list') }}</span>
        </button>
        <button
          class="rec__tab"
          type="button"
          :class="{ 'rec__tab--on': mode === 'waitlist' }"
          :aria-pressed="mode === 'waitlist'"
          @click="mode = 'waitlist'"
        >
          <AppIcon name="users" :size="17" />
          <span>{{ t('reception.nav.waitlist') }}</span>
          <span v-if="openingsWaiting" class="rec__badge">{{ openingsWaiting }}</span>
        </button>
      </nav>

      <div class="rec__rail-end">
        <section class="rec__demo">
          <h2 class="rec__demo-title">{{ t('reception.demo.title') }}</h2>
          <p class="rec__demo-note">{{ t('reception.demo.note') }}</p>
          <AppButton variant="secondary" size="sm" icon-left="download" block @click="loadScenario">
            {{ t('reception.demo.load') }}
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon-left="upload"
            block
            @click="openScripted(scenarioIds.pendingRegistration)"
          >
            {{ t('reception.demo.openRequest') }}
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon-left="ban"
            block
            @click="openScripted(scenarioIds.cancellationPending)"
          >
            {{ t('reception.demo.openCancellation') }}
          </AppButton>
          <AppButton variant="secondary" size="sm" icon-left="reset" block @click="askReset = true">
            {{ t('demo.reset') }}
          </AppButton>
          <p v-if="scenarioLoaded" class="rec__done" role="status">{{ t('reception.demo.loaded') }}</p>
          <p v-if="scriptedMissing" class="rec__done" role="status">
            {{ t('reception.demo.missing') }}
          </p>
          <p v-if="resetDone" class="rec__done" role="status">{{ t('demo.resetDone') }}</p>
        </section>

        <AppButton variant="quiet" size="sm" icon-left="arrow-left" :to="{ name: 'home' }" block>
          {{ t('nav.backToSite') }}
        </AppButton>
        <LanguageSwitcher />
      </div>
    </aside>

    <div class="rec__main">
      <header class="rec__top">
        <div class="rec__titles">
          <h1 class="rec__title">{{ t('reception.title') }}</h1>
          <p v-if="isAgendaMode" class="rec__date">{{ dateLabel }}</p>
        </div>

        <div v-if="isAgendaMode" class="rec__datenav">
          <button class="rec__step" type="button" aria-label="−1" @click="shiftDay(-1)">
            <AppIcon name="chevron-left" :size="17" />
          </button>
          <input
            v-model="dateKey"
            class="rec__dateinput"
            type="date"
            :aria-label="t('reception.filters.date')"
          />
          <button class="rec__step" type="button" aria-label="+1" @click="shiftDay(1)">
            <AppIcon name="chevron-right" :size="17" />
          </button>
          <AppButton size="sm" variant="secondary" @click="dateKey = todayKey()">
            {{ t('reception.filters.today') }}
          </AppButton>
        </div>
      </header>

      <p class="rec__notice">
        <AppIcon name="info" :size="16" />
        <span>{{ t('reception.notice') }}</span>
      </p>

      <OverviewPanel v-if="mode === 'overview'" class="tabpanel" @open-agenda="openAgendaFor" />

      <CuremdInbox
        v-else-if="mode === 'curemd'"
        class="tabpanel"
        @act="startCuremd"
        @open="openFromInbox"
      />

      <ClinicFloor
        v-else-if="mode === 'floor'"
        class="tabpanel"
        @open="openFromInbox"
        @print="openSlip"
      />

      <WaitlistPanel v-else-if="mode === 'waitlist'" class="tabpanel" />

      <template v-else>
        <p v-if="openingsWaiting" class="rec__opening" role="status">
          <AppIcon name="alert-circle" :size="17" />
          <span>
            {{ t('reception.waitlist.openings.banner') }} ·
            {{ t('reception.waitlist.openings.matches', { count: matchesWaiting }, matchesWaiting) }}
          </span>
          <AppButton size="sm" variant="secondary" @click="mode = 'waitlist'">
            {{ t('reception.waitlist.openings.bannerAction') }}
          </AppButton>
        </p>

        <ul class="tiles">
          <li class="tile">
            <span class="tile__value">{{ dayStats.total }}</span>
            <span class="tile__label">{{ t('reception.stats.today') }}</span>
          </li>
          <li class="tile">
            <span class="tile__value">{{ dayStats.requested }}</span>
            <span class="tile__label">{{ t('reception.stats.requested') }}</span>
          </li>
          <li class="tile">
            <span class="tile__value">{{ dayStats.confirmed }}</span>
            <span class="tile__label">{{ t('reception.stats.confirmed') }}</span>
          </li>
          <li class="tile">
            <span class="tile__value">{{ dayStats.cancelled }}</span>
            <span class="tile__label">{{ t('reception.stats.cancelled') }}</span>
          </li>
        </ul>

        <section class="bar" :aria-label="t('reception.filters.title')">
          <label class="bar__search">
            <AppIcon name="search" :size="17" />
            <span class="sr-only">{{ t('reception.filters.search') }}</span>
            <input v-model="query" type="search" :placeholder="t('reception.filters.searchPlaceholder')" />
          </label>

          <label class="bar__field">
            <span class="sr-only">{{ t('reception.filters.location') }}</span>
            <select v-model="locationFilter">
              <option value="">{{ t('reception.filters.allLocations') }}</option>
              <option v-for="location in locations" :key="location.id" :value="location.id">
                {{ localized(location.name) }}
              </option>
            </select>
          </label>

          <label class="bar__field">
            <span class="sr-only">{{ t('reception.filters.status') }}</span>
            <select v-model="statusFilter">
              <option value="">{{ t('reception.filters.allStatuses') }}</option>
              <option v-for="status in APPOINTMENT_STATUSES" :key="status" :value="status">
                {{ t(`reception.status.${status}`) }}
              </option>
            </select>
          </label>

          <AppButton v-if="anyFilter" variant="quiet" size="sm" icon-left="x" @click="clearFilters">
            {{ t('reception.filters.clear') }}
          </AppButton>
        </section>

        <div class="work" :class="{ 'work--panel': Boolean(selected) }">
          <div class="work__board">
            <template v-if="mode === 'agenda'">
              <AgendaBoard
                v-if="dayAppointments.length"
                class="only-wide"
                :appointments="dayAppointments"
                :selected-id="selectedId"
                :location-ids="visibleClinics"
                :date-key="dateKey"
                @open="openAppointment"
              />
              <AppointmentTable
                v-if="dayAppointments.length"
                class="only-narrow"
                :appointments="dayAppointments"
                :selected-id="selectedId"
                @open="openAppointment"
                @arrival="openArrival"
              />
              <p v-if="!dayAppointments.length" class="empty">
                <span>{{ anyFilter ? t('reception.agenda.emptyFiltered') : t('reception.agenda.empty') }}</span>
                <span class="empty__hint">{{ t('reception.agenda.emptyHint') }}</span>
              </p>
            </template>

            <template v-else>
              <AppointmentTable
                v-if="listAppointments.length"
                :appointments="listAppointments"
                :selected-id="selectedId"
                show-date
                @open="openAppointment"
                @arrival="openArrival"
              />
              <p v-else class="empty">
                <span>{{ t('reception.list.empty') }}</span>
                <span class="empty__hint">{{ t('reception.agenda.emptyHint') }}</span>
              </p>
            </template>
          </div>

          <AppointmentPanel
            class="work__panel"
            :appointment="selected"
            @close="selectedId = null"
            @reschedule="rescheduling = $event"
            @propose="proposing = $event"
            @curemd="startCuremd"
            @arrival="openArrival"
            @slip="openSlip"
          />
        </div>
      </template>
    </div>

    <RescheduleDialog
      :open="Boolean(rescheduling)"
      :appointment="rescheduling"
      mode="reschedule"
      @close="rescheduling = null"
      @moved="onMoved"
    />

    <RescheduleDialog
      :open="Boolean(proposing)"
      :appointment="proposing"
      mode="propose"
      @close="proposing = null"
      @moved="onProposed"
    />

    <ArrivalDialog
      :open="arrivalFor !== null"
      :appointment="arrivalFor"
      @close="arrivalFor = null"
      @arrived="afterArrival"
      @print="printAfterArrival"
    />

    <CareSlip :open="slipFor !== null" :appointment="liveSlip" @close="slipFor = null" />

    <CuremdDialog
      :open="Boolean(curemdTask && curemdLive)"
      :task="curemdTask"
      :appointment="curemdLive"
      @close="closeCuremd"
      @done="closeCuremd"
    />

    <AppDialog
      :open="askReset"
      :title="t('demo.resetTitle')"
      :close-label="t('common.close')"
      @close="askReset = false"
    >
      <p>{{ t('demo.resetBody') }}</p>
      <template #actions>
        <AppButton variant="critical" :loading="schedule.working" @click="confirmReset">
          {{ t('demo.resetConfirm') }}
        </AppButton>
        <AppButton variant="secondary" @click="askReset = false">{{ t('common.cancel') }}</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.rec {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--paper);
}

.rec__rail {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
  padding: var(--s5) var(--s4);
  background: var(--navy-900);
  position: sticky;
  top: 0;
  height: 100vh;
  min-width: 0;
  overflow-y: auto;
}

.rec__brand {
  text-decoration: none;
}

.rec__brand :deep(.logo__name),
.rec__brand :deep(.logo__suffix),
.rec__brand :deep(.logo__mark) {
  color: #fff;
}

.rec__brand :deep(.logo__suffix),
.rec__brand :deep(.logo__mark) {
  color: var(--teal-200);
}

.rec__desk {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--navy-400);
}

.rec__nav {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
}

.rec__tab {
  display: flex;
  align-items: center;
  gap: var(--s3);
  min-height: 42px;
  padding-inline: var(--s3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--navy-200);
  font-size: var(--text-sm);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s var(--ease), color 0.14s var(--ease);
}

.rec__tab:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.rec__tab.rec__tab--on,
.rec__tab.rec__tab--on:hover {
  background: var(--teal-700);
  color: #fff;
  font-weight: 600;
}

.rec__badge {
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--teal-200);
  color: var(--teal-800);
  font-size: var(--text-2xs);
  font-weight: 700;
  text-align: center;
}

.rec__badge--warn {
  background: var(--caution-fg);
  color: #fff;
}

.rec__rail-end {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s3);
  margin-top: auto;
}

.rec__rail-end :deep(.btn) {
  white-space: normal;
  line-height: 1.25;
  padding-block: var(--s2);
  text-align: left;
  justify-content: flex-start;
}

.rec__demo {
  width: 100%;
  min-width: 0;
  padding: var(--s3);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.rec__demo-title {
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--teal-200);
}

.rec__demo-note {
  margin-bottom: var(--s1);
  font-size: var(--text-2xs);
  line-height: 1.4;
  color: var(--navy-400);
}

.rec__done {
  font-size: var(--text-2xs);
  color: var(--teal-200);
}

.rec__main {
  padding: var(--s6) var(--s6) var(--s8);
  min-width: 0;
  overflow-x: hidden;
}

.rec__top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s4);
}

.rec__title {
  font-size: var(--text-2xl);
}

.rec__date {
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--navy-400);
  text-transform: capitalize;
}

.rec__datenav {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.rec__step {
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

.rec__step:hover {
  border-color: var(--teal-500);
  color: var(--teal-700);
}

.rec__dateinput {
  min-height: 36px;
  padding-inline: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}

.rec__notice {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s5);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-xs);
  line-height: 1.5;
}

/*
 * The body of a tab — the overview, the inbox, the clinic list.
 *
 * Deliberately not called `.panel`: the appointment record calls its own root that, and a
 * parent's scoped styles also land on a child component's root element, so the two names
 * collided and this rule was quietly overriding the record's `display: flex` — which is
 * what stopped it scrolling and spilled it out of its own box.
 */
.tabpanel {
  display: block;
  margin-top: var(--s6);
}

.rec__opening {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  margin-top: var(--s4);
  padding: var(--s3) var(--s4);
  border: 1px solid var(--teal-200);
  border-radius: var(--radius-sm);
  background: var(--teal-50);
  color: var(--teal-800);
  font-size: var(--text-sm);
  font-weight: 500;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s3);
  margin-top: var(--s5);
  list-style: none;
  padding: 0;
}

.tile {
  padding: var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.tile__value {
  display: block;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: 1.1;
  color: var(--navy-800);
}

.tile__label {
  display: block;
  margin-top: var(--s1);
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
  margin-top: var(--s5);
}

.bar__search {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex: 1 1 220px;
  min-width: 180px;
  padding-inline: var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-400);
}

.bar__search input {
  flex: 1;
  min-width: 0;
  min-height: 38px;
  border: none;
  background: transparent;
  font-size: var(--text-sm);
}

.bar__search input:focus {
  outline: none;
}

.bar__search:focus-within {
  border-color: var(--teal-500);
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.bar__field select {
  min-height: 40px;
  padding: 0 var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}

.work {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s4);
  margin-top: var(--s5);
  align-items: start;
}

.work--panel {
  grid-template-columns: minmax(0, 1fr) 340px;
}

.work__board {
  min-width: 0;
}

.only-narrow {
  display: none;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  padding: var(--s8) var(--s5);
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--navy-600);
}

.empty__hint {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

@media (max-width: 1240px) {
  .work--panel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 1000px) {
  .only-wide {
    display: none;
  }

  .only-narrow {
    display: block;
  }
}

@media (max-width: 860px) {
  .rec {
    grid-template-columns: minmax(0, 1fr);
  }

  .rec__rail {
    position: static;
    height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s4);
  }

  .rec__desk {
    display: none;
  }

  .rec__nav {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
  }

  .rec__tab {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: center;
  }

  .rec__badge {
    margin-left: var(--s2);
  }

  .rec__rail-end {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 0;
    width: 100%;
    min-width: 0;
  }

  .rec__demo :deep(.btn) {
    justify-content: center;
    text-align: center;
  }

  .rec__main {
    padding: var(--s5) var(--gutter) var(--s8);
  }

  .tiles {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

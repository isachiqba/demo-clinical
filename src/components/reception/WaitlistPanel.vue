<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { providerById } from '@/data/providers'
import { serviceById, services } from '@/data/services'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import type { Candidate } from '@/services/waitlist'
import { useScheduleStore } from '@/stores/schedule'
import type { LocationId, Opening, ServiceId, WaitlistEntry, WaitlistStatus } from '@/types'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import OfferDialog from './OfferDialog.vue'

/**
 * The front desk's waitlist: the slots waiting to be filled, who each one suits and why,
 * and everyone currently on the list.
 */
const { t, locale } = useI18n()
const schedule = useScheduleStore()

const expandedId = ref<string | null>(null)
const candidates = ref<Record<string, Candidate[]>>({})
const loadingCandidates = ref<string | null>(null)

const offerOpening = ref<Opening | null>(null)
const offerEntry = ref<WaitlistEntry | null>(null)

const selectedEntryId = ref<string | null>(null)
const askWithdraw = ref(false)

const clinicFilter = ref<LocationId | ''>('')
const serviceFilter = ref<ServiceId | ''>('')
const statusFilter = ref<WaitlistStatus | ''>('')

const openings = computed(() => schedule.openOpenings)

const loadCandidates = async (opening: Opening): Promise<void> => {
  loadingCandidates.value = opening.id
  candidates.value = { ...candidates.value, [opening.id]: await schedule.candidatesForOpening(opening.id) }
  loadingCandidates.value = null
}

const toggleOpening = async (opening: Opening): Promise<void> => {
  if (expandedId.value === opening.id) {
    expandedId.value = null
    return
  }
  expandedId.value = opening.id
  await loadCandidates(opening)
}

/** Anything that changes the schedule can change who matches, so recount on every change. */
watch(
  () => [schedule.appointments, schedule.offers, schedule.waitlist],
  async () => {
    const opening = openings.value.find((item) => item.id === expandedId.value)
    if (!opening) return
    // While a slot is held, the candidate list is meaningless: close it.
    if (liveOfferFor(opening)) {
      expandedId.value = null
      return
    }
    await loadCandidates(opening)
  },
  { deep: true }
)

const describeSlot = (opening: Opening): string => {
  const slot = opening.slot
  return `${formatWallDate(slot.startWall, locale.value)} · ${formatWallTime(slot.startWall, locale.value)}`
}

const slotMeta = (opening: Opening): string => {
  const slot = opening.slot
  return [
    localized(serviceById(slot.serviceId)?.name),
    providerById(slot.providerId)?.name,
    localized(locations.find((location) => location.id === slot.locationId)?.name)
  ]
    .filter(Boolean)
    .join(' · ')
}

const reasonText = (reason: Candidate['reasons'][number]): string => {
  const params: Record<string, string> = {}
  if (reason.params?.date) {
    params.date = formatWallDate(String(reason.params.date), locale.value, {
      day: 'numeric',
      month: 'short'
    })
  }
  if (reason.params?.from) {
    params.from = formatWallDate(String(reason.params.from), locale.value, {
      day: 'numeric',
      month: 'short'
    })
  }
  return t(`reception.waitlist.candidates.reasons.${reason.key}`, params)
}

const startOffer = (opening: Opening, entry: WaitlistEntry): void => {
  offerOpening.value = opening
  offerEntry.value = entry
}

const liveOfferFor = (opening: Opening) => schedule.offerForOpening(opening.id)

const heldBy = (opening: Opening): string => {
  const offer = liveOfferFor(opening)
  if (!offer) return ''
  const entry = schedule.entryById(offer.entryId)
  return t('reception.waitlist.openings.held', {
    name: entry ? `${entry.patient.firstName} ${entry.patient.lastName}` : '',
    time: formatWallTime(offer.holdUntilWall, locale.value)
  })
}

const openHeldOffer = (opening: Opening): void => {
  const offer = liveOfferFor(opening)
  if (!offer) return
  offerOpening.value = opening
  offerEntry.value = schedule.entryById(offer.entryId) ?? null
}

const currentOffer = computed(() => {
  if (!offerOpening.value) return null
  return (
    schedule.offers.find(
      (offer) => offer.openingId === offerOpening.value?.id && offer.entryId === offerEntry.value?.id
    ) ?? null
  )
})

const closeOffer = (): void => {
  offerOpening.value = null
  offerEntry.value = null
}

// --- the list ---------------------------------------------------------------

const filtered = computed(() =>
  schedule.waitlist
    .filter((entry) => {
      if (clinicFilter.value && !entry.preferences.locationIds.includes(clinicFilter.value)) return false
      if (serviceFilter.value && entry.preferences.serviceId !== serviceFilter.value) return false
      if (statusFilter.value && entry.status !== statusFilter.value) return false
      return true
    })
    .sort((a, b) => a.createdAtWall.localeCompare(b.createdAtWall))
)

const anyFilter = computed(
  () => Boolean(clinicFilter.value) || Boolean(serviceFilter.value) || Boolean(statusFilter.value)
)

const selected = computed(() =>
  selectedEntryId.value ? schedule.entryById(selectedEntryId.value) ?? null : null
)

const clinicsOf = (entry: WaitlistEntry): string =>
  entry.preferences.locationIds
    .map((id) => localized(locations.find((location) => location.id === id)?.name))
    .join(' · ')

const bandsOf = (entry: WaitlistEntry): string =>
  entry.preferences.bands.map((band) => t(`waitlist.bands_.${band}`)).join(' · ')

const weekdaysOf = (entry: WaitlistEntry): string =>
  entry.preferences.weekdays.map((day) => t(`waitlist.weekdayShort.${day}`)).join(' ')

const linkedFor = (entry: WaitlistEntry) =>
  entry.linkedAppointmentId ? schedule.byId(entry.linkedAppointmentId) : undefined

const toneFor = (status: WaitlistStatus): 'neutral' | 'accent' | 'positive' =>
  status === 'offered' ? 'accent' : status === 'accepted' ? 'positive' : 'neutral'

const withdraw = async (): Promise<void> => {
  if (selected.value) await schedule.withdrawFromWaitlist(selected.value.id)
  askWithdraw.value = false
}
</script>

<template>
  <section class="wl" :aria-label="t('reception.waitlist.title')">
    <header class="wl__head">
      <h2 class="wl__title">{{ t('reception.waitlist.title') }}</h2>
      <p class="wl__lede">{{ t('reception.waitlist.lede') }}</p>
    </header>

    <!-- Slots waiting to be filled ------------------------------------------>
    <section class="block">
      <h3 class="block__title">{{ t('reception.waitlist.openings.title') }}</h3>

      <p v-if="!openings.length" class="empty">
        <span>{{ t('reception.waitlist.openings.none') }}</span>
        <span class="empty__hint">{{ t('reception.waitlist.openings.noneBody') }}</span>
      </p>

      <ul v-else class="openings">
        <li v-for="opening in openings" :key="opening.id" class="opening">
          <div class="opening__head">
            <div class="opening__what">
              <AppBadge :tone="opening.source === 'cancellation' ? 'caution' : 'neutral'">
                {{ t(`reception.waitlist.openings.source.${opening.source}`) }}
              </AppBadge>
              <p class="opening__when">{{ describeSlot(opening) }}</p>
              <p class="opening__meta">{{ slotMeta(opening) }}</p>
            </div>

            <div class="opening__actions">
              <p v-if="liveOfferFor(opening)" class="opening__held">{{ heldBy(opening) }}</p>
              <AppButton
                v-if="liveOfferFor(opening)"
                size="sm"
                variant="secondary"
                @click="openHeldOffer(opening)"
              >
                {{ t('reception.offer.title') }}
              </AppButton>
              <AppButton
                v-else
                size="sm"
                :icon-right="expandedId === opening.id ? 'chevron-down' : 'chevron-right'"
                @click="toggleOpening(opening)"
              >
                {{
                  t(
                    'reception.waitlist.openings.matches',
                    { count: schedule.matchesForOpening(opening) },
                    schedule.matchesForOpening(opening)
                  )
                }}
              </AppButton>
              <AppButton size="sm" variant="quiet" @click="schedule.dismissOpening(opening.id)">
                {{ t('reception.waitlist.openings.dismiss') }}
              </AppButton>
            </div>
          </div>

          <div v-if="expandedId === opening.id && !liveOfferFor(opening)" class="opening__body">
            <p v-if="loadingCandidates === opening.id" class="muted">{{ t('common.loading') }}</p>

            <template v-else-if="(candidates[opening.id] ?? []).length">
              <h4 class="opening__subtitle">{{ t('reception.waitlist.candidates.title') }}</h4>
              <ul class="candidates">
                <li v-for="candidate in candidates[opening.id]" :key="candidate.entry.id" class="candidate">
                  <div class="candidate__who">
                    <p class="candidate__name">
                      {{ candidate.entry.patient.firstName }} {{ candidate.entry.patient.lastName }}
                    </p>
                    <ul class="candidate__reasons">
                      <li v-for="reason in candidate.reasons" :key="reason.key">
                        <AppIcon name="check" :size="13" :stroke-width="3" />
                        <span>{{ reasonText(reason) }}</span>
                      </li>
                    </ul>
                  </div>
                  <AppButton size="sm" @click="startOffer(opening, candidate.entry)">
                    {{ t('reception.waitlist.candidates.offer') }}
                  </AppButton>
                </li>
              </ul>
            </template>

            <p v-else class="empty empty--inset">
              <span>{{ t('reception.waitlist.openings.noMatch') }}</span>
              <span class="empty__hint">{{ t('reception.waitlist.openings.noMatchBody') }}</span>
            </p>
          </div>
        </li>
      </ul>
    </section>

    <!-- Everyone on the list ------------------------------------------------>
    <section class="block">
      <h3 class="block__title">{{ t('reception.waitlist.list.title') }}</h3>

      <div class="filters">
        <label class="filters__field">
          <span class="sr-only">{{ t('reception.filters.location') }}</span>
          <select v-model="clinicFilter">
            <option value="">{{ t('reception.waitlist.filters.clinic') }}</option>
            <option v-for="location in locations" :key="location.id" :value="location.id">
              {{ localized(location.name) }}
            </option>
          </select>
        </label>
        <label class="filters__field">
          <span class="sr-only">{{ t('nav.care') }}</span>
          <select v-model="serviceFilter">
            <option value="">{{ t('reception.waitlist.filters.service') }}</option>
            <option v-for="service in services" :key="service.id" :value="service.id">
              {{ localized(service.name) }}
            </option>
          </select>
        </label>
        <label class="filters__field">
          <span class="sr-only">{{ t('reception.filters.status') }}</span>
          <select v-model="statusFilter">
            <option value="">{{ t('reception.waitlist.filters.status') }}</option>
            <option v-for="status in ['waiting', 'offered', 'accepted', 'withdrawn']" :key="status" :value="status">
              {{ t(`reception.waitlist.status.${status}`) }}
            </option>
          </select>
        </label>
      </div>

      <div class="split">
        <ul v-if="filtered.length" class="rows">
          <li v-for="entry in filtered" :key="entry.id">
            <button
              class="row"
              type="button"
              :class="{ 'row--on': entry.id === selectedEntryId }"
              :aria-pressed="entry.id === selectedEntryId"
              @click="selectedEntryId = entry.id"
            >
              <span class="row__main">
                <span class="row__name">
                  {{ entry.patient.firstName }} {{ entry.patient.lastName }}
                </span>
                <span class="row__meta">
                  {{
                    t('reception.waitlist.list.wants', {
                      service: localized(serviceById(entry.preferences.serviceId)?.name),
                      clinics: clinicsOf(entry)
                    })
                  }}
                </span>
                <span class="row__since">
                  {{
                    t('reception.waitlist.list.joined', {
                      date: formatWallDate(entry.createdAtWall, locale, { day: 'numeric', month: 'short' })
                    })
                  }}
                </span>
              </span>
              <AppBadge :tone="toneFor(entry.status)">
                {{ t(`reception.waitlist.status.${entry.status}`) }}
              </AppBadge>
            </button>
          </li>
        </ul>

        <p v-else class="empty">
          <span>{{ anyFilter ? t('reception.waitlist.list.noneFiltered') : t('reception.waitlist.list.none') }}</span>
        </p>

        <!-- Detail panel, so the list stays short ---------------------------->
        <aside v-if="selected" class="detail" :aria-label="t('reception.waitlist.detail.title')">
          <header class="detail__head">
            <div>
              <p class="detail__label">{{ t('reception.waitlist.detail.reference') }}</p>
              <p class="detail__ref">{{ selected.reference }}</p>
            </div>
            <button
              class="detail__close"
              type="button"
              :aria-label="t('reception.waitlist.detail.close')"
              @click="selectedEntryId = null"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </header>

          <div class="detail__body">
            <AppBadge :tone="toneFor(selected.status)">
              {{ t(`reception.waitlist.status.${selected.status}`) }}
            </AppBadge>

            <dl class="detail__rows">
              <div>
                <dt>{{ t('reception.detail.patient') }}</dt>
                <dd>{{ selected.patient.firstName }} {{ selected.patient.lastName }}</dd>
              </div>
              <div>
                <dt>{{ t('reception.waitlist.detail.contact') }}</dt>
                <dd>
                  {{ selected.patient.email }}<br />
                  <span class="muted">{{ selected.patient.phone || t('reception.detail.noPhone') }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('reception.waitlist.detail.joined') }}</dt>
                <dd>{{ formatWallDate(selected.createdAtWall, locale) }}</dd>
              </div>
              <div v-if="linkedFor(selected)">
                <dt>{{ t('reception.waitlist.detail.linked') }}</dt>
                <dd>{{ formatWallDate(linkedFor(selected)!.startWall, locale) }}</dd>
              </div>
            </dl>

            <section class="detail__block">
              <h4 class="detail__heading">{{ t('reception.waitlist.detail.preferences') }}</h4>
              <dl class="detail__rows">
                <div>
                  <dt>{{ t('waitlist.service') }}</dt>
                  <dd>{{ localized(serviceById(selected.preferences.serviceId)?.name) }}</dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.clinics') }}</dt>
                  <dd>{{ clinicsOf(selected) }}</dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.clinician') }}</dt>
                  <dd>
                    {{
                      selected.preferences.providerId === 'any'
                        ? t('waitlist.anyClinician')
                        : providerById(selected.preferences.providerId)?.name
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.dates') }}</dt>
                  <dd>
                    {{ formatWallDate(selected.preferences.fromKey, locale, { day: 'numeric', month: 'short' }) }}
                    –
                    {{ formatWallDate(selected.preferences.toKey, locale, { day: 'numeric', month: 'short' }) }}
                  </dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.weekdays') }}</dt>
                  <dd>{{ weekdaysOf(selected) }}</dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.bands') }}</dt>
                  <dd>{{ bandsOf(selected) }}</dd>
                </div>
                <div>
                  <dt>{{ t('waitlist.language') }}</dt>
                  <dd>{{ t(`language.${selected.preferences.language}`) }}</dd>
                </div>
              </dl>
            </section>

            <AppButton
              v-if="selected.status !== 'withdrawn'"
              variant="critical"
              icon-left="ban"
              @click="askWithdraw = true"
            >
              {{ t('reception.waitlist.detail.withdraw') }}
            </AppButton>
          </div>
        </aside>
      </div>
    </section>

    <OfferDialog
      :open="Boolean(offerOpening && offerEntry)"
      :opening="offerOpening"
      :entry="offerEntry"
      :offer="currentOffer"
      @close="closeOffer"
      @changed="() => offerOpening && loadCandidates(offerOpening)"
    />

    <AppDialog
      :open="askWithdraw"
      :title="t('reception.waitlist.detail.withdrawTitle')"
      :close-label="t('common.close')"
      @close="askWithdraw = false"
    >
      <p v-if="selected">
        {{
          t('reception.waitlist.detail.withdrawBody', {
            name: `${selected.patient.firstName} ${selected.patient.lastName}`
          })
        }}
      </p>
      <template #actions>
        <AppButton variant="critical" :loading="schedule.working" @click="withdraw">
          {{ t('reception.waitlist.detail.withdrawConfirm') }}
        </AppButton>
        <AppButton variant="secondary" @click="askWithdraw = false">{{ t('common.cancel') }}</AppButton>
      </template>
    </AppDialog>
  </section>
</template>

<style scoped>
.wl__title {
  font-size: var(--text-xl);
}

.wl__lede {
  margin-top: 2px;
  max-width: 62ch;
  font-size: var(--text-sm);
  color: var(--navy-400);
}

.block {
  margin-top: var(--s6);
}

.block__title {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.empty {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  padding: var(--s6) var(--s5);
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--navy-600);
  font-size: var(--text-sm);
}

.empty--inset {
  padding: var(--s5);
  text-align: left;
}

.empty__hint {
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.openings {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  list-style: none;
  padding: 0;
}

.opening {
  background: var(--surface);
  border: 1px solid var(--teal-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.opening__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s4);
  padding: var(--s4) var(--s5);
}

.opening__when {
  margin-top: var(--s2);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--navy-800);
  text-transform: capitalize;
}

.opening__meta {
  font-size: var(--text-xs);
  color: var(--navy-400);
}

.opening__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.opening__held {
  flex-basis: 100%;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--caution-fg);
}

.opening__body {
  padding: var(--s4) var(--s5) var(--s5);
  border-top: 1px solid var(--border);
  background: var(--paper);
}

.opening__subtitle {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  list-style: none;
  padding: 0;
}

.candidate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.candidate__name {
  font-weight: 600;
  color: var(--navy-800);
}

.candidate__reasons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s4);
  margin-top: var(--s2);
  list-style: none;
  padding: 0;
}

.candidate__reasons li {
  display: flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--text-xs);
  color: var(--navy-400);
}

.candidate__reasons svg {
  color: var(--teal-600);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-bottom: var(--s3);
}

.filters__field select {
  min-height: 40px;
  padding: 0 var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--s4);
  align-items: start;
}

.split:not(:has(.detail)) {
  grid-template-columns: minmax(0, 1fr);
}

.rows {
  list-style: none;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.rows li + li {
  border-top: 1px solid var(--border);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  width: 100%;
  padding: var(--s3) var(--s4);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s var(--ease);
}

.row:hover {
  background: var(--teal-50);
}

.row.row--on,
.row.row--on:hover {
  background: var(--teal-50);
  box-shadow: inset 3px 0 0 var(--teal-600);
}

.row__name {
  display: block;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--navy-800);
}

.row__meta,
.row__since {
  display: block;
  font-size: var(--text-2xs);
  color: var(--navy-400);
}

.detail {
  position: sticky;
  top: var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-bottom: 1px solid var(--border);
}

.detail__label {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.detail__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--navy-800);
}

.detail__close {
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

.detail__close:hover {
  background: var(--paper-deep);
  color: var(--navy-800);
}

.detail__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s4);
  padding: var(--s5);
}

.detail__rows {
  display: grid;
  gap: var(--s3);
  margin: 0;
  width: 100%;
}

.detail__rows dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.detail__rows dd {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--navy-800);
  line-height: 1.45;
  word-break: break-word;
}

.detail__block {
  width: 100%;
  padding-top: var(--s4);
  border-top: 1px solid var(--border);
}

.detail__heading {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.muted {
  color: var(--navy-400);
  font-weight: 400;
}

@media (max-width: 1100px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail {
    position: static;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import { overviewMetrics, type RangeFilter } from '@/services/metrics'
import { addDaysToKey, formatWallDate, todayKey } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { LocationId } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import ActivityFeed from './ActivityFeed.vue'

/**
 * How the three clinics are doing. Every figure is derived from the shared state when it
 * renders, so there is nothing to keep in step and nothing to double-count on a reload.
 */
const emit = defineEmits<{ openAgenda: [payload: { locationId: LocationId; dateKey: string }] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

type RangeKey = 'today' | 'week' | 'fortnight' | 'month'

const rangeKey = ref<RangeKey>('today')
const locationFilter = ref<LocationId | 'all'>('all')

const spans: Record<RangeKey, number> = { today: 0, week: 6, fortnight: 13, month: 29 }

const filter = computed<RangeFilter>(() => ({
  fromKey: todayKey(),
  toKey: addDaysToKey(todayKey(), spans[rangeKey.value]),
  locationId: locationFilter.value
}))

const metrics = computed(() => overviewMetrics(schedule.state, filter.value))

const hours = (minutes: number): string => `${Math.round(minutes / 60)} h`

const rangeLabel = computed(() =>
  rangeKey.value === 'today'
    ? formatWallDate(filter.value.fromKey, locale.value, { day: 'numeric', month: 'long' })
    : `${formatWallDate(filter.value.fromKey, locale.value, { day: 'numeric', month: 'short' })} – ${formatWallDate(filter.value.toKey, locale.value, { day: 'numeric', month: 'short' })}`
)

const nameOf = (id: LocationId): string =>
  localized(locations.find((location) => location.id === id)?.name)

const percent = (value: number): number => Math.round(value * 100)

const rangeOptions: RangeKey[] = ['today', 'week', 'fortnight', 'month']
</script>

<template>
  <section class="overview" :aria-label="t('reception.overview.title')">
    <header class="overview__head">
      <div>
        <h2 class="overview__title">{{ t('reception.overview.title') }}</h2>
        <p class="overview__lede">{{ t('reception.overview.lede') }}</p>
      </div>

      <div class="overview__filters">
        <label class="field">
          <span class="sr-only">{{ t('reception.overview.range.label') }}</span>
          <select v-model="rangeKey">
            <option v-for="option in rangeOptions" :key="option" :value="option">
              {{ t(`reception.overview.range.${option}`) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="sr-only">{{ t('reception.overview.clinic') }}</span>
          <select v-model="locationFilter">
            <option value="all">{{ t('reception.overview.allClinics') }}</option>
            <option v-for="location in locations" :key="location.id" :value="location.id">
              {{ localized(location.name) }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <section class="block">
      <h3 class="block__title">
        {{ t('reception.overview.inRange') }}
        <span class="block__hint">{{ rangeLabel }}</span>
      </h3>
      <ul class="tiles">
        <li class="tile">
          <span class="tile__value">{{ metrics.range.appointments }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.appointments') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ metrics.range.confirmed }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.confirmed') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ hours(metrics.range.freeMinutes) }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.free') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ metrics.range.cancelled }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.cancelled') }}</span>
        </li>
      </ul>
      <p class="block__note">{{ t('reception.overview.noPending') }}</p>
    </section>

    <section class="block">
      <h3 class="block__title">{{ t('reception.overview.rightNow') }}</h3>
      <ul class="tiles tiles--quiet">
        <li class="tile">
          <span class="tile__value">{{ metrics.now.waiting }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.waiting') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ metrics.now.offered }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.offered') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ metrics.now.openOpenings }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.openings') }}</span>
        </li>
        <li class="tile">
          <span class="tile__value">{{ metrics.now.activeHolds }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.holds') }}</span>
        </li>
        <li class="tile tile--accent">
          <span class="tile__value">{{ metrics.now.filledFromWaitlist }}</span>
          <span class="tile__label">{{ t('reception.overview.metrics.filled') }}</span>
        </li>
      </ul>
    </section>

    <section class="block">
      <h3 class="block__title">{{ t('reception.overview.sites.title') }}</h3>

      <ul class="sites">
        <li v-for="site in metrics.sites" :key="site.locationId" class="site">
          <div class="site__head">
            <h4 class="site__name">{{ nameOf(site.locationId) }}</h4>
            <span class="site__occupancy">
              {{ t('reception.overview.sites.occupancy', { percent: percent(site.occupancy) }) }}
            </span>
          </div>

          <div
            class="bar"
            role="img"
            :aria-label="`${nameOf(site.locationId)}: ${percent(site.occupancy)}%`"
          >
            <span
              class="bar__part bar__part--booked"
              :style="{ width: `${site.capacityMinutes ? (site.bookedMinutes / site.capacityMinutes) * 100 : 0}%` }"
            />
            <span
              class="bar__part bar__part--held"
              :style="{ width: `${site.capacityMinutes ? (site.heldMinutes / site.capacityMinutes) * 100 : 0}%` }"
            />
          </div>

          <dl class="site__numbers">
            <div>
              <dt>{{ t('reception.overview.sites.booked') }}</dt>
              <dd>{{ hours(site.bookedMinutes) }}</dd>
            </div>
            <div>
              <dt>{{ t('reception.overview.sites.held') }}</dt>
              <dd>{{ hours(site.heldMinutes) }}</dd>
            </div>
            <div>
              <dt>{{ t('reception.overview.sites.free') }}</dt>
              <dd>{{ hours(site.freeMinutes) }}</dd>
            </div>
            <div>
              <dt>{{ t('reception.overview.metrics.cancelled') }}</dt>
              <dd>{{ site.cancelled }}</dd>
            </div>
          </dl>

          <div class="site__foot">
            <span class="site__count">
              {{ t('reception.overview.sites.appointments', { count: site.appointments }, site.appointments) }}
            </span>
            <AppButton
              size="sm"
              variant="secondary"
              icon-right="arrow-right"
              @click="emit('openAgenda', { locationId: site.locationId, dateKey: filter.fromKey })"
            >
              {{ t('reception.overview.sites.goToAgenda') }}
            </AppButton>
          </div>
        </li>
      </ul>

      <p class="block__note">
        <AppIcon name="info" :size="16" />
        <span>{{ t('reception.overview.sites.definition') }}</span>
      </p>
    </section>

    <section class="block">
      <h3 class="block__title">{{ t('reception.overview.activity.title') }}</h3>
      <ActivityFeed :events="schedule.activity" />
    </section>
  </section>
</template>

<style scoped>
.overview__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s4);
}

.overview__title {
  font-size: var(--text-xl);
}

.overview__lede {
  margin-top: 2px;
  max-width: 58ch;
  font-size: var(--text-sm);
  color: var(--navy-400);
}

.overview__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.field select {
  min-height: 40px;
  padding: 0 var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}

.block {
  margin-top: var(--s6);
}

.block__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s3);
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.block__hint {
  letter-spacing: 0;
  text-transform: none;
  font-weight: 500;
  color: var(--navy-400);
}

.block__note {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s3);
  max-width: 78ch;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--text-soft);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--s3);
  list-style: none;
  padding: 0;
}

.tile {
  padding: var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.tile--accent {
  border-color: var(--teal-200);
  background: var(--teal-50);
}

.tile__value {
  display: block;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: 1.1;
  color: var(--navy-800);
}

.tiles--quiet .tile__value {
  font-size: var(--text-xl);
}

.tile__label {
  display: block;
  margin-top: var(--s1);
  font-size: var(--text-2xs);
  line-height: 1.35;
  color: var(--navy-400);
}

.sites {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--s3);
  list-style: none;
  padding: 0;
}

.site {
  display: flex;
  flex-direction: column;
  padding: var(--s4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.site__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
}

.site__name {
  font-size: var(--text-lg);
}

.site__occupancy {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--teal-700);
  white-space: nowrap;
}

.bar {
  display: flex;
  height: 10px;
  margin-top: var(--s3);
  border-radius: var(--radius-pill);
  background: var(--sage-100);
  overflow: hidden;
}

.bar__part {
  display: block;
  height: 100%;
  transition: width 0.25s var(--ease);
}

.bar__part--booked {
  background: var(--teal-600);
}

.bar__part--held {
  background: var(--caution-fg);
  opacity: 0.55;
}

.site__numbers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--s2);
  margin: var(--s4) 0 0;
}

.site__numbers dt {
  font-size: var(--text-2xs);
  color: var(--navy-200);
}

.site__numbers dd {
  margin: 1px 0 0;
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--navy-800);
}

.site__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  margin-top: auto;
  padding-top: var(--s4);
}

.site__count {
  font-size: var(--text-xs);
  color: var(--navy-400);
}
</style>

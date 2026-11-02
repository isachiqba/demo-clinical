<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import { formatClock, todayKey, weekdayOfKey, nowWall, minutesOf } from '@/services/clinicTime'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import ClinicLocator from '@/components/locations/ClinicLocator.vue'
import type { ClinicLocation } from '@/types'

const { t, locale } = useI18n()

/** Open right now, judged in clinic time rather than the visitor's. */
const isOpenNow = (location: ClinicLocation): boolean => {
  const today = location.hours.find((entry) => entry.weekday === weekdayOfKey(todayKey()))
  if (!today || today.opensAt === null || today.closesAt === null) return false
  const minutes = minutesOf(nowWall())
  return minutes >= today.opensAt && minutes < today.closesAt
}
</script>

<template>
  <PageHeader :title="t('locations.title')" :lede="t('locations.lede')" />

  <section class="band">
    <div class="page-width">
      <div class="clinics">
        <article v-for="location in locations" :id="location.id" :key="location.id" class="clinic">
          <div class="clinic__media">
            <figure class="clinic__figure">
              <img
                :src="location.image"
                :alt="t('locations.imageAlt', { name: localized(location.name) })"
                width="1200"
                height="900"
                loading="lazy"
              />
            </figure>

            <section class="clinic__plan">
              <h3 class="clinic__label">{{ t('locations.map.title') }}</h3>
              <ClinicLocator :location="location" />
            </section>
          </div>

          <div class="clinic__body">
            <div class="clinic__head">
              <h2 class="clinic__name">{{ localized(location.name) }}</h2>
              <AppBadge :tone="isOpenNow(location) ? 'positive' : 'neutral'">
                {{ isOpenNow(location) ? t('locations.openNow') : t('locations.closedNow') }}
              </AppBadge>
            </div>

            <p class="clinic__place">{{ localized(location.place) }}</p>

            <div class="clinic__cols">
              <section>
                <h3 class="clinic__label">{{ t('locations.hours') }}</h3>
                <ul class="hours">
                  <li v-for="day in location.hours" :key="day.weekday">
                    <span>{{ t(`locations.days.${day.weekday}`) }}</span>
                    <span v-if="day.opensAt === null || day.closesAt === null" class="hours__off">
                      {{ t('locations.closed') }}
                    </span>
                    <span v-else class="hours__on">
                      {{ formatClock(day.opensAt, locale) }}–{{ formatClock(day.closesAt, locale) }}
                    </span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 class="clinic__label">{{ t('locations.gettingHere') }}</h3>
                <p class="clinic__text">{{ localized(location.gettingHere) }}</p>
                <p class="clinic__zone">{{ t('common.clinicTime', { zone: 'ET' }) }}</p>
              </section>
            </div>

            <div class="clinic__actions">
              <AppButton :to="{ name: 'book', query: { location: location.id } }" icon-right="arrow-right">
                {{ t('locations.book') }}
              </AppButton>
              <AppButton
                variant="secondary"
                :href="`tel:${location.phone.replace(/\D/g, '')}`"
                icon-left="phone"
              >
                {{ location.phone }}
              </AppButton>
            </div>
          </div>
        </article>
      </div>

      <p class="note">
        <AppIcon name="info" :size="18" />
        <span>{{ t('locations.addressNote') }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.clinics {
  display: flex;
  flex-direction: column;
  gap: var(--s7);
}

.clinic {
  display: grid;
  grid-template-columns: 0.8fr 1fr;
  gap: var(--s7);
  align-items: start;
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  scroll-margin-top: 120px;
}

.clinic__media {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
}

.clinic__plan {
  display: flex;
  flex-direction: column;
}

.clinic__figure {
  margin: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.clinic__figure img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.clinic__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.clinic__head {
  display: flex;
  align-items: center;
  gap: var(--s4);
}

.clinic__name {
  font-size: var(--text-2xl);
}

.clinic__place {
  margin-top: var(--s3);
  max-width: 56ch;
  color: var(--navy-600);
  line-height: 1.6;
}

.clinic__cols {
  display: grid;
  grid-template-columns: minmax(200px, 0.8fr) 1fr;
  gap: var(--s6);
  margin: var(--s6) 0;
  padding-top: var(--s5);
  border-top: 1px solid var(--border);
}

.clinic__label {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.hours {
  list-style: none;
  padding: 0;
  font-size: var(--text-sm);
}

.hours li {
  display: flex;
  justify-content: space-between;
  gap: var(--s4);
  padding-block: var(--s2);
  border-bottom: 1px dotted var(--border);
  color: var(--navy-600);
}

.hours li:last-child {
  border-bottom: none;
}

.hours__on {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--navy-800);
  white-space: nowrap;
}

.hours__off {
  color: var(--navy-200);
}

.clinic__text {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

.clinic__zone {
  margin-top: var(--s3);
  font-size: var(--text-xs);
  color: var(--text-soft);
}

.clinic__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: auto;
}

.note {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  max-width: 76ch;
  margin-top: var(--s7);
  padding: var(--s4) var(--s5);
  border-radius: var(--radius-sm);
  background: var(--paper-deep);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

.note svg {
  margin-top: 3px;
  color: var(--navy-400);
}

@media (max-width: 900px) {
  .clinic {
    grid-template-columns: 1fr;
    gap: var(--s5);
    padding: var(--s5);
  }

  .clinic__figure img {
    aspect-ratio: 16 / 9;
  }
}

@media (max-width: 560px) {
  .clinic__cols {
    grid-template-columns: 1fr;
    gap: var(--s5);
  }

  .clinic__actions > * {
    width: 100%;
  }
}
</style>

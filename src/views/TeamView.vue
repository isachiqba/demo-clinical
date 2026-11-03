<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { blocksOnWeekday, doctor } from '@/data/doctor'
import { locationById } from '@/data/locations'
import { localized } from '@/i18n'
import { formatClock } from '@/services/clinicTime'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/layout/PageHeader.vue'

const { t, locale } = useI18n()

/**
 * The consulting week, read straight off the one agenda the booking flow uses. Days he
 * does not consult are listed too, so the page is not quietly selective.
 */
const week = computed(() =>
  [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    label: t(`locations.days.${weekday}`),
    sessions: blocksOnWeekday(weekday).map((block) => ({
      key: `${block.locationId}-${block.startsAt}`,
      clinic: localized(locationById(block.locationId)?.name),
      hours: `${formatClock(block.startsAt, locale.value)}–${formatClock(block.endsAt, locale.value)}`
    }))
  }))
)

const speaks = computed(() =>
  doctor.languages.map((code) => t(`language.${code}`)).join(' · ')
)
</script>

<template>
  <PageHeader :title="t('team.title')" />

  <section class="band">
    <div class="page-width">
      <article class="person">
        <figure class="person__figure">
          <img
            :src="doctor.image"
            :alt="t('demo.illustrativeShort')"
            width="640"
            height="640"
            loading="lazy"
          />
          <figcaption v-if="doctor.imageIsIllustrative" class="illustrative">
            {{ t('demo.illustrativeShort') }}
          </figcaption>
        </figure>

        <div class="person__body">
          <h2 class="person__name">{{ doctor.name }}</h2>
          <p class="person__role">{{ localized(doctor.care) }}</p>
          <p v-for="(paragraph, index) in doctor.bio" :key="index" class="person__about">
            {{ localized(paragraph) }}
          </p>

          <dl class="person__meta">
            <div>
              <dt>{{ t('team.speaks') }}</dt>
              <dd>{{ speaks }}</dd>
            </div>
            <div>
              <dt>{{ t('team.whereLabel') }}</dt>
              <dd>{{ t('team.whereValue') }}</dd>
            </div>
          </dl>

          <p class="person__invite">{{ localized(doctor.invitation) }}</p>
          <AppButton :to="{ name: 'book' }" icon-right="arrow-right">
            {{ t('nav.book') }}
          </AppButton>
        </div>
      </article>

      <section class="hours" :aria-label="t('team.hours.title')">
        <h2 class="hours__title">{{ t('team.hours.title') }}</h2>
        <p class="hours__lede">{{ t('team.hours.lede') }}</p>

        <ul class="hours__week">
          <li v-for="day in week" :key="day.weekday" class="day">
            <span class="day__name">{{ day.label }}</span>
            <span v-if="!day.sessions.length" class="day__off">{{ t('team.hours.off') }}</span>
            <ul v-else class="day__sessions">
              <li v-for="session in day.sessions" :key="session.key" class="session">
                <span class="session__hours">{{ session.hours }}</span>
                <span class="session__clinic">{{ session.clinic }}</span>
              </li>
            </ul>
          </li>
        </ul>

        <p class="hours__note">{{ t('team.hours.note') }}</p>
      </section>

      <p class="note">
        <AppIcon name="info" :size="18" />
        <span>{{ t('team.disclaimer') }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.people {
  display: flex;
  flex-direction: column;
  gap: var(--s6);
  list-style: none;
  padding: 0;
}

.person {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--s7);
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.person__figure {
  margin: 0;
}

.person__figure img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius-md);
}

.person__figure figcaption {
  margin-top: var(--s2);
}

.person__name {
  font-size: var(--text-2xl);
}

.person__role {
  margin-top: var(--s1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--teal-700);
}

.person__about {
  margin-top: var(--s4);
  max-width: 62ch;
  color: var(--navy-600);
  line-height: 1.6;
}

.person__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--s4);
  margin: var(--s5) 0 var(--s6);
  padding-top: var(--s5);
  border-top: 1px solid var(--border);
}

.person__meta dt {
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.person__meta dd {
  margin: var(--s1) 0 0;
  font-size: var(--text-sm);
  color: var(--navy-600);
}

.person__note {
  margin-top: var(--s2);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.person__invite {
  max-width: 62ch;
  margin: var(--s6) 0 var(--s4);
  font-size: var(--text-md);
  font-weight: 500;
  line-height: 1.55;
  color: var(--navy-800);
}

.note {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  max-width: 80ch;
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


.hours {
  max-width: 820px;
  margin-top: var(--s7);
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.hours__title {
  font-size: var(--text-xl);
}

.hours__lede {
  margin-top: var(--s2);
  max-width: 62ch;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

.hours__week {
  margin: var(--s5) 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}

.day {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: var(--s4);
  padding: var(--s3) 0;
  border-bottom: 1px solid var(--border);
}

.day__name {
  font-weight: 600;
  color: var(--navy-800);
}

.day__off {
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.day__sessions {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.session {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s3);
}

.session__hours {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--navy-700);
}

.session__clinic {
  font-size: var(--text-sm);
  color: var(--navy-600);
}

.hours__note {
  margin-top: var(--s5);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--text-soft);
}

@media (max-width: 600px) {
  .hours {
    padding: var(--s5);
  }

  .day {
    grid-template-columns: 1fr;
    gap: var(--s2);
  }
}

@media (max-width: 760px) {
  .person {
    grid-template-columns: 1fr;
    gap: var(--s5);
    padding: var(--s5);
  }

  .person__figure img {
    aspect-ratio: 3 / 2;
    object-position: 50% 26%;
  }
}
</style>

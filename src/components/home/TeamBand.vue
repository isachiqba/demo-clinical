<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { providers } from '@/data/providers'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import SectionHead from '@/components/ui/SectionHead.vue'

const { t } = useI18n()

const clinicsOf = (ids: string[]): string =>
  ids
    .map((id) => locations.find((location) => location.id === id))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))
    .map((location) => localized(location.name))
    .join(' · ')
</script>

<template>
  <section class="band">
    <div class="page-width">
      <SectionHead
        :kicker="t('home.team.kicker')"
        :title="t('home.team.title')"
        :lede="t('home.team.lede')"
      />

      <ul class="team">
        <li v-for="provider in providers" :key="provider.id" class="person">
          <figure class="person__figure">
            <img
              :src="provider.image"
              :alt="t('demo.illustrativeShort')"
              width="640"
              height="640"
              loading="lazy"
            />
          </figure>
          <h3 class="person__name">{{ provider.name }}</h3>
          <p class="person__role">{{ localized(provider.role) }}</p>
          <dl class="person__meta">
            <div>
              <dt>{{ t('team.speaks') }}</dt>
              <dd>{{ provider.languages.map((code) => t(`language.${code}`)).join(' · ') }}</dd>
            </div>
            <div>
              <dt>{{ t('team.worksAt') }}</dt>
              <dd>{{ clinicsOf(provider.locationIds) }}</dd>
            </div>
          </dl>
          <p class="illustrative person__note">{{ t('demo.illustrative') }}</p>
        </li>
      </ul>

      <div class="more">
        <AppButton :to="{ name: 'team' }" variant="secondary" icon-right="arrow-right">
          {{ t('home.team.more') }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.team {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s7);
  list-style: none;
  padding: 0;
}

.person__figure {
  margin: 0 0 var(--s5);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--paper-deep);
}

.person__figure img {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  object-position: 50% 28%;
}

.person__name {
  font-size: var(--text-xl);
}

.person__role {
  margin-top: var(--s1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--teal-700);
}

.person__meta {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  margin: var(--s4) 0 0;
  padding-top: var(--s4);
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
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--navy-600);
}

.person__note {
  margin-top: var(--s4);
}

.more {
  margin-top: var(--s8);
}

@media (max-width: 860px) {
  .team {
    grid-template-columns: 1fr 1fr;
    gap: var(--s6);
  }
}

@media (max-width: 560px) {
  .team {
    grid-template-columns: 1fr;
  }

  .person__figure img {
    aspect-ratio: 3 / 2;
    object-position: 50% 24%;
  }
}
</style>

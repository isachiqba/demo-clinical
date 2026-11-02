<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { providers } from '@/data/providers'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/layout/PageHeader.vue'

const { t } = useI18n()

const clinicsOf = (ids: string[]): string =>
  ids
    .map((id) => locations.find((location) => location.id === id))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))
    .map((location) => localized(location.name))
    .join(' · ')

const servicesOf = (ids: string[]): string =>
  ids
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is NonNullable<typeof service> => Boolean(service))
    .map((service) => localized(service.name))
    .join(' · ')
</script>

<template>
  <PageHeader :title="t('team.title')" :lede="t('team.lede')" />

  <section class="band">
    <div class="page-width">
      <ul class="people">
        <li v-for="provider in providers" :key="provider.id" class="person">
          <figure class="person__figure">
            <img
              :src="provider.image"
              :alt="t('demo.illustrativeShort')"
              width="640"
              height="640"
              loading="lazy"
            />
            <figcaption class="illustrative">{{ t('demo.illustrativeShort') }}</figcaption>
          </figure>

          <div class="person__body">
            <h2 class="person__name">{{ provider.name }}</h2>
            <p class="person__role">{{ localized(provider.role) }}</p>
            <p class="person__about">{{ localized(provider.about) }}</p>

            <dl class="person__meta">
              <div>
                <dt>{{ t('team.speaks') }}</dt>
                <dd>{{ provider.languages.map((code) => t(`language.${code}`)).join(' · ') }}</dd>
              </div>
              <div>
                <dt>{{ t('team.worksAt') }}</dt>
                <dd>{{ clinicsOf(provider.locationIds) }}</dd>
              </div>
              <div>
                <dt>{{ t('team.offers') }}</dt>
                <dd>{{ servicesOf(provider.serviceIds) }}</dd>
              </div>
            </dl>

            <AppButton
              variant="secondary"
              :to="{ name: 'book', query: { provider: provider.id } }"
              icon-right="arrow-right"
            >
              {{ t('team.book', { name: provider.name }) }}
            </AppButton>
          </div>
        </li>
      </ul>

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

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import SectionHead from '@/components/ui/SectionHead.vue'

const { t } = useI18n()
</script>

<template>
  <section class="band band--paper">
    <div class="page-width">
      <SectionHead
        :kicker="t('home.locations.kicker')"
        :title="t('home.locations.title')"
        :lede="t('home.locations.lede')"
      />

      <ul class="clinics">
        <li v-for="location in locations" :key="location.id" class="clinic">
          <figure class="clinic__figure">
            <img
              :src="location.image"
              :alt="t('locations.imageAlt', { name: localized(location.name) })"
              width="1200"
              height="900"
              loading="lazy"
            />
          </figure>
          <h3 class="clinic__name">{{ localized(location.name) }}</h3>
          <p class="clinic__place">{{ localized(location.place) }}</p>
          <div class="clinic__links">
            <RouterLink class="clinic__link" :to="{ name: 'book', query: { location: location.id } }">
              {{ t('locations.book') }}
              <AppIcon name="arrow-right" :size="15" />
            </RouterLink>
            <a class="clinic__phone" :href="`tel:${location.phone.replace(/\D/g, '')}`">
              {{ location.phone }}
            </a>
          </div>
        </li>
      </ul>

      <div class="more">
        <AppButton :to="{ name: 'locations' }" variant="secondary" icon-right="arrow-right">
          {{ t('home.locations.more') }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.clinics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s6);
  list-style: none;
  padding: 0;
}

.clinic__figure {
  margin: 0 0 var(--s5);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
}

.clinic__figure img {
  width: 100%;
  aspect-ratio: 5 / 4;
  object-fit: cover;
}

.clinic__name {
  font-size: var(--text-xl);
}

.clinic__place {
  margin-top: var(--s2);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--navy-600);
}

.clinic__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s4);
  margin-top: var(--s4);
}

.clinic__link {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
}

.clinic__link:hover {
  text-decoration: underline;
}

.clinic__phone {
  font-size: var(--text-sm);
  color: var(--navy-400);
  text-decoration: none;
}

.clinic__phone:hover {
  color: var(--navy-800);
}

.more {
  margin-top: var(--s8);
}

@media (max-width: 860px) {
  .clinics {
    grid-template-columns: 1fr;
    gap: var(--s7);
  }

  .clinic__figure img {
    aspect-ratio: 16 / 9;
  }
}
</style>

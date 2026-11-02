<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import AppIcon from '@/components/ui/AppIcon.vue'
import LogoMark from './LogoMark.vue'

const { t } = useI18n()

const links = [
  { name: 'care', label: 'nav.care' },
  { name: 'team', label: 'nav.team' },
  { name: 'locations', label: 'nav.locations' },
  { name: 'info', label: 'nav.info' },
  { name: 'book', label: 'nav.book' }
] as const
</script>

<template>
  <footer class="foot">
    <div class="page-width foot__grid">
      <div class="foot__brand">
        <LogoMark tone="light" />
        <p class="foot__line">{{ t('brand.line') }}</p>
      </div>

      <nav class="foot__col" :aria-label="t('footer.explore')">
        <h2 class="foot__title">{{ t('footer.explore') }}</h2>
        <ul class="foot__list">
          <li v-for="link in links" :key="link.name">
            <RouterLink :to="{ name: link.name }">{{ t(link.label) }}</RouterLink>
          </li>
        </ul>
      </nav>

      <div class="foot__col">
        <h2 class="foot__title">{{ t('footer.clinics') }}</h2>
        <ul class="foot__list">
          <li v-for="location in locations" :key="location.id">
            <RouterLink :to="{ name: 'locations', hash: `#${location.id}` }">
              {{ localized(location.name) }}
            </RouterLink>
            <span class="foot__muted">{{ location.phone }}</span>
          </li>
        </ul>
      </div>

      <div class="foot__col">
        <h2 class="foot__title">{{ t('footer.practice') }}</h2>
        <ul class="foot__list">
          <li>
            <RouterLink :to="{ name: 'info', hash: '#image-credits' }">{{ t('footer.credits') }}</RouterLink>
          </li>
          <li>
            <RouterLink class="foot__reception" :to="{ name: 'reception' }">
              <AppIcon name="log-in" :size="15" />
              <span>{{ t('footer.reception') }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="page-width foot__legal">
      <p>{{ t('footer.disclaimer') }}</p>
      <p class="foot__emergency">{{ t('footer.emergency') }}</p>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  margin-top: var(--s10);
  padding-block: var(--s9) var(--s6);
  background: var(--navy-900);
  color: var(--navy-200);
}

.foot__grid {
  display: grid;
  grid-template-columns: 1.6fr repeat(3, 1fr);
  gap: var(--s8) var(--s6);
}

.foot__line {
  margin-top: var(--s4);
  max-width: 30ch;
  font-size: var(--text-sm);
  color: var(--navy-200);
}

.foot__title {
  margin-bottom: var(--s4);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--teal-200);
}

.foot__list {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  list-style: none;
  padding: 0;
}

.foot__list a {
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
}

.foot__list a:hover {
  color: var(--teal-200);
  text-decoration: underline;
}

.foot__muted {
  display: block;
  font-size: var(--text-xs);
  color: var(--navy-200);
  opacity: 0.75;
}

.foot__reception {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: var(--s1) var(--s3) var(--s1) var(--s2);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs) !important;
}

.foot__reception:hover {
  border-color: var(--teal-200);
}

.foot__legal {
  display: grid;
  gap: var(--s2);
  margin-top: var(--s8);
  padding-top: var(--s5);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  font-size: var(--text-xs);
  line-height: 1.6;
  color: var(--navy-200);
  opacity: 0.85;
}

.foot__emergency {
  font-weight: 600;
  opacity: 1;
}

@media (max-width: 860px) {
  .foot__grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 520px) {
  .foot__grid {
    grid-template-columns: 1fr;
    gap: var(--s7);
  }
}
</style>

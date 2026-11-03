<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import SectionHead from '@/components/ui/SectionHead.vue'

const { t } = useI18n()
</script>

<template>
  <section class="band">
    <div class="page-width">
      <SectionHead
        :kicker="t('home.services.kicker')"
        :title="t('home.services.title')"
        :lede="t('home.services.lede')"
      />

      <ul class="list">
        <li v-for="service in services" :key="service.id" class="list__item">
          <RouterLink class="card" :to="{ name: 'book', query: { service: service.id } }">
            <span class="card__icon"><AppIcon :name="service.icon" :size="20" /></span>
            <span class="card__text">
              <span class="card__name">{{ localized(service.name) }}</span>
              <span class="card__summary">{{ localized(service.summary) }}</span>
            </span>
            <span class="card__meta">
              <span class="card__duration">{{ t('home.services.ask') }}</span>
              <AppIcon name="arrow-right" :size="16" class="card__arrow" />
            </span>
          </RouterLink>
        </li>
      </ul>

      <div class="more">
        <AppButton :to="{ name: 'care' }" variant="secondary" icon-right="arrow-right">
          {{ t('home.services.more') }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  list-style: none;
  padding: 0;
  border-top: 1px solid var(--border);
}

.list__item {
  border-bottom: 1px solid var(--border);
}

.list__item:nth-child(odd) {
  border-right: 1px solid var(--border);
}

.card {
  display: flex;
  align-items: flex-start;
  gap: var(--s4);
  height: 100%;
  padding: var(--s6) var(--s6) var(--s6) 0;
  color: inherit;
  text-decoration: none;
  transition: background-color 0.16s var(--ease);
}

.list__item:nth-child(even) .card {
  padding-left: var(--s6);
  padding-right: 0;
}

.card:hover {
  background: var(--teal-50);
  color: inherit;
}

.card__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: var(--radius-sm);
  background: var(--sage-100);
  color: var(--sage-700);
  transition: background-color 0.16s var(--ease), color 0.16s var(--ease);
}

.card:hover .card__icon {
  background: var(--teal-600);
  color: #fff;
}

.card__text {
  flex: 1;
  min-width: 0;
}

.card__name {
  display: block;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--navy-800);
}

.card__summary {
  display: block;
  margin-top: var(--s2);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--navy-400);
}

.card__meta {
  display: flex;
  align-items: center;
  gap: var(--s3);
  flex: none;
  padding-top: var(--s2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--teal-700);
}

.card__arrow {
  transition: transform 0.16s var(--ease);
}

.card:hover .card__arrow {
  transform: translateX(3px);
}

.more {
  margin-top: var(--s7);
}

@media (max-width: 780px) {
  .list {
    grid-template-columns: 1fr;
  }

  .list__item:nth-child(odd) {
    border-right: none;
  }

  .card,
  .list__item:nth-child(even) .card {
    padding: var(--s5) 0;
  }
}
</style>

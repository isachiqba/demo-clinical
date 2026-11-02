<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import ApproachBand from '@/components/home/ApproachBand.vue'

const { t } = useI18n()
</script>

<template>
  <PageHeader :title="t('care.title')" :lede="t('care.lede')" />

  <section class="band">
    <div class="page-width">
      <ul class="services">
        <li v-for="service in services" :key="service.id" class="service">
          <div class="service__head">
            <span class="service__icon"><AppIcon :name="service.icon" :size="22" /></span>
            <div>
              <h2 class="service__name">{{ localized(service.name) }}</h2>
              <p class="service__duration">
                {{ t('care.duration') }}: {{ t('common.minutes', { count: service.durationMinutes }) }}
              </p>
            </div>
          </div>
          <p class="service__detail">{{ localized(service.detail) }}</p>
          <AppButton
            class="service__cta"
            variant="secondary"
            :to="{ name: 'book', query: { service: service.id } }"
            icon-right="arrow-right"
          >
            {{ t('care.book') }}
          </AppButton>
        </li>
      </ul>

      <p class="disclaimer">
        <AppIcon name="info" :size="18" />
        <span>{{ t('care.notAdvice') }}</span>
      </p>
    </div>
  </section>

  <ApproachBand />
</template>

<style scoped>
.services {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s6);
  list-style: none;
  padding: 0;
}

.service {
  display: flex;
  flex-direction: column;
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.service__head {
  display: flex;
  align-items: flex-start;
  gap: var(--s4);
}

.service__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-sm);
  background: var(--sage-100);
  color: var(--sage-700);
}

.service__name {
  font-size: var(--text-2xl);
}

.service__duration {
  margin-top: var(--s1);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--navy-400);
}

.service__detail {
  flex: 1;
  margin: var(--s5) 0 var(--s6);
  color: var(--navy-600);
  line-height: 1.6;
}

.service__cta {
  align-self: flex-start;
}

.disclaimer {
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

.disclaimer svg {
  margin-top: 3px;
  color: var(--navy-400);
}

@media (max-width: 780px) {
  .services {
    grid-template-columns: 1fr;
  }

  .service {
    padding: var(--s5);
  }
}
</style>

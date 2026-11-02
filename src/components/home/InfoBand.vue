<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CLINIC_TIME_ZONE, zoneAbbreviation } from '@/services/clinicTime'
import AppButton from '@/components/ui/AppButton.vue'

const { t } = useI18n()
const faqKeys = ['account', 'change', 'who'] as const
</script>

<template>
  <section class="band">
    <div class="page-width info">
      <div class="info__intro">
        <p class="kicker">{{ t('home.info.kicker') }}</p>
        <h2 class="info__title">{{ t('home.info.title') }}</h2>
        <p class="lede info__lede">{{ t('home.info.lede') }}</p>
        <AppButton :to="{ name: 'info' }" variant="secondary" icon-right="arrow-right">
          {{ t('home.info.more') }}
        </AppButton>
      </div>

      <dl class="info__faq">
        <div v-for="key in faqKeys" :key="key" class="info__item">
          <dt>{{ t(`info.faq.items.${key}.q`) }}</dt>
          <dd>{{ t(`info.faq.items.${key}.a`) }}</dd>
        </div>
        <div class="info__item">
          <dt>{{ t('info.faq.items.timezone.q') }}</dt>
          <dd>
            {{ t('info.faq.items.timezone.a', { zone: `${CLINIC_TIME_ZONE} · ${zoneAbbreviation()}` }) }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.info {
  display: grid;
  grid-template-columns: 0.8fr 1fr;
  gap: var(--s9);
  align-items: start;
}

.info__title {
  margin-top: var(--s3);
  font-size: var(--text-3xl);
  max-width: 16ch;
}

.info__lede {
  margin-block: var(--s4) var(--s6);
}

.info__faq {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.info__item {
  padding-block: var(--s5);
  border-top: 1px solid var(--border);
}

.info__item:last-child {
  border-bottom: 1px solid var(--border);
}

.info__item dt {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--navy-800);
}

.info__item dd {
  margin: var(--s2) 0 0;
  max-width: 58ch;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

@media (max-width: 920px) {
  .info {
    grid-template-columns: 1fr;
    gap: var(--s7);
  }

  .info__title {
    max-width: none;
  }
}
</style>

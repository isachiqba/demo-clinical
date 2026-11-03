<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { imageCredits, UNSPLASH_LICENSE } from '@/data/imageCredits'
import { CLINIC_TIME_ZONE, zoneAbbreviation } from '@/services/clinicTime'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/layout/PageHeader.vue'

const { t } = useI18n()

const faqKeys = ['account', 'change', 'spanish', 'timezone'] as const
const openKey = ref<string | null>('account')

const toggle = (key: string): void => {
  openKey.value = openKey.value === key ? null : key
}

const answerFor = (key: string): string =>
  key === 'timezone'
    ? t('info.faq.items.timezone.a', { zone: `${CLINIC_TIME_ZONE} · ${zoneAbbreviation()}` })
    : t(`info.faq.items.${key}.a`)
</script>

<template>
  <PageHeader :title="t('info.title')" :lede="t('info.lede')" />

  <section class="band">
    <div class="page-width info">
      <article class="panel">
        <h2 class="panel__title">{{ t('info.first.title') }}</h2>
        <p class="panel__body">{{ t('info.first.body') }}</p>
      </article>

      <article class="panel">
        <h2 class="panel__title">{{ t('info.payment.title') }}</h2>
        <p class="panel__body">{{ t('info.payment.body') }}</p>
      </article>
    </div>
  </section>

  <section class="band band--sage">
    <div class="page-width page-width--narrow">
      <h2 class="faq__title">{{ t('info.faq.title') }}</h2>

      <ul class="faq">
        <li v-for="key in faqKeys" :key="key" class="faq__item">
          <h3 class="faq__heading">
            <button
              class="faq__button"
              type="button"
              :aria-expanded="openKey === key"
              :aria-controls="`faq-${key}`"
              @click="toggle(key)"
            >
              <span>{{ t(`info.faq.items.${key}.q`) }}</span>
              <AppIcon :name="openKey === key ? 'chevron-down' : 'chevron-right'" :size="20" />
            </button>
          </h3>
          <div v-show="openKey === key" :id="`faq-${key}`" class="faq__answer">
            {{ answerFor(key) }}
          </div>
        </li>
      </ul>

      <div class="faq__cta">
        <AppButton :to="{ name: 'book' }" icon-right="arrow-right">{{ t('nav.book') }}</AppButton>
      </div>
    </div>
  </section>

  <section id="image-credits" class="band band--tight">
    <div class="page-width page-width--narrow">
      <h2 class="credits__title">{{ t('info.credits.title') }}</h2>
      <p class="credits__body">
        {{ t('info.credits.body') }}
        <a :href="UNSPLASH_LICENSE" target="_blank" rel="noreferrer noopener">Unsplash License</a>.
      </p>
      <ul class="credits">
        <li v-for="credit in imageCredits" :key="credit.file" class="credits__row">
          <code>{{ credit.file }}</code>
          <span>{{ t('info.credits.photographer', { name: credit.photographer }) }}</span>
          <a :href="credit.source" target="_blank" rel="noreferrer noopener">
            {{ t('info.credits.view') }}
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s6);
}

.panel {
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.panel__title {
  font-size: var(--text-2xl);
}

.panel__body {
  margin-top: var(--s4);
  color: var(--navy-600);
  line-height: 1.65;
}

.faq__title {
  margin-bottom: var(--s6);
  font-size: var(--text-3xl);
}

.faq {
  list-style: none;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.faq__item + .faq__item {
  border-top: 1px solid var(--border);
}

.faq__heading {
  margin: 0;
}

.faq__button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  width: 100%;
  min-height: 62px;
  padding: var(--s4) var(--s5);
  border: none;
  background: transparent;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--navy-800);
  text-align: left;
  cursor: pointer;
}

.faq__button:hover {
  background: var(--teal-50);
}

.faq__answer {
  padding: 0 var(--s5) var(--s5);
  max-width: 66ch;
  color: var(--navy-600);
  line-height: 1.65;
}

.faq__cta {
  margin-top: var(--s7);
}

.credits__title {
  font-size: var(--text-2xl);
}

.credits__body {
  margin-top: var(--s3);
  max-width: 68ch;
  color: var(--navy-600);
}

.credits {
  margin-top: var(--s5);
  list-style: none;
  padding: 0;
  border-top: 1px solid var(--border);
}

.credits__row {
  display: grid;
  grid-template-columns: minmax(170px, auto) 1fr auto;
  gap: var(--s4);
  align-items: baseline;
  padding-block: var(--s3);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
  color: var(--navy-600);
}

.credits__row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-xs);
  color: var(--navy-400);
}

@media (max-width: 780px) {
  .info {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: var(--s5);
  }

  .credits__row {
    grid-template-columns: 1fr;
    gap: var(--s1);
  }
}
</style>

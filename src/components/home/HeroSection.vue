<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'

const { t } = useI18n()
</script>

<template>
  <section class="hero">
    <div class="page-width hero__grid">
      <div class="hero__text">
        <p class="hero__kicker">{{ t('home.hero.kicker') }}</p>
        <h1 class="hero__title">{{ t('home.hero.title') }}</h1>
        <p class="hero__body">{{ t('home.hero.body') }}</p>

        <div class="hero__actions">
          <AppButton :to="{ name: 'book' }" size="lg" icon-right="arrow-right">
            {{ t('home.hero.book') }}
          </AppButton>
          <AppButton :to="{ name: 'team' }" variant="secondary" size="lg">
            {{ t('home.hero.meet') }}
          </AppButton>
        </div>

        <p class="hero__clinics">{{ t('home.hero.clinics') }}</p>
        <p class="hero__languages">{{ t('home.hero.languages') }}</p>
      </div>

      <figure class="hero__figure">
        <img
          src="/images/hero-consultation.webp"
          :alt="t('home.hero.imageAlt')"
          width="1800"
          height="1200"
          fetchpriority="high"
        />
        <figcaption class="illustrative">{{ t('demo.illustrativeShort') }}</figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-block: var(--s10) var(--s9);
  background: linear-gradient(180deg, var(--paper) 0%, var(--sage-50) 100%);
}

.hero__grid {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: var(--s9);
  align-items: center;
}

.hero__kicker {
  margin-bottom: var(--s3);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--teal-700);
}

.hero__title {
  font-size: var(--text-5xl);
  max-width: 13ch;
  letter-spacing: -0.02em;
}

.hero__body {
  margin-top: var(--s5);
  max-width: 46ch;
  font-size: var(--text-lg);
  line-height: 1.6;
  color: var(--navy-600);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s7);
}

.hero__clinics {
  margin-top: var(--s5);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--navy-700);
}

.hero__languages {
  display: flex;
  align-items: center;
  gap: var(--s2);
  margin-top: var(--s2);
  font-size: var(--text-sm);
  color: var(--text-soft);
}

.hero__languages::before {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--navy-200);
}

.hero__figure {
  margin: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  background: var(--paper-deep);
}

.hero__figure figcaption {
  margin-top: var(--s2);
}

.hero__figure img {
  width: 100%;
  aspect-ratio: 5 / 4;
  object-fit: cover;
  object-position: 62% 40%;
}

@media (max-width: 980px) {
  .hero {
    padding-block: var(--s8) var(--s8);
  }

  .hero__grid {
    grid-template-columns: 1fr;
    gap: var(--s7);
  }

  .hero__title,
  .hero__body {
    max-width: none;
  }

  .hero__figure img {
    aspect-ratio: 16 / 10;
  }
}

@media (max-width: 560px) {
  .hero__actions > * {
    width: 100%;
  }

  .hero__figure img {
    aspect-ratio: 4 / 3;
  }
}
</style>

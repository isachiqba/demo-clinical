<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const points = ['listening', 'continuity', 'convenience'] as const
</script>

<template>
  <section class="band band--sage approach">
    <div class="page-width approach__grid">
      <figure class="approach__figure">
        <img
          src="/images/care-notes.webp"
          :alt="t('home.approach.imageAlt')"
          width="1200"
          height="900"
          loading="lazy"
        />
      </figure>

      <div class="approach__text">
        <p class="kicker">{{ t('home.approach.kicker') }}</p>
        <h2 class="approach__title">{{ t('home.approach.title') }}</h2>

        <dl class="approach__points">
          <div v-for="point in points" :key="point" class="approach__point">
            <dt>{{ t(`home.approach.points.${point}.title`) }}</dt>
            <dd>{{ t(`home.approach.points.${point}.body`) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.approach__grid {
  display: grid;
  grid-template-columns: 0.85fr 1fr;
  gap: var(--s9);
  align-items: center;
}

.approach__figure {
  margin: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.approach__figure img {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
}

.approach__title {
  margin-top: var(--s3);
  font-size: var(--text-3xl);
  max-width: 18ch;
}

.approach__points {
  display: flex;
  flex-direction: column;
  margin: var(--s7) 0 0;
}

.approach__point {
  padding-block: var(--s5);
  border-top: 1px solid var(--sage-200);
}

.approach__point:last-child {
  border-bottom: 1px solid var(--sage-200);
}

.approach__point dt {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--navy-800);
}

.approach__point dd {
  margin: var(--s2) 0 0;
  max-width: 54ch;
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--navy-600);
}

@media (max-width: 920px) {
  .approach__grid {
    grid-template-columns: 1fr;
    gap: var(--s7);
  }

  .approach__figure img {
    aspect-ratio: 16 / 9;
  }

  .approach__title {
    max-width: none;
  }
}
</style>

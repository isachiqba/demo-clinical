<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'

const { t } = useI18n()
</script>

<template>
  <section class="closing">
    <div class="page-width closing__inner">
      <div>
        <h2 class="closing__title">{{ t('home.closing.title') }}</h2>
        <p class="closing__body">{{ t('home.closing.body') }}</p>
      </div>
      <AppButton :to="{ name: 'book' }" size="lg" icon-right="arrow-right">
        {{ t('home.closing.action') }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.closing {
  padding-block: var(--s9);
  background: var(--navy-800);
}

.closing__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s6);
}

.closing__title {
  color: #fff;
  font-size: var(--text-3xl);
}

.closing__body {
  margin-top: var(--s3);
  max-width: 52ch;
  color: var(--navy-200);
}
</style>

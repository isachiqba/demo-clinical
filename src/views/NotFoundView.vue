<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'

const { t } = useI18n()
</script>

<template>
  <div class="page-width missing">
    <h1 class="missing__title">{{ t('notFound.title') }}</h1>
    <p class="missing__body">{{ t('notFound.body') }}</p>
    <AppButton :to="{ name: 'home' }" icon-left="arrow-left">{{ t('notFound.action') }}</AppButton>
  </div>
</template>

<style scoped>
.missing {
  max-width: 560px;
  padding-block: var(--s11);
  text-align: center;
}

.missing__title {
  font-size: var(--text-3xl);
}

.missing__body {
  margin: var(--s4) 0 var(--s6);
  color: var(--navy-600);
}
</style>

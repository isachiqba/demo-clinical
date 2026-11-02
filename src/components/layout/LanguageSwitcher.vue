<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale } from '@/i18n'
import type { Locale } from '@/types'

withDefaults(defineProps<{ tone?: 'light' | 'dark' }>(), { tone: 'light' })

const { t, locale } = useI18n()
</script>

<template>
  <div class="lang" :class="`lang--${tone}`" role="group" :aria-label="t('common.language')">
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      class="lang__btn"
      type="button"
      :class="{ 'lang__btn--on': locale === code }"
      :aria-pressed="locale === code"
      :title="t('language.switchTo', { language: t(`language.${code}`) })"
      @click="setLocale(code as Locale)"
    >
      {{ code.toUpperCase() }}
      <span class="sr-only">{{ t(`language.${code}`) }}</span>
    </button>
  </div>
</template>

<style scoped>
.lang {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
}

.lang__btn {
  min-width: 38px;
  min-height: 32px;
  padding-inline: var(--s2);
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--navy-400);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background-color 0.16s var(--ease), color 0.16s var(--ease);
}

.lang__btn:hover {
  color: var(--navy-800);
}

.lang__btn.lang__btn--on,
.lang__btn.lang__btn--on:hover {
  background: var(--navy-800);
  color: #fff;
}

.lang--dark {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.lang--dark .lang__btn {
  color: var(--navy-200);
}

.lang--dark .lang__btn:hover {
  color: #fff;
}

.lang--dark .lang__btn--on {
  background: var(--teal-600);
  color: #fff;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'

const { t } = useI18n()
const route = useRoute()

/** The reception demo is an app layout of its own, without the website chrome. */
const showChrome = computed(() => route.meta.chrome !== false)
</script>

<template>
  <a class="skip-link" href="#main">{{ t('common.skipToContent') }}</a>
  <SiteHeader v-if="showChrome" />
  <main id="main" tabindex="-1">
    <RouterView />
  </main>
  <SiteFooter v-if="showChrome" />
</template>

<style scoped>
main {
  outline: none;
}
</style>

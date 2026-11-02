<script setup lang="ts">
defineProps<{ title: string; lede?: string }>()
</script>

<template>
  <header class="ph">
    <div class="page-width">
      <h1 class="ph__title">{{ title }}</h1>
      <p v-if="lede" class="lede ph__lede">{{ lede }}</p>
      <slot />
    </div>
  </header>
</template>

<style scoped>
.ph {
  padding-block: var(--s9) var(--s8);
  background: var(--sage-50);
  border-bottom: 1px solid var(--border);
}

.ph__title {
  font-size: var(--text-4xl);
  max-width: 18ch;
}

.ph__lede {
  margin-top: var(--s4);
}
</style>

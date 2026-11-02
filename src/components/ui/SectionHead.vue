<script setup lang="ts">
defineProps<{ kicker?: string; title: string; lede?: string; align?: 'start' | 'center' }>()
</script>

<template>
  <header class="head" :class="{ 'head--center': align === 'center' }">
    <p v-if="kicker" class="kicker">{{ kicker }}</p>
    <h2 class="head__title">{{ title }}</h2>
    <p v-if="lede" class="lede head__lede">{{ lede }}</p>
    <slot />
  </header>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  margin-bottom: var(--s8);
}

.head__title {
  font-size: var(--text-3xl);
  max-width: 20ch;
}

.head--center {
  align-items: center;
  text-align: center;
}

.head--center .head__title,
.head--center .head__lede {
  max-width: 34ch;
}

.head--center .head__lede {
  max-width: 54ch;
}
</style>

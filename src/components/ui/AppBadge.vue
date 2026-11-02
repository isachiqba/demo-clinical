<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: 'neutral' | 'accent' | 'sage' | 'positive' | 'caution' | 'critical' }>(),
  { tone: 'neutral' }
)
</script>

<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  padding: 3px var(--s3);
  border-radius: var(--radius-pill);
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.45;
  white-space: nowrap;
}

.badge--neutral {
  background: var(--paper-deep);
  color: var(--navy-600);
}
.badge--accent {
  background: var(--teal-50);
  color: var(--teal-700);
}
.badge--sage {
  background: var(--sage-100);
  color: var(--sage-700);
}
.badge--positive {
  background: var(--positive-bg);
  color: var(--positive-fg);
}
.badge--caution {
  background: var(--caution-bg);
  color: var(--caution-fg);
}
.badge--critical {
  background: var(--critical-bg);
  color: var(--critical-fg);
}
</style>

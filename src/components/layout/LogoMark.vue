<script setup lang="ts">
/**
 * The wordmark. The symbol is an open ring with a single centred dot: the ring is the
 * "o" of lorba redrawn, left open to read as attention rather than enclosure, and the
 * dot is the one patient it is turned towards. No cross, no caduceus, no heart.
 */
withDefaults(defineProps<{ tone?: 'ink' | 'light'; compact?: boolean }>(), {
  tone: 'ink',
  compact: false
})
</script>

<template>
  <span class="logo" :class="[`logo--${tone}`, { 'logo--compact': compact }]">
    <svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M27 16a11 11 0 1 1-6.6-10.1"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <circle cx="16" cy="16" r="3.9" fill="currentColor" />
    </svg>
    <span class="logo__words">
      <span class="logo__name">lorba</span>
      <span class="logo__suffix">medical</span>
    </span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: var(--s3);
  text-decoration: none;
  line-height: 1;
}

.logo__mark {
  width: 30px;
  height: 30px;
  flex: none;
  color: var(--teal-600);
}

.logo__words {
  display: flex;
  align-items: baseline;
  gap: 0.42em;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: -0.015em;
}

.logo__name {
  font-weight: 600;
}

.logo__suffix {
  font-weight: 400;
  font-size: 0.78em;
  letter-spacing: 0.06em;
}

.logo--ink .logo__name {
  color: var(--navy-800);
}

.logo--ink .logo__suffix {
  color: var(--navy-400);
}

.logo--light .logo__mark {
  color: var(--teal-200);
}

.logo--light .logo__name {
  color: #fff;
}

.logo--light .logo__suffix {
  color: var(--navy-200);
}

.logo--compact .logo__mark {
  width: 24px;
  height: 24px;
}

.logo--compact .logo__words {
  font-size: var(--text-md);
}
</style>

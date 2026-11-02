<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppointmentStatus } from '@/types'

const props = defineProps<{ status: AppointmentStatus }>()
const { t } = useI18n()

const tone = computed(
  () =>
    ({
      confirmed: 'confirmed',
      arrived: 'arrived',
      completed: 'completed',
      cancelled: 'cancelled'
    })[props.status]
)
</script>

<template>
  <span class="pill" :class="`pill--${tone}`">
    <span class="pill__dot" aria-hidden="true" />
    {{ t(`reception.status.${status}`) }}
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: 2px var(--s3) 2px var(--s2);
  border-radius: var(--radius-pill);
  font-size: var(--text-2xs);
  font-weight: 600;
  white-space: nowrap;
}

.pill__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.pill--confirmed {
  background: var(--teal-50);
  color: var(--teal-700);
}

.pill--arrived {
  background: var(--caution-bg);
  color: var(--caution-fg);
}

.pill--completed {
  background: var(--positive-bg);
  color: var(--positive-fg);
}

.pill--cancelled {
  background: var(--paper-deep);
  color: var(--navy-400);
  text-decoration: line-through;
}
</style>

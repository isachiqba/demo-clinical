<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { providerById } from '@/data/providers'
import { locationById } from '@/data/locations'
import { localized } from '@/i18n'
import { formatWallTime, minutesOf } from '@/services/clinicTime'
import type { Slot } from '@/types'

const props = defineProps<{
  slots: Slot[]
  selectedId: string | null
  /** Shows who and where under each time, for "any clinic"/"first available" searches. */
  showWho: boolean
}>()

const emit = defineEmits<{ select: [slot: Slot] }>()

const { t, locale } = useI18n()

const groups = computed(() => {
  const buckets: { key: 'morning' | 'afternoon' | 'evening'; slots: Slot[] }[] = [
    { key: 'morning', slots: [] },
    { key: 'afternoon', slots: [] },
    { key: 'evening', slots: [] }
  ]
  for (const slot of props.slots) {
    const minutes = minutesOf(slot.startWall)
    const bucket = minutes < 12 * 60 ? buckets[0] : minutes < 17 * 60 ? buckets[1] : buckets[2]
    bucket.slots.push(slot)
  }
  return buckets.filter((bucket) => bucket.slots.length > 0)
})

const whoFor = (slot: Slot): string => {
  const provider = providerById(slot.providerId)?.name ?? ''
  const location = localized(locationById(slot.locationId)?.name)
  return [provider, location].filter(Boolean).join(' · ')
}

const slotLabel = (slot: Slot): string =>
  props.showWho
    ? `${formatWallTime(slot.startWall, locale.value)} — ${whoFor(slot)}`
    : formatWallTime(slot.startWall, locale.value)
</script>

<template>
  <div class="slots">
    <section v-for="group in groups" :key="group.key">
      <h4 class="slots__label">{{ t(`booking.when.${group.key}`) }}</h4>
      <ul class="slots__grid" :class="{ 'slots__grid--wide': showWho }">
        <li v-for="slot in group.slots" :key="slot.id">
          <button
            class="slot"
            type="button"
            :class="{ 'slot--on': slot.id === selectedId }"
            :aria-pressed="slot.id === selectedId"
            :aria-label="slotLabel(slot)"
            @click="emit('select', slot)"
          >
            <span class="slot__time">{{ formatWallTime(slot.startWall, locale) }}</span>
            <span v-if="showWho" class="slot__who">{{ whoFor(slot) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.slots {
  display: flex;
  flex-direction: column;
  gap: var(--s6);
}

.slots__label {
  margin-bottom: var(--s3);
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.slots__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: var(--s2);
  list-style: none;
  padding: 0;
}

.slots__grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: var(--tap);
  padding: var(--s2) var(--s3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-700);
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background-color 0.16s var(--ease), color 0.16s var(--ease);
}

.slot:hover {
  border-color: var(--teal-500);
  background: var(--teal-50);
  color: var(--teal-800);
}

.slot__time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.slot__who {
  font-size: var(--text-2xs);
  line-height: 1.3;
  color: var(--navy-400);
  text-align: center;
}

.slot.slot--on,
.slot.slot--on:hover {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}

.slot.slot--on:hover {
  background: var(--teal-700);
}

.slot--on .slot__who {
  color: rgba(255, 255, 255, 0.86);
}

@media (max-width: 420px) {
  .slots__grid {
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  }

  .slots__grid--wide {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

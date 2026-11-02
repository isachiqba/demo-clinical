<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addDaysToKey,
  daysBetweenKeys,
  formatWallDate,
  todayKey,
  weekdayOfKey
} from '@/services/clinicTime'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * A month grid of openings. Days are real buttons so the whole calendar is reachable
 * with Tab and Enter, and each one announces how many times are free.
 */
const props = defineProps<{
  /** First day of the displayed month, as `YYYY-MM-01`. */
  monthKey: string
  selected: string
  counts: Record<string, number>
  loading: boolean
}>()

const emit = defineEmits<{ select: [dateKey: string]; month: [monthKey: string] }>()

const { t, locale } = useI18n()

const today = computed(() => todayKey())

/** Monday-first week, which both locales read naturally. */
const weekdayLabels = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    formatWallDate(addDaysToKey('2024-01-01', index), locale.value, { weekday: 'short' })
  )
)

interface Cell {
  key: string
  day: number
  inPast: boolean
  count: number
}

const cells = computed<(Cell | null)[]>(() => {
  const [year, month] = props.monthKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // Monday = 0 … Sunday = 6
  const leading = (weekdayOfKey(props.monthKey) + 6) % 7

  const list: (Cell | null)[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${props.monthKey.slice(0, 8)}${String(day).padStart(2, '0')}`
    list.push({
      key,
      day,
      inPast: daysBetweenKeys(today.value, key) < 0,
      count: props.counts[key] ?? 0
    })
  }
  while (list.length % 7 !== 0) list.push(null)
  return list
})

const monthLabel = computed(() =>
  formatWallDate(props.monthKey, locale.value, { month: 'long', year: 'numeric' })
)

const shiftMonth = (delta: number): void => {
  const [year, month] = props.monthKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + delta, 1))
  emit('month', `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`)
}

/** Never let the patient page back into a month that is entirely in the past. */
const canGoBack = computed(() => props.monthKey > today.value.slice(0, 8) + '01')

const dayLabel = (cell: Cell): string => {
  const date = formatWallDate(cell.key, locale.value, { weekday: 'long', day: 'numeric', month: 'long' })
  const openings = cell.count === 0 ? t('booking.when.noneLabel') : t('booking.when.someLabel', { count: cell.count })
  return `${date} — ${openings}`
}
</script>

<template>
  <div class="cal">
    <div class="cal__bar">
      <button
        class="cal__nav"
        type="button"
        :disabled="!canGoBack"
        :aria-label="t('booking.when.previousMonth')"
        @click="shiftMonth(-1)"
      >
        <AppIcon name="chevron-left" :size="18" />
      </button>
      <p class="cal__month" aria-live="polite">{{ monthLabel }}</p>
      <button
        class="cal__nav"
        type="button"
        :aria-label="t('booking.when.nextMonth')"
        @click="shiftMonth(1)"
      >
        <AppIcon name="chevron-right" :size="18" />
      </button>
    </div>

    <div class="cal__weekdays" aria-hidden="true">
      <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
    </div>

    <div class="cal__grid" :class="{ 'cal__grid--loading': loading }">
      <template v-for="(cell, index) in cells" :key="cell?.key ?? `pad-${index}`">
        <span v-if="!cell" class="cal__pad" />
        <button
          v-else
          class="day"
          type="button"
          :class="{
            'day--on': cell.key === selected,
            'day--today': cell.key === today,
            'day--empty': !loading && cell.count === 0
          }"
          :disabled="cell.inPast"
          :aria-pressed="cell.key === selected"
          :aria-label="dayLabel(cell)"
          @click="emit('select', cell.key)"
        >
          <span class="day__num">{{ cell.day }}</span>
          <span class="day__dot" aria-hidden="true">
            <template v-if="!loading && !cell.inPast && cell.count > 0">·</template>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: var(--s4);
}

.cal__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin-bottom: var(--s4);
}

.cal__month {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 500;
  text-transform: capitalize;
}

.cal__nav {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-600);
  cursor: pointer;
  transition: border-color 0.16s var(--ease), color 0.16s var(--ease);
}

.cal__nav:hover:not(:disabled) {
  border-color: var(--teal-500);
  color: var(--teal-700);
}

.cal__nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cal__weekdays,
.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
}

.cal__weekdays {
  margin-bottom: var(--s2);
}

.cal__weekdays span {
  padding-block: var(--s1);
  text-align: center;
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--navy-200);
}

.cal__grid--loading {
  opacity: 0.55;
}

.cal__pad {
  aspect-ratio: 1;
}

.day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  aspect-ratio: 1;
  min-height: 42px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--paper);
  color: var(--navy-700);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.16s var(--ease), border-color 0.16s var(--ease), color 0.16s var(--ease);
}

.day:hover:not(:disabled) {
  border-color: var(--teal-500);
  background: var(--teal-50);
}

.day__num {
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1;
}

.day__dot {
  height: 10px;
  font-size: 18px;
  line-height: 8px;
  color: var(--teal-600);
}

.day--today .day__num {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.day--empty {
  color: var(--navy-200);
  background: transparent;
}

.day.day--on,
.day.day--on:hover {
  background: var(--teal-600);
  border-color: var(--teal-700);
  color: #fff;
}

.day.day--on:hover {
  background: var(--teal-700);
}

.day--on .day__dot {
  color: rgba(255, 255, 255, 0.85);
}

.day:disabled {
  color: var(--navy-100);
  background: transparent;
  cursor: not-allowed;
}

@media (max-width: 420px) {
  .cal {
    padding: var(--s3);
  }

  .day {
    min-height: 38px;
  }
}
</style>

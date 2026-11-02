<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BOOKING_STEPS } from '@/types'
import type { BookingStep } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{ current: BookingStep; reachable: (step: BookingStep) => boolean }>()
const emit = defineEmits<{ go: [step: BookingStep] }>()

const { t } = useI18n()
const index = computed(() => BOOKING_STEPS.indexOf(props.current))
const percent = computed(() => ((index.value + 1) / BOOKING_STEPS.length) * 100)
</script>

<template>
  <nav class="progress" :aria-label="t('booking.title')">
    <p class="progress__count">
      {{ t('booking.stepOf', { current: index + 1, total: BOOKING_STEPS.length }) }}
    </p>

    <ol class="progress__steps">
      <li
        v-for="(step, position) in BOOKING_STEPS"
        :key="step"
        class="progress__step"
        :class="{
          'progress__step--now': step === current,
          'progress__step--done': position < index
        }"
      >
        <button
          class="progress__btn"
          type="button"
          :disabled="!reachable(step) || step === current"
          :aria-current="step === current ? 'step' : undefined"
          @click="emit('go', step)"
        >
          <span class="progress__mark">
            <AppIcon v-if="position < index" name="check" :size="12" :stroke-width="3" />
            <template v-else>{{ position + 1 }}</template>
          </span>
          <span class="progress__label">{{ t(`booking.steps.${step}`) }}</span>
        </button>
      </li>
    </ol>

    <div class="progress__track" aria-hidden="true">
      <span class="progress__fill" :style="{ width: `${percent}%` }" />
    </div>
  </nav>
</template>

<style scoped>
.progress__count {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--teal-700);
}

.progress__steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  list-style: none;
  padding: 0;
  margin: var(--s3) 0;
}

.progress__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 36px;
  padding: 0 var(--s3) 0 var(--s1);
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--navy-200);
  font-size: var(--text-sm);
  cursor: pointer;
}

.progress__btn:disabled {
  cursor: default;
}

.progress__step--done .progress__btn {
  color: var(--navy-600);
}

.progress__step--done .progress__btn:not(:disabled):hover {
  background: var(--teal-50);
  color: var(--teal-700);
}

.progress__step--now .progress__btn {
  color: var(--navy-900);
  font-weight: 600;
}

.progress__mark {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: var(--paper-deep);
  color: var(--navy-400);
  font-size: var(--text-2xs);
  font-weight: 700;
}

.progress__step--done .progress__mark {
  background: var(--teal-600);
  color: #fff;
}

.progress__step--now .progress__mark {
  background: var(--navy-800);
  color: #fff;
}

.progress__track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.progress__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--teal-600);
  transition: width 0.25s var(--ease);
}

@media (max-width: 680px) {
  .progress__label {
    display: none;
  }

  .progress__step--now .progress__label {
    display: inline;
  }

  .progress__btn {
    padding-right: var(--s2);
  }
}
</style>

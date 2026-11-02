<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{
  selected: boolean
  title: string
  description?: string
  icon?: string
  meta?: string
  disabled?: boolean
  name: string
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <label class="choice" :class="{ 'choice--selected': selected, 'choice--disabled': disabled }">
    <input
      class="choice__input"
      type="radio"
      :name="name"
      :checked="selected"
      :disabled="disabled"
      @change="$emit('select')"
    />
    <span v-if="icon" class="choice__icon" aria-hidden="true">
      <AppIcon :name="icon" :size="22" />
    </span>
    <span class="choice__body">
      <span class="choice__title">{{ title }}</span>
      <span v-if="description" class="choice__description">{{ description }}</span>
      <span v-if="meta" class="choice__meta">{{ meta }}</span>
      <slot />
    </span>
    <span class="choice__check" aria-hidden="true">
      <AppIcon v-if="selected" name="check" :size="16" :stroke-width="3" />
    </span>
  </label>
</template>

<style scoped>
.choice {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  min-height: 84px;
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.choice:hover:not(.choice--disabled) {
  border-color: var(--teal-300);
  background: var(--teal-50);
}

.choice--selected {
  border-color: var(--teal-600);
  background: var(--teal-50);
  box-shadow: inset 0 0 0 1px var(--teal-600);
}

.choice--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.choice__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.choice__input:focus-visible + .choice__icon,
.choice__input:focus-visible ~ .choice__body {
  outline: none;
}

.choice:has(.choice__input:focus-visible) {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.choice__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-md);
  background: var(--teal-100);
  color: var(--teal-700);
}

.choice--selected .choice__icon {
  background: var(--teal-600);
  color: #fff;
}

.choice__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.choice__title {
  font-weight: 600;
  font-size: var(--text-lg);
  color: var(--ink-900);
}

.choice__description {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.choice__meta {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--teal-700);
}

.choice__check {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  border: 1.5px solid var(--color-border-strong);
  background: var(--color-surface);
  color: #fff;
  margin-top: 2px;
}

.choice--selected .choice__check {
  background: var(--teal-600);
  border-color: var(--teal-600);
}
</style>

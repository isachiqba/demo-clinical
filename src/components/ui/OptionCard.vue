<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * A radio dressed as a card. The native input stays in the DOM so keyboard users get
 * arrow-key group behaviour and screen readers announce it as a radio.
 */
defineProps<{
  name: string
  selected: boolean
  title: string
  description?: string
  icon?: string
  disabled?: boolean
  /** Short line pinned to the bottom, e.g. the next free appointment. */
  footnote?: string
  compact?: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <label
    class="opt"
    :class="{ 'opt--on': selected, 'opt--off': disabled, 'opt--compact': compact }"
  >
    <input
      class="opt__input"
      type="radio"
      :name="name"
      :checked="selected"
      :disabled="disabled"
      @change="$emit('select')"
    />

    <span v-if="icon" class="opt__icon"><AppIcon :name="icon" :size="19" /></span>
    <span v-else-if="$slots.media" class="opt__media"><slot name="media" /></span>

    <span class="opt__body">
      <span class="opt__title">{{ title }}</span>
      <span v-if="description" class="opt__desc">{{ description }}</span>
      <slot />
      <span v-if="footnote" class="opt__foot">{{ footnote }}</span>
    </span>

    <span class="opt__tick" aria-hidden="true">
      <AppIcon v-if="selected" name="check" :size="13" :stroke-width="3" />
    </span>
  </label>
</template>

<style scoped>
.opt {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--s4);
  padding: var(--s4) var(--s5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color 0.16s var(--ease),
    background-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.opt--compact {
  padding: var(--s3) var(--s4);
  gap: var(--s3);
}

.opt:hover:not(.opt--off) {
  border-color: var(--teal-200);
  background: var(--teal-50);
}

.opt.opt--on,
.opt.opt--on:hover {
  border-color: var(--teal-600);
  background: var(--teal-50);
  box-shadow: inset 0 0 0 1px var(--teal-600);
}

.opt.opt--on:hover {
  background: var(--teal-100);
}

.opt--off {
  opacity: 0.45;
  cursor: not-allowed;
}

.opt:has(.opt__input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.opt__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  margin: 0;
}

.opt__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: var(--radius-sm);
  background: var(--sage-100);
  color: var(--sage-700);
  transition: background-color 0.16s var(--ease), color 0.16s var(--ease);
}

.opt--on .opt__icon {
  background: var(--teal-600);
  color: #fff;
}

.opt__media {
  flex: none;
}

.opt__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.opt__title {
  font-weight: 600;
  color: var(--navy-800);
  line-height: 1.35;
}

.opt__desc {
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--navy-400);
}

.opt__foot {
  margin-top: var(--s2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--teal-700);
}

.opt__tick {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  margin-top: 2px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface);
  color: #fff;
}

.opt--on .opt__tick {
  background: var(--teal-600);
  border-color: var(--teal-600);
}
</style>

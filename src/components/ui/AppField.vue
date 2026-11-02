<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  hint?: string
  /** Shown and announced only once the field has been touched or submit was attempted. */
  error?: string
  required?: boolean
  optionalLabel?: string
}>()

const uid = useId()
const controlId = `f${uid}`
const hintId = `h${uid}`
const errorId = `e${uid}`

const describedBy = computed(() =>
  [props.hint ? hintId : null, props.error ? errorId : null].filter(Boolean).join(' ') || undefined
)
</script>

<template>
  <div class="field" :class="{ 'field--invalid': Boolean(error) }">
    <label class="field__label" :for="controlId">
      <span>{{ label }}</span>
      <span v-if="!required && optionalLabel" class="field__optional">{{ optionalLabel }}</span>
    </label>
    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <div class="field__control">
      <slot :id="controlId" :describedBy="describedBy" :invalid="Boolean(error)" />
    </div>
    <p v-if="error" :id="errorId" class="field__error">
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 4.6v4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <circle cx="8" cy="11.3" r="0.95" fill="currentColor" />
      </svg>
      <span>{{ error }}</span>
    </p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
}

/* Pushes the control to the bottom so inputs in a row align even when one
   field carries a longer hint than its neighbour. */
.field__control {
  margin-top: auto;
}

.field__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.field__optional {
  font-weight: 400;
  color: var(--text-soft);
  font-size: var(--text-xs);
}

.field__hint {
  margin-top: -2px;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--text-soft);
}

.field__error {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--critical-fg);
}

.field__error svg {
  flex: none;
  margin-top: 2px;
}

:slotted(input),
:slotted(select),
:slotted(textarea) {
  width: 100%;
  min-height: var(--tap);
  padding: var(--s3) var(--s4);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--navy-800);
  transition: border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}

:slotted(select) {
  appearance: none;
  padding-right: var(--s8);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%234a627e' stroke-width='1.6' stroke-linecap='round'><path d='M4 6.5 8 10.5 12 6.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right var(--s4) center;
  background-size: 15px;
}

:slotted(textarea) {
  min-height: 110px;
  resize: vertical;
  line-height: 1.55;
}

:slotted(input::placeholder),
:slotted(textarea::placeholder) {
  color: var(--navy-200);
}

:slotted(input:hover),
:slotted(select:hover),
:slotted(textarea:hover) {
  border-color: var(--navy-400);
}

:slotted(input:focus),
:slotted(select:focus),
:slotted(textarea:focus) {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-color: var(--teal-500);
}

.field--invalid :slotted(input),
.field--invalid :slotted(select),
.field--invalid :slotted(textarea) {
  border-color: #c08478;
  background: #fffafa;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'quiet' | 'critical'
    size?: 'sm' | 'md' | 'lg'
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    loading?: boolean
    iconLeft?: string
    iconRight?: string
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false, loading: false, block: false }
)

const inert = computed(() => props.disabled || props.loading)
const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
const iconSize = computed(() => (props.size === 'lg' ? 19 : props.size === 'sm' ? 15 : 17))

/**
 * Only the bindings the chosen element understands. Passing `href: undefined` to a
 * RouterLink would fall through onto its `<a>` and wipe out the href it just computed,
 * leaving a link that cannot be focused or opened in a new tab.
 */
const bindings = computed<Record<string, unknown>>(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: inert.value ? undefined : props.href }
  return { type: props.type, disabled: inert.value }
})

/** `disabled` means nothing on an anchor, so stop the navigation ourselves. */
const onClick = (event: MouseEvent): void => {
  if (!inert.value) return
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <component
    :is="tag"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
    v-bind="bindings"
    :aria-disabled="inert ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    @click="onClick"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <AppIcon v-else-if="iconLeft" :name="iconLeft" :size="iconSize" />
    <span class="btn__label"><slot /></span>
    <AppIcon v-if="iconRight" :name="iconRight" :size="iconSize" class="btn__trail" />
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding-inline: var(--s5);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-weight: 600;
  line-height: 1;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.16s var(--ease),
    border-color 0.16s var(--ease),
    color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.btn--sm {
  min-height: 36px;
  padding-inline: var(--s3);
  font-size: var(--text-sm);
}

.btn--lg {
  min-height: 54px;
  padding-inline: var(--s6);
  font-size: var(--text-md);
}

.btn--block {
  width: 100%;
}

.btn__trail {
  transition: transform 0.16s var(--ease);
}

.btn:hover:not([aria-disabled='true']) .btn__trail {
  transform: translateX(2px);
}

/* Primary — the teal is reserved for things you can act on. */
.btn--primary {
  background: var(--teal-600);
  color: #fff;
  box-shadow: var(--shadow-xs);
}

.btn--primary:hover:not([aria-disabled='true']) {
  background: var(--teal-700);
  color: #fff;
}

.btn--secondary {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--navy-700);
}

.btn--secondary:hover:not([aria-disabled='true']) {
  border-color: var(--teal-500);
  color: var(--teal-700);
  background: var(--teal-50);
}

.btn--quiet {
  background: transparent;
  color: var(--navy-600);
  padding-inline: var(--s3);
}

.btn--quiet:hover:not([aria-disabled='true']) {
  background: var(--paper-deep);
  color: var(--navy-800);
}

.btn--critical {
  background: var(--surface);
  border-color: #e7c6c0;
  color: var(--critical-fg);
}

.btn--critical:hover:not([aria-disabled='true']) {
  background: var(--critical-bg);
  color: var(--critical-fg);
}

.btn[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: btn-spin 0.65s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

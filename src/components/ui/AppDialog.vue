<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

/** A modal that traps focus, restores it on close and shuts on Escape. */
const props = defineProps<{ open: boolean; title: string; closeLabel: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

const focusables = (): HTMLElement[] =>
  Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []
  )

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const release = (): void => {
  document.body.style.overflow = ''
  lastFocused?.focus?.()
  lastFocused = null
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      ;(focusables()[0] ?? panel.value)?.focus()
    } else {
      release()
    }
  }
)

onBeforeUnmount(() => {
  if (props.open) release()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog" @keydown="onKeydown">
        <div class="dialog__scrim" @click="emit('close')" />
        <div
          ref="panel"
          class="dialog__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header class="dialog__head">
            <h2 class="dialog__title">{{ title }}</h2>
            <button class="dialog__close" type="button" :aria-label="closeLabel" @click="emit('close')">
              <AppIcon name="x" :size="20" />
            </button>
          </header>
          <div class="dialog__body"><slot /></div>
          <footer v-if="$slots.actions" class="dialog__actions"><slot name="actions" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: var(--s4);
}

.dialog__scrim {
  position: absolute;
  inset: 0;
  background: rgba(11, 23, 36, 0.48);
}

.dialog__panel {
  position: relative;
  width: min(540px, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--s6);
}

.dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s4);
}

.dialog__title {
  font-size: var(--text-xl);
}

.dialog__close {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--navy-400);
  cursor: pointer;
}

.dialog__close:hover {
  background: var(--paper-deep);
  color: var(--navy-800);
}

.dialog__body {
  margin-top: var(--s3);
  color: var(--navy-600);
}

.dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s6);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.16s var(--ease);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>

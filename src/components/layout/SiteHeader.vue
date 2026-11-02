<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import LogoMark from './LogoMark.vue'

const { t } = useI18n()
const route = useRoute()
const open = ref(false)

const links = [
  { name: 'care', label: 'nav.care' },
  { name: 'team', label: 'nav.team' },
  { name: 'locations', label: 'nav.locations' },
  { name: 'info', label: 'nav.info' }
] as const

watch(
  () => route.fullPath,
  () => (open.value = false)
)

watch(open, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="masthead">
    <p class="masthead__note">
      <span class="masthead__chip">{{ t('demo.chip') }}</span>
      <span class="masthead__text">{{ t('demo.banner') }}</span>
    </p>
  </div>

  <header class="header">
    <div class="page-width header__inner">
      <RouterLink class="header__brand" :to="{ name: 'home' }" :aria-label="t('brand.name')">
        <LogoMark />
      </RouterLink>

      <nav class="header__nav" :aria-label="t('common.menu')">
        <RouterLink v-for="link in links" :key="link.name" class="header__link" :to="{ name: link.name }">
          {{ t(link.label) }}
        </RouterLink>
      </nav>

      <div class="header__end">
        <LanguageSwitcher />
        <AppButton :to="{ name: 'book' }" icon-right="arrow-right">{{ t('nav.book') }}</AppButton>
      </div>

      <button
        class="header__toggle"
        type="button"
        :aria-expanded="open"
        aria-controls="site-menu"
        :aria-label="t('common.menu')"
        @click="open = !open"
      >
        <AppIcon :name="open ? 'x' : 'menu'" :size="24" />
      </button>
    </div>

    <Transition name="sheet">
      <div v-if="open" id="site-menu" class="sheet">
        <nav class="sheet__nav" :aria-label="t('common.menu')">
          <RouterLink v-for="link in links" :key="link.name" class="sheet__link" :to="{ name: link.name }">
            <span>{{ t(link.label) }}</span>
            <AppIcon name="chevron-right" :size="18" />
          </RouterLink>
        </nav>
        <div class="sheet__end">
          <AppButton :to="{ name: 'book' }" size="lg" block icon-right="arrow-right">
            {{ t('nav.book') }}
          </AppButton>
          <LanguageSwitcher />
        </div>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.masthead {
  background: var(--navy-800);
  color: var(--navy-200);
}

.masthead__note {
  display: flex;
  align-items: center;
  gap: var(--s3);
  width: 100%;
  max-width: var(--page);
  margin-inline: auto;
  padding: var(--s2) var(--gutter);
  font-size: var(--text-2xs);
  line-height: 1.45;
}

.masthead__chip {
  flex: none;
  padding: 1px var(--s2);
  border-radius: var(--radius-xs);
  background: var(--teal-200);
  color: var(--teal-800);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(251, 249, 245, 0.94);
  backdrop-filter: saturate(1.4) blur(6px);
  border-bottom: 1px solid var(--border);
}

.header__inner {
  display: flex;
  align-items: center;
  gap: var(--s6);
  min-height: var(--header-h);
}

.header__brand {
  flex: none;
  text-decoration: none;
  border-radius: var(--radius-xs);
}

.header__nav {
  display: flex;
  align-items: center;
  gap: var(--s1);
  margin-left: auto;
}

.header__link {
  position: relative;
  padding: var(--s2) var(--s3);
  border-radius: var(--radius-xs);
  color: var(--navy-600);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.header__link:hover {
  color: var(--navy-900);
}

.header__link.router-link-active {
  color: var(--navy-900);
  font-weight: 600;
}

.header__link.router-link-active::after {
  content: '';
  position: absolute;
  left: var(--s3);
  right: var(--s3);
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--teal-600);
}

.header__end {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.header__toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: var(--tap);
  height: var(--tap);
  margin-left: auto;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--navy-700);
  cursor: pointer;
}

.sheet {
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: var(--s4) var(--gutter) var(--s6);
}

.sheet__nav {
  display: flex;
  flex-direction: column;
}

.sheet__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  border-bottom: 1px solid var(--border);
  color: var(--navy-800);
  font-size: var(--text-lg);
  font-weight: 500;
  text-decoration: none;
}

.sheet__link.router-link-active {
  color: var(--teal-700);
  font-weight: 600;
}

.sheet__end {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s4);
  margin-top: var(--s6);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.16s var(--ease);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

@media (max-width: 920px) {
  .header__nav,
  .header__end {
    display: none;
  }

  .header__toggle {
    display: inline-flex;
  }

  .masthead__text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
</style>

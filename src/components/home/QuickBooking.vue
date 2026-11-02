<script setup lang="ts">
import { ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * The shortcut on the home page. It does not book anything on its own: it carries the
 * two choices into the booking flow, which then opens on the first unanswered step.
 */
const { t } = useI18n()
const router = useRouter()

const serviceId = ref('')
const locationId = ref('any')

const uid = useId()
const serviceFieldId = `qs${uid}`
const locationFieldId = `ql${uid}`

const submit = (): void => {
  void router.push({
    name: 'book',
    query: {
      ...(serviceId.value ? { service: serviceId.value } : {}),
      location: locationId.value
    }
  })
}
</script>

<template>
  <section class="quick" :aria-label="t('home.quick.title')">
    <div class="page-width quick__inner">
      <form class="quick__form" @submit.prevent="submit">
        <h2 class="quick__title">{{ t('home.quick.title') }}</h2>

        <div class="quick__fields">
          <div class="quick__field">
            <label class="quick__label" :for="serviceFieldId">{{ t('home.quick.visit') }}</label>
            <select :id="serviceFieldId" v-model="serviceId" class="quick__select">
              <option value="">{{ t('home.quick.visitPlaceholder') }}</option>
              <option v-for="service in services" :key="service.id" :value="service.id">
                {{ localized(service.name) }}
              </option>
            </select>
          </div>

          <div class="quick__field">
            <label class="quick__label" :for="locationFieldId">{{ t('home.quick.location') }}</label>
            <select :id="locationFieldId" v-model="locationId" class="quick__select">
              <option value="any">{{ t('home.quick.anyLocation') }}</option>
              <option v-for="location in locations" :key="location.id" :value="location.id">
                {{ localized(location.name) }}
              </option>
            </select>
          </div>

          <AppButton class="quick__submit" type="submit" size="lg" icon-right="arrow-right">
            {{ t('home.quick.submit') }}
          </AppButton>
        </div>

        <p class="quick__note">{{ t('home.quick.note') }}</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.quick {
  position: relative;
  background: var(--sage-50);
  padding-bottom: var(--s9);
}

.quick__form {
  padding: var(--s6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.quick__title {
  font-size: var(--text-xl);
  margin-bottom: var(--s5);
}

.quick__fields {
  display: grid;
  grid-template-columns: 1.3fr 1fr auto;
  gap: var(--s4);
  align-items: end;
}

.quick__field {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
}

.quick__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--navy-700);
}

.quick__select {
  width: 100%;
  min-height: 54px;
  padding: 0 var(--s8) 0 var(--s4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%234a627e' stroke-width='1.6' stroke-linecap='round'><path d='M4 6.5 8 10.5 12 6.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right var(--s4) center;
  background-size: 15px;
  transition: border-color 0.16s var(--ease);
}

.quick__select:hover {
  border-color: var(--navy-400);
}

.quick__note {
  margin-top: var(--s4);
  font-size: var(--text-xs);
  color: var(--text-soft);
}

@media (max-width: 860px) {
  .quick__fields {
    grid-template-columns: 1fr;
  }

  .quick__submit {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .quick__form {
    padding: var(--s5) var(--s4);
  }
}
</style>

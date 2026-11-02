<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { services } from '@/data/services'
import { localized } from '@/i18n'
import { useBookingStore } from '@/stores/booking'
import AppIcon from '@/components/ui/AppIcon.vue'
import OptionCard from '@/components/ui/OptionCard.vue'

const { t } = useI18n()
const booking = useBookingStore()
</script>

<template>
  <section>
    <h1 class="step__title">{{ t('booking.visit.title') }}</h1>
    <p class="step__lede">{{ t('booking.visit.lede') }}</p>

    <fieldset class="group">
      <legend class="sr-only">{{ t('booking.visit.title') }}</legend>
      <div class="group__grid">
        <OptionCard
          v-for="service in services"
          :key="service.id"
          name="service"
          :icon="service.icon"
          :title="localized(service.name)"
          :description="localized(service.summary)"
          :footnote="t('common.minutes', { count: service.durationMinutes })"
          :selected="booking.draft.serviceId === service.id"
          @select="booking.selectService(service.id)"
        />
      </div>
    </fieldset>

    <fieldset class="group">
      <legend class="group__legend">{{ t('booking.visit.who') }}</legend>
      <div class="group__grid group__grid--two">
        <OptionCard
          name="patientType"
          icon="user"
          :title="t('booking.visit.new')"
          :description="t('booking.visit.newHelp')"
          :selected="booking.draft.patientType === 'new'"
          @select="booking.selectPatientType('new')"
        />
        <OptionCard
          name="patientType"
          icon="repeat"
          :title="t('booking.visit.existing')"
          :description="t('booking.visit.existingHelp')"
          :selected="booking.draft.patientType === 'existing'"
          @select="booking.selectPatientType('existing')"
        />
      </div>
    </fieldset>

    <p class="step__note">
      <AppIcon name="info" :size="17" />
      <span>{{ t('booking.visit.privacy') }}</span>
    </p>
  </section>
</template>

<style scoped>
.step__title {
  font-size: var(--text-3xl);
}

.step__lede {
  margin-top: var(--s3);
  max-width: 54ch;
  color: var(--navy-600);
}

.group {
  border: none;
  padding: 0;
  margin: var(--s7) 0 0;
}

.group__legend {
  padding: 0;
  margin-bottom: var(--s4);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--navy-800);
}

.group__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}

.step__note {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  margin-top: var(--s6);
  padding: var(--s4);
  border-radius: var(--radius-sm);
  background: var(--paper-deep);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--navy-600);
}

.step__note svg {
  margin-top: 2px;
  color: var(--navy-400);
}

@media (max-width: 720px) {
  .group__grid {
    grid-template-columns: 1fr;
  }
}
</style>

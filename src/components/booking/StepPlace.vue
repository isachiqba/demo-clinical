<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { providers } from '@/data/providers'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime, todayKey } from '@/services/clinicTime'
import { schedulingApi } from '@/services/schedulingApi'
import { useBookingStore } from '@/stores/booking'
import type { LocationChoice, Slot } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import OptionCard from '@/components/ui/OptionCard.vue'

const { t, locale } = useI18n()
const booking = useBookingStore()

const nextByProvider = ref<Record<string, Slot | null>>({})
const nextForAny = ref<Slot | null>(null)
const checking = ref(false)

/** Only clinics where someone offers the chosen appointment type. */
const availableLocations = computed(() =>
  locations.filter((location) =>
    providers.some(
      (provider) =>
        provider.locationIds.includes(location.id) &&
        booking.draft.serviceId &&
        provider.serviceIds.includes(booking.draft.serviceId)
    )
  )
)

const load = async (): Promise<void> => {
  const { serviceId, locationId } = booking.draft
  if (!serviceId || !locationId) return
  checking.value = true
  const fromKey = todayKey()
  const [perProvider, any] = await Promise.all([
    schedulingApi.getProviderAvailability({ serviceId, locationId, fromKey }),
    schedulingApi.getFirstAvailable({ serviceId, locationId, providerId: 'any', fromKey })
  ])
  nextByProvider.value = Object.fromEntries(perProvider.map((entry) => [entry.providerId, entry.next]))
  nextForAny.value = any
  checking.value = false
}

onMounted(() => {
  if (booking.draft.locationId) void load()
})

watch(() => [booking.draft.serviceId, booking.draft.locationId], () => {
  if (booking.draft.locationId) void load()
})

const whenLabel = (slot: Slot | null): string => {
  if (checking.value) return t('booking.place.checking')
  if (!slot) return t('booking.place.noOpenings')
  return t('booking.place.nextOpening', {
    when: `${formatWallDate(slot.startWall, locale.value, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatWallTime(slot.startWall, locale.value)}`
  })
}

const clinicsOf = (ids: string[]): string =>
  ids
    .map((id) => locations.find((location) => location.id === id))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))
    .map((location) => localized(location.name))
    .join(' · ')

const chooseLocation = (id: LocationChoice): void => booking.selectLocation(id)

const noProviders = computed(
  () => Boolean(booking.draft.locationId) && booking.eligibleProviders.length === 0
)
</script>

<template>
  <section>
    <h1 class="step__title">{{ t('booking.place.title') }}</h1>
    <p class="step__lede">
      {{ t('booking.place.lede', { service: localized(booking.service?.name) }) }}
    </p>

    <fieldset class="group">
      <legend class="group__legend">{{ t('booking.place.clinic') }}</legend>
      <div class="group__grid">
        <OptionCard
          name="clinic"
          icon="map-pin"
          :title="t('booking.place.anyLocation')"
          :description="t('booking.place.anyLocationHelp')"
          :selected="booking.draft.locationId === 'any'"
          @select="chooseLocation('any')"
        />
        <OptionCard
          v-for="location in availableLocations"
          :key="location.id"
          name="clinic"
          icon="map-pin"
          :title="localized(location.name)"
          :description="localized(location.place)"
          :selected="booking.draft.locationId === location.id"
          @select="chooseLocation(location.id)"
        />
      </div>
    </fieldset>

    <fieldset v-if="booking.draft.locationId" class="group">
      <legend class="group__legend">{{ t('booking.place.clinician') }}</legend>

      <p v-if="noProviders" class="empty">
        <AppIcon name="alert-circle" :size="18" />
        <span>{{ t('booking.place.noProviders') }}</span>
      </p>

      <div v-else class="group__list">
        <OptionCard
          name="clinician"
          icon="clock"
          :title="t('booking.place.firstAvailable')"
          :description="t('booking.place.firstAvailableHelp')"
          :footnote="whenLabel(nextForAny)"
          :selected="booking.draft.providerId === 'any'"
          @select="booking.selectProvider('any')"
        />

        <OptionCard
          v-for="provider in booking.eligibleProviders"
          :key="provider.id"
          name="clinician"
          :title="provider.name"
          :description="localized(provider.role)"
          :footnote="whenLabel(nextByProvider[provider.id] ?? null)"
          :selected="booking.draft.providerId === provider.id"
          @select="booking.selectProvider(provider.id)"
        >
          <template #media>
            <img class="face" :src="provider.image" :alt="t('demo.illustrativeShort')" width="48" height="48" />
          </template>
          <span class="where">
            {{ t('booking.place.atClinics', { clinics: clinicsOf(provider.locationIds) }) }}
          </span>
        </OptionCard>
      </div>
    </fieldset>
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

.group__list {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.face {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 22%;
}

.where {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--navy-400);
}

.empty {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-radius: var(--radius-sm);
  background: var(--caution-bg);
  color: var(--caution-fg);
  font-size: var(--text-sm);
  line-height: 1.55;
}

.empty svg {
  margin-top: 2px;
}

@media (max-width: 720px) {
  .group__grid {
    grid-template-columns: 1fr;
  }
}
</style>

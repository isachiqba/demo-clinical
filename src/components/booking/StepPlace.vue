<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { locations } from '@/data/locations'
import { localized } from '@/i18n'
import { formatWallDate, formatWallTime, todayKey } from '@/services/clinicTime'
import { schedulingApi } from '@/services/schedulingApi'
import { useBookingStore } from '@/stores/booking'
import type { LocationChoice, LocationId, Slot } from '@/types'
import OptionCard from '@/components/ui/OptionCard.vue'

/**
 * Which clinic. Patients do not pick a clinician: they ask a clinic for a time, and the
 * clinic decides who sees them, so each card shows the clinic's own soonest opening.
 */
const { t, locale } = useI18n()
const booking = useBookingStore()

const soonest = ref<Record<string, Slot | null>>({})
const checking = ref(false)

const load = async (): Promise<void> => {
  const serviceId = booking.draft.serviceId
  if (!serviceId) return
  checking.value = true
  const fromKey = todayKey()
  const entries = await Promise.all(
    locations.map(async (location) => {
      const slot = await schedulingApi.getFirstAvailable({
        serviceId,
        locationId: location.id,
        fromKey
      })
      return [location.id, slot] as const
    })
  )
  const any = await schedulingApi.getFirstAvailable({ serviceId, locationId: 'any', fromKey })
  soonest.value = { ...Object.fromEntries(entries), any }
  checking.value = false
}

onMounted(load)
watch(() => booking.draft.serviceId, load)

const whenLabel = (key: string): string => {
  if (checking.value) return t('booking.place.checking')
  const slot = soonest.value[key]
  if (!slot) return t('booking.place.noOpenings')
  return t('booking.place.nextOpening', {
    when: `${formatWallDate(slot.startWall, locale.value, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatWallTime(slot.startWall, locale.value)}`
  })
}

const choose = (id: LocationChoice): void => booking.selectLocation(id)

const serviceName = computed(() => localized(booking.service?.name))
const clinicIds = computed<LocationId[]>(() => locations.map((location) => location.id))
</script>

<template>
  <section>
    <h1 class="step__title">{{ t('booking.place.title') }}</h1>
    <p class="step__lede">{{ t('booking.place.lede', { service: serviceName }) }}</p>

    <fieldset class="group">
      <legend class="sr-only">{{ t('booking.place.clinic') }}</legend>
      <div class="group__grid">
        <OptionCard
          name="clinic"
          icon="map-pin"
          :title="t('booking.place.anyLocation')"
          :description="t('booking.place.anyLocationHelp')"
          :footnote="whenLabel('any')"
          :selected="booking.draft.locationId === 'any'"
          @select="choose('any')"
        />
        <OptionCard
          v-for="id in clinicIds"
          :key="id"
          name="clinic"
          icon="map-pin"
          :title="localized(locations.find((location) => location.id === id)?.name)"
          :description="localized(locations.find((location) => location.id === id)?.place)"
          :footnote="whenLabel(id)"
          :selected="booking.draft.locationId === id"
          @select="choose(id)"
        />
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

.group__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}

@media (max-width: 720px) {
  .group__grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { doctor } from '@/data/doctor'
import { locationById } from '@/data/locations'
import { roomById } from '@/data/rooms'
import { serviceById } from '@/data/services'
import { formatWallDate, formatWallTime } from '@/services/clinicTime'
import { useScheduleStore } from '@/stores/schedule'
import type { Appointment, Locale } from '@/types'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * The paper slip that goes with the patient through the clinic.
 *
 * It is a **blank form**, on purpose. No observation is generated, no reference range is
 * printed and nothing is interpreted: the boxes are there for somebody to fill in by hand.
 * This is not a medical record and the demo does not pretend to hold one.
 *
 * Nothing on it is contact or insurance detail — a sheet that gets carried around a
 * building and left on desks should say as little about a person as the job allows.
 *
 * Printing is only ever *requested*. The browser dialog can be cancelled and this
 * application cannot tell, so it never claims a sheet came out of a printer.
 */
const props = defineProps<{ open: boolean; appointment: Appointment | null }>()
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const schedule = useScheduleStore()

/** The slip can be printed in either language without touching the appointment. */
const slipLocale = ref<Locale>(locale.value as Locale)
watch(
  () => props.open,
  (open) => {
    if (open) slipLocale.value = locale.value as Locale
  }
)

/** Translates for the sheet, which may be in the other language from the interface. */
const s = (key: string, named?: Record<string, unknown>): string =>
  t(key, named ?? {}, { locale: slipLocale.value })

const localizedFor = (value: { en: string; es: string } | undefined): string =>
  value ? value[slipLocale.value] : ''

const appointment = computed(() => props.appointment)

const rows = computed(() => {
  const found = appointment.value
  if (!found) return []
  const visit = found.visit
  const room = visit?.roomId ? roomById(visit.roomId) : undefined

  const list = [
    { key: 'reference', label: s('slip.reference'), value: found.reference },
    {
      key: 'patient',
      label: s('slip.patient'),
      value: `${found.patient.firstName} ${found.patient.lastName}`
    },
    {
      key: 'appointment',
      label: s('slip.appointment'),
      value: `${formatWallDate(found.startWall, slipLocale.value)}, ${formatWallTime(found.startWall, slipLocale.value)}`
    },
    {
      key: 'arrived',
      label: s('slip.arrived'),
      value: visit ? formatWallTime(visit.arrivedAtWall, slipLocale.value) : '—'
    },
    { key: 'clinic', label: s('slip.clinic'), value: localizedFor(locationById(found.locationId)?.name) },
    {
      key: 'room',
      label: s('slip.room'),
      value: room ? localizedFor(room.name) : s('slip.roomPending')
    },
    { key: 'service', label: s('slip.service'), value: localizedFor(serviceById(found.serviceId)?.name) }
  ]

  // Only when reception actually noted one down. No empty field, no invented number.
  if (found.curemd.reference) {
    list.push({ key: 'curemd', label: s('slip.curemdReference'), value: found.curemd.reference })
  }
  return list
})

/** The blanks. Units are written next to the line, not filled in. */
const vitals = computed(() => [
  { key: 'bp', label: s('slip.vitals.bloodPressure'), unit: 'mmHg' },
  { key: 'hr', label: s('slip.vitals.heartRate'), unit: '/min' },
  { key: 'rr', label: s('slip.vitals.respiratoryRate'), unit: '/min' },
  { key: 'temp', label: s('slip.vitals.temperature'), unit: '°C / °F' },
  { key: 'spo2', label: s('slip.vitals.oxygen'), unit: '%' },
  { key: 'weight', label: s('slip.vitals.weight'), unit: 'kg / lb' },
  { key: 'height', label: s('slip.vitals.height'), unit: 'cm / in' }
])

const print = async (): Promise<void> => {
  const found = appointment.value
  if (!found) return
  // Recorded as a request, because that is all we can honestly know.
  await schedule.noteSlipRequested(found.id)
  document.body.classList.add('printing-slip')
  window.print()
  document.body.classList.remove('printing-slip')
}

watch(
  () => props.open,
  (open) => {
    if (!open) document.body.classList.remove('printing-slip')
  }
)
onBeforeUnmount(() => document.body.classList.remove('printing-slip'))
</script>

<template>
  <Teleport to="body">
    <div v-if="open && appointment" class="slip-overlay" role="dialog" aria-modal="true">
      <div class="slip-overlay__chrome">
        <div class="chrome__langs" role="group" :aria-label="t('slip.languageLabel')">
          <button
            v-for="code in (['en', 'es'] as Locale[])"
            :key="code"
            type="button"
            class="chrome__lang"
            :class="{ 'chrome__lang--on': slipLocale === code }"
            :aria-pressed="slipLocale === code"
            @click="slipLocale = code"
          >
            {{ code.toUpperCase() }}
          </button>
        </div>
        <div class="chrome__actions">
          <AppButton icon-left="printer" @click="print">{{ t('slip.print') }}</AppButton>
          <AppButton variant="secondary" @click="emit('close')">{{ t('common.close') }}</AppButton>
        </div>
      </div>

      <p class="slip-overlay__chrome slip-note">{{ t('slip.note') }}</p>

      <article class="sheet">
        <header class="sheet__head">
          <div>
            <p class="sheet__doctor">{{ doctor.name }}</p>
            <h1 class="sheet__title">{{ s('slip.title') }}</h1>
          </div>
          <p class="sheet__demo">{{ s('slip.demoMark') }}</p>
        </header>

        <dl class="sheet__facts">
          <div v-for="row in rows" :key="row.key" class="fact">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>

        <section class="sheet__vitals">
          <h2 class="sheet__h2">{{ s('slip.vitals.title') }}</h2>
          <ul class="blanks">
            <li v-for="item in vitals" :key="item.key" class="blank">
              <span class="blank__label">{{ item.label }}</span>
              <span class="blank__line" aria-hidden="true" />
              <span class="blank__unit">{{ item.unit }}</span>
            </li>
          </ul>

          <div class="notes">
            <span class="blank__label">{{ s('slip.vitals.notes') }}</span>
            <span class="notes__line" aria-hidden="true" />
            <span class="notes__line" aria-hidden="true" />
          </div>

          <div class="signer">
            <span class="blank__label">{{ s('slip.vitals.takenBy') }}</span>
            <span class="blank__line" aria-hidden="true" />
          </div>
        </section>

        <footer class="sheet__foot">{{ s('slip.footer') }}</footer>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.slip-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s4);
  padding: var(--s6) var(--s4);
  overflow-y: auto;
  background: var(--navy-800);
}

.slip-overlay__chrome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  width: min(148mm, 100%);
}

.chrome__langs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.12);
}

.chrome__lang {
  min-height: 34px;
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  color: #fff;
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
}

.chrome__lang--on {
  background: #fff;
  color: var(--navy-800);
}

.chrome__actions {
  display: flex;
  gap: var(--s3);
}

.slip-note {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--navy-200);
}

/* The sheet itself: A5 upright, plain black on white, no colour carrying meaning. */
.sheet {
  width: min(148mm, 100%);
  min-height: 210mm;
  padding: 10mm 10mm;
  background: #fff;
  color: #000;
  font-size: 10pt;
  line-height: 1.4;
}

.sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s4);
  padding-bottom: 3mm;
  border-bottom: 1.5pt solid #000;
}

.sheet__doctor {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15pt;
  font-weight: 600;
}

.sheet__title {
  margin: 1mm 0 0;
  font-size: 11pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sheet__demo {
  margin: 0;
  padding: 1mm 2mm;
  border: 1pt solid #000;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.sheet__facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.2mm 5mm;
  margin: 4mm 0 0;
}

.fact dt {
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.fact dd {
  margin: 0.4mm 0 0;
  font-size: 10pt;
}

.sheet__h2 {
  margin: 0 0 2.5mm;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sheet__vitals {
  margin-top: 5mm;
  padding-top: 3mm;
  border-top: 1pt solid #000;
}

.blanks {
  margin: 0;
  padding: 0;
  list-style: none;
}

.blank {
  display: flex;
  align-items: baseline;
  gap: 2mm;
  padding: 1.5mm 0;
}

.blank__label {
  flex: none;
  width: 42mm;
  font-size: 9.5pt;
}

.blank__line {
  flex: 1;
  border-bottom: 0.6pt solid #000;
  transform: translateY(-1mm);
}

.blank__unit {
  flex: none;
  width: 17mm;
  font-size: 8pt;
}

.notes {
  margin-top: 3mm;
}

.notes__line {
  display: block;
  margin-top: 4.2mm;
  border-bottom: 0.6pt solid #000;
}

/* The label sits above its line, so a label that wraps — as the Spanish one does —
   cannot push the writing space out of line with it. */
.signer {
  margin-top: 4mm;
}

.signer .blank__line {
  display: block;
  margin-top: 4.2mm;
  max-width: 60mm;
  transform: none;
}

.sheet__foot {
  margin-top: 4mm;
  padding-top: 2mm;
  border-top: 0.6pt solid #000;
  font-size: 7pt;
  line-height: 1.4;
}

@media (max-width: 560px) {
  .sheet {
    padding: 8mm 6mm;
  }

  .sheet__facts {
    grid-template-columns: 1fr;
  }

  .blank__label {
    width: 32mm;
  }
}

@media print {
  .sheet {
    width: auto;
    min-height: 0;
    padding: 0;
  }

  /* The narrow-screen rules above are for reading the preview on a phone. A sheet of
     paper is not a phone, so the print layout is restated here rather than inherited —
     otherwise a small window collapses the facts into one column and spills onto a
     second page. */
  .sheet__facts {
    grid-template-columns: 1fr 1fr;
  }

  .blank__label {
    width: 42mm;
  }
}
</style>

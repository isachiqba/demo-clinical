<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ClinicLocation } from '@/types'

/**
 * A small schematic plan of one clinic's own surroundings — the harbour and the old town
 * for Downtown, the library and its gardens for Northside, the park for Westside.
 *
 * Each clinic gets its own plan rather than sharing one: in a real practice the sites
 * could be far apart, and a single frame would either lose the detail or imply they are
 * neighbours. It is a diagram, not a map of anywhere real, which is also why the demo can
 * show it without inventing an address.
 *
 * The artwork is inert; the labels on top are ordinary text, and the written directions in
 * the clinic card carry the same information.
 */
const props = defineProps<{ location: ClinicLocation }>()
const { t } = useI18n()

const id = props.location.id
</script>

<template>
  <figure class="locator">
    <div class="locator__frame">
      <svg class="locator__art" viewBox="0 0 100 58" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern :id="`grain-${id}`" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M7 0H0v7" fill="none" stroke="var(--sage-100)" stroke-width="0.3" />
          </pattern>
          <pattern
            :id="`hatch-${id}`"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d="M0 0v3" stroke="var(--line-strong)" stroke-width="0.5" />
          </pattern>
        </defs>

        <rect width="100" height="58" fill="var(--sage-50)" />
        <rect width="100" height="58" :fill="`url(#grain-${id})`" />

        <!-- Downtown: the harbour side of the old town. -->
        <g v-if="id === 'downtown'">
          <path d="M100 58H52c5-7 12-9 19-14 6-4 10-10 18-12 4-1 8 0 11-2z" fill="var(--teal-100)" />
          <path d="M52 58c5-7 12-9 19-14 6-4 10-10 18-12 4-1 8 0 11-2" fill="none" stroke="var(--teal-200)" stroke-width="0.7" />

          <g stroke="var(--line)" stroke-width="3.4" stroke-linecap="round" fill="none">
            <path d="M0 34h58" />
            <path d="M24 0v34" />
          </g>
          <g stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" fill="none">
            <path d="M0 16h52M44 0v34M58 34 76 16" />
          </g>

          <g fill="var(--paper-deep)">
            <rect x="6" y="5" width="13" height="8" rx="1" />
            <rect x="29" y="4" width="11" height="9" rx="1" />
            <rect x="6" y="21" width="12" height="9" rx="1" />
            <rect x="29" y="20" width="10" height="5" rx="1" />
            <rect x="48" y="4" width="9" height="9" rx="1" />
            <rect x="48" y="20" width="7" height="10" rx="1" />
            <rect x="63" y="24" width="9" height="7" rx="1" />
          </g>

          <rect x="68" y="5" width="14" height="9" rx="1.5" fill="var(--navy-100)" />
          <path d="M60 16 70 11" stroke="var(--navy-200)" stroke-width="0.8" stroke-dasharray="1.6 2" />

          <rect x="29" y="27" width="10" height="7" rx="1" fill="var(--teal-200)" />
        </g>

        <!-- Northside: the garden block beside the library. -->
        <g v-else-if="id === 'northside'">
          <g stroke="var(--line)" stroke-width="3.4" stroke-linecap="round" fill="none">
            <path d="M0 46h100" />
          </g>
          <g stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" fill="none">
            <path d="M24 46V12M72 46V20" />
          </g>

          <rect x="28" y="14" width="30" height="26" rx="3" fill="var(--sage-100)" />
          <path d="M28 30h30M43 14v26" stroke="var(--sage-200)" stroke-width="0.4" />
          <rect x="36" y="24" width="14" height="11" rx="1.2" fill="var(--teal-200)" />

          <rect x="64" y="16" width="20" height="18" rx="2" fill="var(--sage-200)" />

          <rect x="4" y="18" width="14" height="22" rx="2" :fill="`url(#hatch-${id})`" opacity="0.6" />
          <rect x="4" y="18" width="14" height="22" rx="2" fill="none" stroke="var(--line-strong)" stroke-width="0.5" />

          <g fill="var(--navy-200)">
            <circle cx="33" cy="46" r="1.6" />
            <circle cx="61" cy="46" r="1.6" />
          </g>
        </g>

        <!-- Westside: the north edge of the park. -->
        <g v-else>
          <g stroke="var(--line)" stroke-width="3.4" stroke-linecap="round" fill="none">
            <path d="M0 9h100" />
          </g>

          <rect x="10" y="30" width="80" height="28" rx="4" fill="var(--sage-100)" />
          <path d="M10 44h80M38 30v28M64 30v28" stroke="var(--sage-200)" stroke-width="0.4" />
          <g fill="var(--sage-200)">
            <circle cx="22" cy="38" r="2.4" />
            <circle cx="30" cy="50" r="2" />
            <circle cx="52" cy="38" r="2.6" />
            <circle cx="74" cy="48" r="2.2" />
          </g>

          <rect x="30" y="14" width="26" height="11" rx="1.4" fill="var(--teal-200)" />
          <rect x="30" y="26" width="26" height="3" rx="1.5" fill="var(--paper-deep)" stroke="var(--line-strong)" stroke-width="0.4" stroke-dasharray="2 1.6" />

          <rect x="64" y="13" width="18" height="13" rx="2" :fill="`url(#hatch-${id})`" opacity="0.6" />
          <rect x="64" y="13" width="18" height="13" rx="2" fill="none" stroke="var(--line-strong)" stroke-width="0.5" />

          <circle cx="20" cy="9" r="1.6" fill="var(--navy-200)" />
        </g>

        <!-- North arrow, same place on every plan. -->
        <g transform="translate(94 10)" stroke="var(--navy-200)" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M0 6V-2M-2 0 0-2 2 0" />
        </g>
      </svg>

      <!-- Labels sit on top as text, so they are selectable and read out. -->
      <template v-if="id === 'downtown'">
        <p class="tag tag--water" style="left: 74%; top: 82%">{{ t('locations.map.harbour') }}</p>
        <p class="tag" style="left: 67%; top: 26%">{{ t('locations.map.station') }}</p>
        <p class="tag tag--here" style="left: 29%; top: 63%">{{ t('locations.map.here') }}</p>
      </template>

      <template v-else-if="id === 'northside'">
        <p class="tag tag--green" style="left: 66%; top: 62%">{{ t('locations.map.library') }}</p>
        <p class="tag" style="left: 4%; top: 72%">{{ t('locations.map.carPark') }}</p>
        <p class="tag" style="left: 55%; top: 86%">{{ t('locations.map.busStop') }}</p>
        <p class="tag tag--here" style="left: 31%; top: 64%">{{ t('locations.map.here') }}</p>
      </template>

      <template v-else>
        <p class="tag tag--green" style="left: 11%; top: 86%">{{ t('locations.map.park') }}</p>
        <p class="tag" style="left: 68%; top: 49%">{{ t('locations.map.parking') }}</p>
        <p class="tag" style="left: 26%; top: 54%">{{ t('locations.map.dropOff') }}</p>
        <p class="tag tag--here" style="left: 30%; top: 33%">{{ t('locations.map.here') }}</p>
      </template>

      <p class="tag tag--north" style="right: 2%; top: 2%">{{ t('locations.map.north') }}</p>
    </div>

    <figcaption class="locator__caption">{{ t('locations.map.caption') }}</figcaption>
  </figure>
</template>

<style scoped>
.locator {
  margin: 0;
}

.locator__frame {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--sage-50);
}

.locator__art {
  display: block;
  width: 100%;
  /* Matches the viewBox exactly, so the labels land on the right features. */
  aspect-ratio: 100 / 58;
}

.tag {
  position: absolute;
  margin: 0;
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.2;
  color: var(--navy-400);
  white-space: nowrap;
  pointer-events: none;
}

.tag--water {
  color: var(--teal-600);
}

.tag--green {
  color: var(--sage-600);
}

.tag--north {
  letter-spacing: 0.1em;
  color: var(--navy-200);
}

.tag--here {
  padding: 2px var(--s2);
  border-radius: var(--radius-pill);
  background: var(--teal-700);
  color: #fff;
  letter-spacing: 0.08em;
  box-shadow: var(--shadow-sm);
}

.locator__caption {
  margin-top: var(--s2);
  font-size: var(--text-2xs);
  line-height: 1.5;
  color: var(--text-soft);
}
</style>

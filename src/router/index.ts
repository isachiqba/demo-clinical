import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useBookingStore } from '@/stores/booking'
import { BOOKING_STEPS } from '@/types'
import type { BookingStep } from '@/types'
import HomeView from '@/views/HomeView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/care', name: 'care', component: () => import('@/views/CareView.vue') },
  { path: '/team', name: 'team', component: () => import('@/views/TeamView.vue') },
  { path: '/locations', name: 'locations', component: () => import('@/views/LocationsView.vue') },
  { path: '/patient-information', name: 'info', component: () => import('@/views/PatientInfoView.vue') },
  { path: '/book/:step?', name: 'book', component: () => import('@/views/BookView.vue') },
  {
    path: '/booking/:reference',
    name: 'confirmation',
    component: () => import('@/views/ConfirmationView.vue')
  },
  {
    path: '/demo/reception',
    name: 'reception',
    component: () => import('@/views/ReceptionView.vue'),
    meta: { chrome: false }
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 110, behavior: 'smooth' }
    // Moving between wizard steps should not throw the page back to the top.
    if (to.name === 'book' && from.name === 'book') return false
    return { top: 0 }
  }
})

const isBookingStep = (value: unknown): value is BookingStep =>
  typeof value === 'string' && (BOOKING_STEPS as readonly string[]).includes(value)

/** A deep link cannot skip a step the visitor has not answered yet. */
router.beforeEach((to) => {
  if (to.name !== 'book') return true

  const booking = useBookingStore()
  const step = to.params.step

  if (!step) {
    return { name: 'book', params: { step: booking.furthestStep }, query: to.query, replace: true }
  }
  if (!isBookingStep(step)) {
    return { name: 'book', params: { step: 'visit' }, query: to.query, replace: true }
  }

  const carriesPreset = Boolean(to.query.service || to.query.location || to.query.provider)
  if (!booking.canEnter(step) && !carriesPreset) {
    return { name: 'book', params: { step: booking.furthestStep }, query: to.query, replace: true }
  }
  return true
})

<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertCircle, ArrowLeft, ArrowRight, Ban, BarChart3, CalendarDays, CalendarClock, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Database, Download, Globe, Inbox,
  DoorOpen, Info, LayoutList, LogIn, MapPin, Menu, MessageSquare, Minus, Phone, Printer, Repeat,
  RotateCcw, Search, Stethoscope, Upload, Users, UserRound, X
} from 'lucide-vue-next'

/** One entry point for icons, so the set stays coherent. Lucide only — never emoji. */
const registry = {
  'alert-circle': AlertCircle,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  ban: Ban,
  chart: BarChart3,
  calendar: CalendarDays,
  'calendar-clock': CalendarClock,
  check: Check,
  'check-circle': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  clipboard: ClipboardList,
  clock: Clock,
  database: Database,
  'door-open': DoorOpen,
  download: Download,
  inbox: Inbox,
  minus: Minus,
  upload: Upload,
  globe: Globe,
  info: Info,
  list: LayoutList,
  'log-in': LogIn,
  'map-pin': MapPin,
  menu: Menu,
  message: MessageSquare,
  phone: Phone,
  printer: Printer,
  repeat: Repeat,
  reset: RotateCcw,
  search: Search,
  stethoscope: Stethoscope,
  user: UserRound,
  users: Users,
  x: X
} as const

export type IconName = keyof typeof registry

const props = withDefaults(defineProps<{ name: string; size?: number; strokeWidth?: number }>(), {
  size: 18,
  strokeWidth: 1.7
})

const component = computed(() => registry[props.name as IconName] ?? Info)
</script>

<template>
  <component
    :is="component"
    class="icon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
    focusable="false"
  />
</template>

<style scoped>
.icon {
  flex: none;
}
</style>

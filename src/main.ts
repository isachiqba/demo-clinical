import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { useScheduleStore } from './stores/schedule'
import './styles/base.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)

// Load the schedule before the first paint so reception and booking agree from the start.
void useScheduleStore(pinia).refresh()

app.mount('#app')

document.documentElement.lang = i18n.global.locale.value

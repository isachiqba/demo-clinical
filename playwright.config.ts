import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end coverage of the main journey. The suite builds nothing itself: start the
 * preview server first (`npm run build && npm run preview -- --host 127.0.0.1 --port 4178`)
 * or let the configured web server do it.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4178',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Europe/Madrid'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: true,
    timeout: 60_000
  }
})

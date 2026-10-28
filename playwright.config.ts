import { defineConfig, devices } from '@playwright/test'

// E2E contra el build de producción (preview): el service worker solo existe ahí.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})

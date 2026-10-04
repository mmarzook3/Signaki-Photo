import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 45000,
  use: { channel: 'chrome', baseURL: process.env.SIGNAKI_TEST_URL || 'http://127.0.0.1:18124', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'off' },
  reporter: [['list'], ['html', { open: 'never' }]],
})

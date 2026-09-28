// app/playwright.config.js
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1600, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03 } },
})

// app/playwright.config.js
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1600, height: 1000 },
    // GPU rendering (Metal via ANGLE); set E2E_SWIFTSHADER=1 on machines without a GPU
    launchOptions: { args: process.env.E2E_SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000 },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03 } },
})

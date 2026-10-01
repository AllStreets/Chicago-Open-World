// app/playwright.config.js
import { defineConfig } from '@playwright/test'
// E2E_PORT runs the suite against another dev server (a worktree's), leaving the default one alone
const PORT = Number(process.env.E2E_PORT ?? 5173)
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1600, height: 1000 },
    // GPU rendering (Metal via ANGLE); set E2E_SWIFTSHADER=1 on machines without a GPU
    launchOptions: { args: process.env.E2E_SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } },
  webServer: { command: PORT === 5173 ? 'npm run dev' : `npm run dev -- --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: true, timeout: 60_000 },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.03 } },
})

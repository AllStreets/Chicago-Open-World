// app/e2e/hud-layout.spec.js — the HUD at five window sizes: nothing off-screen, nothing overlapping, no clipped dock labels.
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SIZES = [[1440, 900], [1280, 720], [1024, 640], [800, 600], [600, 900]]
const REGIONS = ['.hud-wordmark', '.hud-controls', '.dock', '.mm', '.hud-hints', '.hud-left-stack', '.perf-chip', '.flight-chip']
const LABEL = process.env.EVAL_LABEL

for (const [w, h] of SIZES) {
  test(`HUD fits at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
    await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
    await page.goto('/?view=streeterville&time=day&stats=1')
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
    await page.keyboard.press('t') // transit on: legend shows
    await page.keyboard.press('g') // games panel open
    await page.waitForTimeout(1200)
    if (LABEL) { mkdirSync(`../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/shots/${LABEL}`, { recursive: true }); await page.screenshot({ path: `../.superpowers/sdd/2026-09-29-v7-v8-controls-perf-gallery/shots/${LABEL}/hud-${w}x${h}.png` }) }
    const boxes = await page.evaluate((sels) => sels.flatMap((s) => [...document.querySelectorAll(s)]
      .filter((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length && (s !== '.hud-left-stack' || e.children.length))
      .map((e) => { const r = e.getBoundingClientRect(); return { s, x: r.left, y: r.top, r: r.right, b: r.bottom } })), REGIONS)
    for (const b of boxes) {
      expect.soft(b.x, `${b.s} left edge`).toBeGreaterThanOrEqual(0)
      expect.soft(b.y, `${b.s} top edge`).toBeGreaterThanOrEqual(0)
      expect.soft(b.r, `${b.s} right edge`).toBeLessThanOrEqual(w + 0.5)
      expect.soft(b.b, `${b.s} bottom edge`).toBeLessThanOrEqual(h + 0.5)
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j]
      const overlap = A.x < B.r - 1 && B.x < A.r - 1 && A.y < B.b - 1 && B.y < A.b - 1
      expect.soft(overlap, `${A.s} overlaps ${B.s}`).toBe(false)
    }
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.dock-btn span:not(.hud-kbd):not(.dock-compass)')].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent))
    expect(clipped).toEqual([])
    // the help card and palette also fit
    await page.keyboard.press('Shift+Slash')
    const help = await page.locator('.help').boundingBox()
    expect(help.y).toBeGreaterThanOrEqual(0); expect(help.y + help.height).toBeLessThanOrEqual(h + 0.5)
  })
}

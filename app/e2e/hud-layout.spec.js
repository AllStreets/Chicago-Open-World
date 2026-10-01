// app/e2e/hud-layout.spec.js — the HUD at five window sizes: nothing off-screen, nothing overlapping, no clipped dock labels.
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const SIZES = [[1440, 900], [1280, 720], [1024, 640], [800, 600], [600, 900]]
const REGIONS = ['.hud-wordmark', '.lens-rail', '.hud-controls', '.dock', '.mm', '.hud-hints', '.hud-left-stack', '.perf-chip', '.flight-chip']
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

const open = async (page, w, h) => {
  await page.setViewportSize({ width: w, height: h })
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00-05:00'))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?view=streeterville&time=day&stats=1')
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 90_000 })
  await page.waitForTimeout(800)
}
const boxOf = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { s, x: r.left, y: r.top, r: r.right, b: r.bottom } }), sel)
const overlaps = (A, B) => A.x < B.r - 1 && B.x < A.r - 1 && A.y < B.b - 1 && B.y < A.b - 1

// F-6 (2026-10-01): the Ride panel never covers the time and weather pills, the lenses, the dock or the minimap
for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080], [390, 844]]) {
  test(`the Ride panel leaves the other controls clear at ${w}×${h}`, async ({ page }) => {
    await open(page, w, h)
    await page.keyboard.press('KeyL')
    await expect(page.locator('.ride-panel')).toBeVisible()
    await page.waitForTimeout(400) // its rise animation
    const [panel] = await boxOf(page, '.ride-panel')
    expect(panel.y).toBeGreaterThanOrEqual(0); expect(panel.b).toBeLessThanOrEqual(h + 0.5); expect(panel.x).toBeGreaterThanOrEqual(0); expect(panel.r).toBeLessThanOrEqual(w + 0.5)
    const others = (await Promise.all(['.hud-controls .pill-row', '.lens-rail', '.dock', '.mm', '.hud-hints'].map((s) => boxOf(page, s)))).flat()
    expect(others.filter((b) => b.s === '.hud-controls .pill-row')).toHaveLength(3)
    for (const b of others) expect.soft(overlaps(panel, b), `ride panel overlaps ${b.s}`).toBe(false)
  })
}

// F-1 (2026-10-01): the weather menu shows whole, over the dock, and every choice can be clicked
for (const [w, h] of [[1280, 720], [390, 844]]) {
  test(`the weather menu is fully visible and on top at ${w}×${h}`, async ({ page }) => {
    await open(page, w, h)
    await page.locator('.weather-pill > button').click()
    await expect(page.getByRole('menu', { name: 'Weather' })).toBeVisible()
    await page.waitForTimeout(300)
    const items = await page.evaluate(() => [...document.querySelectorAll('.weather-menu [role="menuitem"]')].map((e) => {
      const r = e.getBoundingClientRect(), pts = [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]
      return { name: e.textContent, x: r.left, y: r.top, r: r.right, b: r.bottom, onTop: pts.every(([x, y]) => e.contains(document.elementFromPoint(x, y))) }
    }))
    expect(items).toHaveLength(6)
    for (const it of items) {
      expect(it.x, it.name).toBeGreaterThanOrEqual(0); expect(it.y, it.name).toBeGreaterThanOrEqual(0)
      expect(it.r, it.name).toBeLessThanOrEqual(w + 0.5); expect(it.b, it.name).toBeLessThanOrEqual(h + 0.5)
      expect(it.onTop, `${it.name} is on top`).toBe(true)
    }
    await page.getByRole('menuitem', { name: 'Lake fog' }).click() // the last one, once hidden under the dock
    expect(await page.evaluate(() => window.__store.getState().weatherMode)).toBe('FOG')
  })
}

// Workstream C (C-5): M shows a bare green speaker in the middle of the screen, then a red one with a slash
test('the sound toast: centred, bare, green on, red off, gone by 2.8 s', async ({ page }) => {
  await open(page, 1440, 900)
  const look = () => page.evaluate(() => {
    const t = document.querySelector('.sound-toast'), g = t?.querySelector('.sound-glyph')
    if (!t) return null
    const r = g.getBoundingClientRect(), ts = getComputedStyle(t), gs = getComputedStyle(g)
    return { state: t.dataset.state, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, bg: ts.backgroundColor, border: ts.borderTopWidth, filters: [ts.filter, gs.filter],
      shadows: [ts.boxShadow, gs.boxShadow, ts.textShadow, gs.textShadow], colour: gs.color, said: document.querySelector('.sound-toast-live')?.textContent }
  })
  await page.keyboard.press('KeyM')
  await page.waitForTimeout(300)
  const on = await look()
  expect(on.state).toBe('on'); expect(on.said).toBe('Sound on')
  expect(Math.abs(on.cx - 720) / 1440).toBeLessThan(0.02); expect(Math.abs(on.cy - 450) / 900).toBeLessThan(0.02)
  expect(on.bg).toBe('rgba(0, 0, 0, 0)'); expect(on.border).toBe('0px')
  expect(on.filters).toEqual(['none', 'none']); for (const s of on.shadows) expect(s).toBe('none')
  expect(on.colour).toBe('rgb(52, 224, 122)')
  await page.waitForTimeout(2500) // 2.8 s after the press
  expect(await look()).toBeNull()
  await page.keyboard.press('KeyM')
  await page.waitForTimeout(300)
  const off = await look()
  expect(off.state).toBe('off'); expect(off.colour).toBe('rgb(255, 59, 83)'); expect(off.said).toBe('Sound off')
})

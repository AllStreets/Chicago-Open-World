// app/e2e/showcase.spec.js — E4-5: "Play a game" from the Wrigley card. Play starts a showcase over the real (idle)
// state, the board moves on, Stop and Esc both hand back the real ballpark, and a real live game hides the button.
// /api/schedule answers 503 so the build-time schedule (or the simulated calendar) is the "real" state; ?sports pins it.
import { test, expect } from '@playwright/test'

async function boot(page, query = '') {
  await page.route('**/api/schedule', (r) => r.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' }, body: '{}' }))
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto(`/?view=wrigleyville&time=day&stats${query}`)
  await page.waitForFunction(() => window.__worldReady === true && window.__sports?.getState().venues.length > 0, null, { timeout: 90_000 })
  await page.evaluate(() => window.__sports.getState().openCard('wrigleyfield'))
}
const wrigley = (page) => page.evaluate(() => { const s = window.__sports.getState(); const st = s.states.wrigleyfield; return { showcase: s.showcase, state: st?.state, preview: Boolean(st?.game?.showcase), status: st?.game ? `${st.game.home.score}-${st.game.away.score}` : null } })

test('Play starts a game at Wrigley; the board moves on; Stop and Esc give back the real ballpark', async ({ page }) => {
  await boot(page, '&sports=idle')
  const card = page.locator('.venue-card')
  await card.getByRole('button', { name: /Play a Cubs game/ }).click()
  await expect.poll(async () => (await wrigley(page)).preview, { timeout: 2_000 }).toBe(true)
  expect((await wrigley(page)).showcase).toMatchObject({ venueKey: 'wrigleyfield', team: 'cubs' })
  await expect(card.locator('.vc-status')).toHaveText(/FIRST PITCH SOON|TOP 1ST|BOT 1ST/)
  const first = await card.locator('.vc-status').textContent()
  await expect(card.locator('.vc-status')).not.toHaveText(first, { timeout: 12_000 }) // the board moves on at the 10-s first pitch (+ a 1-s tick)
  await expect(card.locator('.vc-foot')).toContainText('PREVIEW')
  await card.getByRole('button', { name: /Stop the game/ }).click()
  await expect.poll(async () => (await wrigley(page)).preview, { timeout: 3_000 }).toBe(false)
  expect(await wrigley(page)).toMatchObject({ showcase: null, state: 'idle' })
  // Esc stops it too (and the Y key starts it from the open card)
  await page.keyboard.press('y')
  await expect.poll(async () => (await wrigley(page)).preview, { timeout: 2_000 }).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await wrigley(page)).showcase, { timeout: 2_000 }).toBeNull()
})

test('a real live game hides the button: "Live now — this is the real game"', async ({ page }) => {
  await boot(page, '&sports=live')
  const card = page.locator('.venue-card')
  await expect(card).toContainText('Live now — this is the real game')
  await expect(card.getByRole('button', { name: /Play a/ })).toHaveCount(0)
  await page.keyboard.press('y') // Y can't override it either
  await page.waitForTimeout(500)
  expect((await wrigley(page)).showcase).toBeNull()
})

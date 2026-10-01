// app/e2e/sports.spec.js — E1-6: the schedule refreshes from our own /api/schedule (stubbed here: no test calls ESPN),
// and when that fails the cards fall back to the build-time schedule and say so.
import { test, expect } from '@playwright/test'

const side = (abbr, name, score = null) => ({ abbr, name, score, winner: null })
function fixture(now) {
  const iso = (ms) => new Date(ms).toISOString()
  return {
    version: 1, source: 'espn-proxy', generatedAt: iso(now), partial: [],
    games: [
      { id: 'e2e-cubs', teams: ['cubs'], results: {}, sport: 'baseball', league: 'mlb', start: iso(now - 3600000), venue: 'wrigleyfield', venueName: 'Wrigley Field',
        status: 'STATUS_IN_PROGRESS', state: 'in', detail: 'Top 6th', home: side('CHC', 'Chicago Cubs', 4), away: side('NYM', 'New York Mets', 2), chicagoHome: true, attendance: null },
      { id: 'e2e-bears', teams: ['bears'], results: {}, sport: 'football', league: 'nfl', start: iso(now + 86400000), venue: 'soldierfield', venueName: 'Soldier Field',
        status: 'STATUS_SCHEDULED', state: 'pre', detail: '', home: side('CHI', 'Chicago Bears'), away: side('GBX', 'Fixture Packers'), chicagoHome: true, attendance: null },
    ],
  }
}

async function boot(page) {
  await page.addInitScript(() => { try { localStorage.setItem('chi-ow-help-seen', '1') } catch {} })
  await page.goto('/?view=loop&time=day&stats')
  await page.waitForFunction(() => window.__worldReady === true && window.__sports?.getState().venues.length > 0, null, { timeout: 90_000 })
}
const openCard = (page, key) => page.evaluate((k) => window.__sports.getState().openCard(k), key)

test('the proxy schedule reaches the cards: next Bears game, a live Cubs score', async ({ page }) => {
  await page.route('**/api/schedule', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture(Date.now())) }))
  await boot(page)
  await page.waitForFunction(() => window.__sports.getState().origin === 'proxy' && window.__sports.getState().states.wrigleyfield?.state === 'live', null, { timeout: 30_000 })
  await openCard(page, 'soldierfield')
  const card = page.locator('.venue-card')
  await expect(card).toContainText('NEXT GBX')
  await expect(card.locator('.data-note')).toHaveText(/^ESPN · updated (just now|\d+ min ago)$/)
  await openCard(page, 'wrigleyfield')
  await expect(card.locator('.vc-head .chip')).toHaveText('LIVE')
  await expect(card.locator('.vc-row')).toHaveText([/NYM\s*2/, /CHC\s*4/])
  await expect(card).toContainText('TOP 6TH')
})

test('a 503 from /api/schedule leaves the build-time schedule, labelled as not refreshed', async ({ page }) => {
  await page.route('**/api/schedule', (route) => route.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' }, contentType: 'application/json', body: '{"error":"ESPN unreachable"}' }))
  await boot(page)
  await page.waitForFunction(() => window.__sports.getState().origin != null, null, { timeout: 30_000 })
  const origin = await page.evaluate(() => window.__sports.getState().origin)
  expect(origin).not.toBe('proxy')
  await openCard(page, 'soldierfield')
  const card = page.locator('.venue-card')
  await expect(card).not.toContainText('GBX')
  // the build-time file (younger than 45 days) → amber "couldn't refresh"; past that, the simulated calendar
  await expect(card.locator('.data-note')).toHaveText(origin === 'file' ? /^ESPN schedule from [A-Z][a-z]{2} \d+ — couldn’t refresh$/ : 'Simulated schedule — typical home dates')
  if (origin === 'file') await expect(card.locator('.data-note')).toHaveClass(/data-stale/)
})

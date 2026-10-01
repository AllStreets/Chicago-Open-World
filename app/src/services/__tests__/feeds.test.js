// app/src/services/__tests__/feeds.test.js — the per-feed scheduler (P5 Task 1): backoff, hidden tab, parse errors.
import { describe, it, expect, vi } from 'vitest'
import { createFeed } from '../chiApi.js'
import { startFeeds } from '../feeds.js'
import { useStore } from '../../state/store.js'

function harness(responses, hidden = false) {
  const timers = []
  const statuses = [], data = []
  let i = 0
  const feed = createFeed({
    name: 'cta', path: '/api/cta/trains', intervalMs: 30_000,
    get: vi.fn(async () => responses[Math.min(i++, responses.length - 1)]),
    onData: (d) => data.push(d), onStatus: (s) => statuses.push(s),
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, cancel: () => {}, isHidden: () => hidden,
  })
  return { feed, timers, statuses, data }
}
describe('createFeed', () => {
  it('reports LIVE with data, then SIMULATED with backoff on failure, then LIVE again', async () => {
    const h = harness([{ trains: [] }, null, null, { trains: [1] }])
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('LIVE'); expect(h.timers.at(-1).ms).toBe(30_000)
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('SIMULATED'); expect(h.timers.at(-1).ms).toBe(60_000)
    await h.feed.refresh(); expect(h.timers.at(-1).ms).toBe(120_000)
    await h.feed.refresh(); expect(h.statuses.at(-1)).toBe('LIVE'); expect(h.timers.at(-1).ms).toBe(30_000)
    expect(h.data).toEqual([{ trains: [] }, { trains: [1] }])
  })
  it('does not fetch while the tab is hidden', async () => {
    const h = harness([{ trains: [] }], true)
    await h.feed.refresh(); expect(h.data).toEqual([])
  })
  it('a parse error counts as a failure, not a crash', async () => {
    const statuses = []
    const feed = createFeed({ name: 'w', path: '/x', intervalMs: 1000, get: async () => ({}), parse: () => { throw new Error('bad') }, onData: () => {}, onStatus: (s) => statuses.push(s), schedule: () => 0, cancel: () => {}, isHidden: () => false })
    await feed.refresh(); expect(statuses).toEqual(['SIMULATED'])
  })
  it('an interval function lets a feed pick its own cadence (sports: fast around games)', async () => {
    const timers = []
    const feed = createFeed({ name: 's', path: '/x', intervalMs: () => 60_000, get: async () => ({}), onData: () => {}, onStatus: () => {}, schedule: (fn, ms) => timers.push(ms), cancel: () => {}, isHidden: () => false })
    await feed.refresh(); expect(timers).toEqual([60_000])
  })
  it('stop() ignores an answer that arrives afterwards', async () => {
    let resolve
    const data = []
    const feed = createFeed({ name: 'c', path: '/x', intervalMs: 1000, get: () => new Promise((r) => { resolve = r }), onData: (d) => data.push(d), onStatus: () => {}, schedule: () => 1, cancel: () => {}, isHidden: () => false })
    const p = feed.refresh(); feed.stop(); resolve({ late: true }); await p
    expect(data).toEqual([])
  })
})

describe('startFeeds', () => {
  it('offline (no API configured): every feed stays SIMULATED and nothing is fetched', async () => {
    useStore.setState(useStore.getInitialState())
    const get = vi.fn(async () => ({}))
    const stop = await startFeeds({ probe: async () => 'offline', get, base: '' })
    expect(useStore.getState().apiStatus).toBe('offline')
    expect(Object.values(useStore.getState().feeds).every((s) => s === 'SIMULATED')).toBe(true)
    expect(get).not.toHaveBeenCalled()
    stop()
  })
  it('live: the probe flips apiStatus and the feeds report LIVE as their data arrives', async () => {
    useStore.setState(useStore.getInitialState())
    const get = vi.fn(async (path) => (path === '/api/weather' ? { icon: '10d', description: 'light rain', visibility: 6, wind: { speed: 4, deg: 270 } } : path === '/api/cta/trains' ? { trains: [] } : path === '/api/sports' ? [] : { alerts: [] }))
    const stop = await startFeeds({ probe: async () => 'live', get, base: 'https://chi.example', schedule: () => 0, cancel: () => {}, isHidden: () => false })
    await new Promise((r) => setTimeout(r, 0))
    const s = useStore.getState()
    expect(s.apiStatus).toBe('live')
    expect(s.feeds.cta).toBe('LIVE'); expect(s.feeds.weather).toBe('LIVE'); expect(s.feeds.sports).toBe('LIVE'); expect(s.feeds.alerts).toBe('LIVE')
    expect(s.feedAt.cta).toBeGreaterThan(0)
    stop()
  })
  it('a CHI that answers 502 for trains leaves the chip on SIMULATED', async () => {
    useStore.setState(useStore.getInitialState())
    const get = vi.fn(async (path) => (path === '/api/cta/trains' ? null : {}))
    const stop = await startFeeds({ probe: async () => 'live', get, base: 'https://chi.example', schedule: () => 0, cancel: () => {}, isHidden: () => false })
    await new Promise((r) => setTimeout(r, 0))
    expect(useStore.getState().feeds.cta).toBe('SIMULATED')
    stop()
  })
})

// app/src/services/feeds.js — every live feed wired to the app in one place (P5 · I-5.1): the boot probe, then one
// scheduler per feed (cadence in FEEDS). Offline — no VITE_CHI_API_URL, or CHI down — every feed stays SIMULATED and
// the city runs on its simulators and build-time data; the chip is the only sign.
import { useStore } from '../state/store.js'
import { chiBase, chiGet, probeHealth, createFeed, FEEDS } from './chiApi.js'
import { applyLineAlerts } from '../transit/lineAlerts.js'

const REPROBE_MS = 60_000
let running = null // the live session's feeds, so the chip's "Try live again" and ⌘K can refresh them

// What each feed does with a good answer (and with a failure, where the app must forget stale live data).
export const FEED_WIRING = {
  cta: { parse: (j) => { if (!Array.isArray(j?.trains)) throw new Error('no trains'); return j }, onData: () => {}, onFail: () => {} },
  alerts: { parse: (j) => j, onData: (j) => applyLineAlerts(j), onFail: () => applyLineAlerts(null) },
  weather: { parse: (j) => j, onData: () => {}, onFail: () => {} },
  sports: { parse: (j) => j, onData: () => {}, onFail: () => {} },
}

export async function startFeeds({ probe = probeHealth, get = chiGet, base = chiBase(), schedule = setTimeout, cancel = clearTimeout, isHidden } = {}) {
  const s = () => useStore.getState()
  let stopped = false, feeds = [], reprobe = null
  const begin = () => {
    feeds = Object.entries(FEEDS).map(([name, cfg]) => {
      const w = FEED_WIRING[name]
      return createFeed({
        name, path: cfg.path, intervalMs: w.intervalMs ?? cfg.intervalMs, parse: w.parse, get: (p) => get(p),
        onData: (d) => w.onData(d), onStatus: (st) => { s().setFeed(name, st); if (st !== 'LIVE') w.onFail() },
        schedule, cancel, ...(isHidden ? { isHidden } : {}),
      })
    })
    running = { refresh: () => feeds.forEach((f) => f.refresh()) }
    feeds.forEach((f) => f.start())
  }
  const tryProbe = async () => {
    const status = await probe({ base })
    if (stopped) return
    s().setApiStatus(status)
    if (status === 'live') begin()
    else if (base) reprobe = schedule(tryProbe, REPROBE_MS) // nothing to probe without a base URL (ruling)
  }
  await tryProbe()
  const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) running?.refresh() }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    if (reprobe != null) cancel(reprobe)
    feeds.forEach((f) => f.stop())
    running = null
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
  }
}

// The app's one live session (started by <LiveFeeds/> at boot).
let session = null
export function bootFeeds(opts) {
  session ??= startFeeds(opts)
  return session
}

// The chip's "Try live again": refresh every running feed, or probe again when CHI was unreachable.
export function retryLive() {
  if (running) { running.refresh(); return true }
  if (!chiBase()) return false
  const old = session
  session = null
  Promise.resolve(old).then((stop) => stop?.()).then(() => bootFeeds())
  return true
}

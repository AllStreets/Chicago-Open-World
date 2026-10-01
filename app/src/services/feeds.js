// app/src/services/feeds.js — every live feed wired to the app in one place (P5 · I-5.1): the schedule feed (our own
// cached /api/schedule, always on — E1), then the CHI boot probe and one scheduler per CHI feed (cadence in FEEDS).
// CHI offline — no VITE_CHI_API_URL, or CHI down — every CHI feed stays SIMULATED and the city runs on its simulators
// and build-time data; the chip is the only sign. The browser never calls ESPN; our own cached /api/schedule does.
import { useStore } from '../state/store.js'
import { chiBase, chiGet, probeHealth, createFeed, FEEDS } from './chiApi.js'
import { applyLineAlerts } from '../transit/lineAlerts.js'
import { ingestLiveTrains } from '../transit/liveStore.js'
import { parseChiSports, sportsInterval, FAST_MS, SLOW_MS } from '../sports/liveScores.js'
import { weatherFromChi } from '../weather/weatherState.js'
import { applyLiveSports, applyProxySchedule } from '../sports/SportsClock.jsx'
import { parseProxySchedule } from '../sports/sportsStore.js'
import { inGameWindow } from '../../../shared/schedules.js'

const REPROBE_MS = 60_000
let running = null // the live session's feeds, so the chip's "Try live again" and ⌘K can refresh them

// What each feed does with a good answer (and with a failure, where the app must forget stale live data).
export const FEED_WIRING = {
  cta: { parse: (j) => { if (!Array.isArray(j?.trains)) throw new Error('no trains'); return j }, onData: (j) => ingestLiveTrains(j), onFail: () => {} }, // offline: the simulator takes over; stale live trains age out
  alerts: { parse: (j) => j, onData: (j) => applyLineAlerts(j), onFail: () => applyLineAlerts(null) },
  weather: { parse: (j) => { const w = weatherFromChi(j); if (w.source !== 'live') throw new Error('unreadable'); return w }, onData: (w) => useStore.getState().setWeatherLive(w),
    onFail: () => useStore.getState().setWeatherLive(weatherFromChi(null)) }, // offline (or CHI's 503 without a key): a clear sky
  sports: { parse: (j) => { if (!Array.isArray(j)) throw new Error('no teams'); return parseChiSports(j).flatMap((t) => t.games) }, onData: (g) => applyLiveSports(g),
    onFail: () => {}, intervalMs: (last) => sportsInterval(last ?? [], Date.now()) }, // offline: the last live state ages out on the clock; the schedule carries on
}

// E1: our own cached same-origin /api/schedule (app/api/schedule.js → ESPN). Not a CHI feed: it starts always, with
// no probe and no VITE_CHI_API_URL. Every minute around in-map games, else every 10. A failed, stale or unreadable
// answer (dev without the proxy gets index.html) changes nothing: the build-time schedule, or the simulated
// calendar, stays. It never touches the LIVE / SIMULATED chip, which is about CHI ATLAS.
export const SCHEDULE_FEED = {
  path: '/api/schedule',
  parse: (j) => parseProxySchedule(j, Date.now()),
  intervalMs: (last, nowMs = Date.now()) => (last && inGameWindow(last.games, nowMs) ? FAST_MS : SLOW_MS),
}
export async function fetchSchedule(path, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!fetchImpl) return null
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchImpl(path, { signal: ctl.signal, headers: { accept: 'application/json' } })
    return r?.ok ? await r.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function startFeeds({ probe = probeHealth, get = chiGet, getSchedule = fetchSchedule, base = chiBase(), schedule = setTimeout, cancel = clearTimeout, isHidden } = {}) {
  const s = () => useStore.getState()
  let stopped = false, feeds = [], reprobe = null
  const sched = createFeed({
    name: 'schedule', path: SCHEDULE_FEED.path, intervalMs: (last) => SCHEDULE_FEED.intervalMs(last), parse: SCHEDULE_FEED.parse,
    get: (p) => getSchedule(p), onData: (d) => applyProxySchedule(d), onStatus: () => {}, schedule, cancel, ...(isHidden ? { isHidden } : {}),
  })
  sched.start()
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
  const onVisible = () => { if (typeof document !== 'undefined' && !document.hidden) { running?.refresh(); sched.refresh() } }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    sched.stop()
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

// app/src/services/chiApi.js — the CHI ATLAS API, used opportunistically (B.1.5): every call returns parsed JSON or
// null — never throws, never shows an error. No VITE_CHI_API_URL means no API: the guide runs on build-time data.
export function chiBase(env = import.meta.env) {
  return (env?.VITE_CHI_API_URL ?? '').replace(/\/+$/, '')
}

export async function chiGet(path, { timeoutMs = 4000, fetchImpl = globalThis.fetch, base = chiBase() } = {}) {
  if (!base || !fetchImpl) return null
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchImpl(`${base}${path}`, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r?.ok) return null
    return await r.json()
  } catch {
    return null // timeout, network or CORS error, non-JSON body
  } finally {
    clearTimeout(timer)
  }
}

// Boot probe (P5): 'live' only when CHI answers /api/health with { status: 'ok' } inside 2 s.
export async function probeHealth({ base = chiBase(), fetchImpl = globalThis.fetch, timeoutMs = 2000 } = {}) {
  const j = await chiGet('/api/health', { base, fetchImpl, timeoutMs })
  return j?.status === 'ok' ? 'live' : 'offline'
}

export const MAX_BACKOFF_MS = 5 * 60_000
export const nextDelay = (intervalMs, failures) => Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS)

// One polled feed: LIVE while answers parse, SIMULATED (with backoff) when they don't; no fetch while the tab is
// hidden. `intervalMs` may be a function of the last parsed data (sports poll fast around games).
export function createFeed({ name, path, intervalMs, parse = (j) => j, onData, onStatus, get = chiGet,
  schedule = setTimeout, cancel = clearTimeout, isHidden = () => typeof document !== 'undefined' && document.hidden }) {
  let timer = null, failures = 0, last = null, alive = true, gen = 0
  const every = () => (typeof intervalMs === 'function' ? intervalMs(last) : intervalMs)
  const plan = (ms) => { if (timer != null) cancel(timer); timer = alive ? schedule(() => { timer = null; refresh() }, ms) : null }
  async function refresh() {
    if (!alive) return
    if (isHidden()) { plan(every()); return }
    const mine = ++gen
    const json = await get(path)
    if (!alive || mine !== gen) return
    let data = null, ok = json != null
    if (ok) { try { data = parse(json) } catch { ok = false } }
    if (ok) { failures = 0; last = data; onData?.(data); onStatus?.('LIVE') } else { failures++; onStatus?.('SIMULATED') }
    plan(nextDelay(every(), ok ? 0 : failures))
  }
  return {
    name,
    start() { alive = true; return refresh() },
    stop() { alive = false; gen++; if (timer != null) cancel(timer); timer = null },
    refresh,
  }
}

export const FEEDS = {
  cta: { path: '/api/cta/trains', intervalMs: 30_000 },
  alerts: { path: '/api/cta/alerts', intervalMs: 300_000 },
  weather: { path: '/api/weather', intervalMs: 600_000 },
  sports: { path: '/api/sports', intervalMs: 600_000 },
}

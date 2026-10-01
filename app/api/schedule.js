// app/api/schedule.js — GET /api/schedule: a CDN-cached proxy of ESPN's public team schedules and today's league
// scoreboards, in the schedules.json shape (E1). The browser never calls ESPN; our own cached /api/schedule does:
// the page calls this same-origin function, and Vercel's CDN keeps the answer 10 min (1 min around games), so ESPN sees about one fetch per URL per cache
// window however many people visit. On a total failure: 503, never cached, and the app keeps its build-time file.
import { TEAMS } from '../../shared/teams.js'
import { scheduleUrls, scoreboardUrl, parseEvent, mergeGames, inGameWindow } from '../../shared/schedules.js'

export const USER_AGENT = 'chi-atlas-open-world (schedule proxy)'
const KEEP_BACK_MS = 2 * 86400000
export const CACHE = { calm: 'public, s-maxage=600, stale-while-revalidate=3600', game: 'public, s-maxage=60, stale-while-revalidate=60', fail: 'no-store' }

async function getEvents(fetchImpl, url, timeoutMs) {
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': USER_AGENT, accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const events = (await r.json())?.events
  return Array.isArray(events) ? events : []
}

export async function buildSchedule({ fetchImpl = globalThis.fetch, nowMs = Date.now(), teams = TEAMS, timeoutMs = 4000 } = {}) {
  // every team's season lists in parallel (one try each — no retry loops against ESPN)
  const jobs = teams.flatMap((team) => scheduleUrls(team).map((url) => ({ team, url })))
  const settled = await Promise.allSettled(jobs.map((j) => getEvents(fetchImpl, j.url, timeoutMs)))
  const failed = new Set(), lists = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') lists.push(s.value.map((e) => parseEvent(e, jobs[i].team)))
    else failed.add(jobs[i].team.key)
  })
  if (failed.size === teams.length && lists.length === 0) {
    return { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE.fail }, body: { error: 'ESPN unreachable' } }
  }
  // today's scoreboards (one per league) carry in-progress state and scores the team lists lag behind on
  const leagues = [...new Map(teams.map((t) => [t.league, t])).values()]
  const boards = await Promise.allSettled(leagues.map((t) => getEvents(fetchImpl, scoreboardUrl(t), timeoutMs)))
  const live = []
  boards.forEach((b, i) => {
    if (b.status !== 'fulfilled') return
    const ours = teams.filter((t) => t.league === leagues[i].league)
    for (const e of b.value) {
      const ids = (e?.competitions?.[0]?.competitors ?? []).map((c) => String(c.team?.id))
      for (const t of ours) if (ids.includes(String(t.espnId))) live.push(parseEvent(e, t))
    }
  })
  const games = mergeGames(lists)
  const byKey = new Map(games.map((g) => [`${g.league}:${g.id}`, g]))
  for (const lg of live) {
    if (!lg) continue
    const g = byKey.get(`${lg.league}:${lg.id}`)
    if (!g) { games.push(lg); byKey.set(`${lg.league}:${lg.id}`, lg); continue } // a makeup game the lists don't know yet
    Object.assign(g, { state: lg.state, status: lg.status, detail: lg.detail, home: lg.home, away: lg.away, attendance: lg.attendance ?? g.attendance, results: { ...g.results, ...lg.results } })
  }
  const kept = games.filter((g) => Date.parse(g.start) >= nowMs - KEEP_BACK_MS).sort((a, b) => a.start.localeCompare(b.start))
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': inGameWindow(kept, nowMs) ? CACHE.game : CACHE.calm },
    body: { version: 1, generatedAt: new Date(nowMs).toISOString(), source: 'espn-proxy', partial: [...failed], games: kept },
  }
}

// Node (req, res) handler: Vercel's Node runtime in production, the Vite dev middleware locally (vite.config.js).
export default async function handler(req, res) {
  let r
  try {
    r = await buildSchedule()
  } catch {
    r = { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE.fail }, body: { error: 'schedule proxy failed' } }
  }
  res.statusCode = r.status
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v)
  res.end(JSON.stringify(r.body))
}

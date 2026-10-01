// pipeline/lib/schedules.js — ESPN's public site API → schedules.json at build time (npm run schedules). The parser
// lives in shared/schedules.js, shared with the live site's cached /api/schedule proxy (app/api/schedule.js), so
// schedules refresh on the live site too. The browser never calls ESPN; our own cached /api/schedule does.
import { TEAMS } from '../../shared/teams.js'
import { ESPN, SEASON_TYPES, scheduleUrls, scoreOf, parseEvent, mergeGames, scoreboardUrl, inGameWindow } from '../../shared/schedules.js'

export { ESPN, SEASON_TYPES, scheduleUrls, scoreOf, parseEvent, mergeGames, scoreboardUrl, inGameWindow }

export async function fetchAllSchedules(fetchImpl, { teams = TEAMS, timeoutMs = 10000, log = () => {} } = {}) {
  const lists = [], failures = []
  for (const team of teams) {
    for (const url of scheduleUrls(team)) {
      try {
        const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'chi-atlas-open-world (build)' } })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const events = (await r.json())?.events ?? []
        lists.push(events.map((e) => parseEvent(e, team)))
        log(`  ✓ ${team.key} ${url.split('?')[1] ?? 'season'}: ${events.length}`)
      } catch (err) {
        failures.push({ team: team.key, url, error: String(err?.message ?? err) })
      }
    }
  }
  return { games: mergeGames(lists), failures }
}

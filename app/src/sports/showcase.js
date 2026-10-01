// app/src/sports/showcase.js — "Play a game" (E4): a 90-second accelerated game at Wrigley, Rate Field or Soldier
// Field. Pure: (venue, team, startedAt, now) → the same venue state the real schedule produces ({ state, game, … }),
// with `virtualNow` — the game's own clock — so boardLines, periodLabel, the marquee and the W flag work unchanged.
// 10 s of pregame (the crowd fills, the lights come up), 65 s of play mapped onto the sport's whole game, 15 s of
// final (at Wrigley after a Cubs win the W goes up and fans come onto the field). The home team always wins.
// A showcase never writes the schedule: it only replaces one venue's computed state while that venue is idle or
// in its postgame hour (applyShowcase), and a real game always wins.
import { SPORT_MINUTES } from './gameState.js'
import { hashFrac } from './simSchedule.js'
import { HALF_INNING_S } from './formations.js'
import { teamByKey } from '../../../shared/teams.js'

export const SHOWCASE_S = 90, PREGAME_S = 10, PLAY_S = 65, FINAL_S = SHOWCASE_S - PREGAME_S - PLAY_S
// the open-air venues and the teams a showcase can play there (the first is the card's button)
export const SHOWCASE_TEAMS = { wrigleyfield: ['cubs'], ratefield: ['whitesox'], soldierfield: ['bears', 'fire'] }
export const SHOWCASE_VENUES = Object.keys(SHOWCASE_TEAMS)
export const isShowcaseVenue = (key) => Object.hasOwn(SHOWCASE_TEAMS, key ?? '')
export const showcaseVerb = (team) => (teamByKey(team)?.sport === 'soccer' ? 'match' : 'game')
export const showcaseTitle = (team) => { const t = teamByKey(team); return `Play a ${t?.name ?? ''} ${showcaseVerb(team)}` }

const OPP = { cubs: ['STL', 'MIL', 'NYM', 'LAD', 'SF', 'CIN'], whitesox: ['DET', 'MIN', 'CLE', 'KC', 'NYY', 'BOS'], bears: ['GB', 'DET', 'MIN', 'DAL', 'NYG', 'SEA'], fire: ['CLB', 'CIN', 'NE', 'NYC', 'ORL', 'TOR'] }
// each scoring play's points, home and away: 5–2, 24–10, 3–1 — enough plays to see the board and the crowd move
const PLAYS = { baseball: { home: [1, 2, 1, 1], away: [1, 1] }, football: { home: [7, 3, 7, 7], away: [3, 7] }, soccer: { home: [1, 1, 1], away: [1] } }
const PREGAME_WORDS = { baseball: 'FIRST PITCH SOON', football: 'KICKOFF SOON', soccer: 'KICKOFF SOON' }

// The scoring plays at fixed, hashed moments (fractions of the game), spread out, the home team scoring last.
export function scoringPlays(sport, seed) {
  const p = PLAYS[sport] ?? PLAYS.baseball
  const list = [...p.home.map((pts) => ({ side: 'home', pts })), ...p.away.map((pts) => ({ side: 'away', pts }))]
  const last = list.shift() // a home play, kept for the end
  const keyed = list.map((x, i) => ({ x, k: hashFrac(`${seed}:o${i}`) })).sort((a, b) => a.k - b.k).map((o) => o.x)
  list.splice(0, list.length, ...keyed, last)
  const n = list.length
  return list.map((x, i) => ({ ...x, f: +(0.05 + ((i + 0.25 + 0.5 * hashFrac(`${seed}:f${i}`)) / n) * 0.9).toFixed(4) }))
}
export function scoreAt(plays, f) {
  const s = { home: 0, away: 0 }
  for (const p of plays) if (p.f <= f) s[p.side] += p.pts
  return s
}

// The venue's state `nowMs` into a showcase started at `startedAt`, or null once it's over (or not started).
export function showcaseState(venue, team, startedAt, nowMs) {
  const e = (nowMs - startedAt) / 1000, t = teamByKey(team)
  if (!t || !(e >= 0) || e >= SHOWCASE_S) return null
  const dur = (SPORT_MINUTES[t.sport] ?? 150) * 60000, start = startedAt + PREGAME_S * 1000
  const state = e < PREGAME_S ? 'pregame' : e < PREGAME_S + PLAY_S ? 'live' : 'postgame'
  // the game's own clock: the last 10 minutes before the start, then the whole game in 65 s, then the minutes after
  const virtualNow = state === 'pregame' ? start - (PREGAME_S - e) * 60000 : state === 'live' ? start + ((e - PREGAME_S) / PLAY_S) * dur : start + dur + (e - PREGAME_S - PLAY_S) * 60000
  const frac = Math.max(0, Math.min(1, (virtualNow - start) / dur))
  const seed = `${venue.key}:${team}:${startedAt}`
  const opp = OPP[team]?.[Math.floor(hashFrac(seed) * OPP[team].length)] ?? 'VIS'
  const sc = state === 'pregame' ? null : scoreAt(scoringPlays(t.sport, seed), frac)
  const final = state === 'postgame'
  const game = {
    id: `showcase-${venue.key}-${team}`, teams: [team], results: final ? { [team]: 'W' } : {}, sport: t.sport, league: t.league,
    start: new Date(start).toISOString(), venue: venue.key, venueName: venue.name ?? '', status: final ? 'STATUS_FINAL' : 'STATUS_IN_PROGRESS',
    state: final ? 'post' : state === 'live' ? 'in' : 'pre', detail: '',
    home: { abbr: t.abbr, name: t.full, score: sc?.home ?? null, winner: final ? true : null },
    away: { abbr: opp, name: opp, score: sc?.away ?? null, winner: final ? false : null },
    chicagoHome: true, attendance: null, simulated: false, showcase: true,
    pregameStatus: PREGAME_WORDS[t.sport] ?? 'STARTING SOON',
  }
  const winDay = final && team === 'cubs'
  return { state, game, virtualNow, winDay, lossDay: false, showcase: { team, startedAt, elapsed: e, frac } }
}

// Seconds for formations.js during a showcase: three times real speed, and at a ballpark the half-inning the board
// shows, so the right team is in the field.
export function fieldClock(sport, sc, nowMs) {
  const e = Math.max(0, (nowMs - sc.startedAt) / 1000)
  if (sport === 'baseball') {
    const f = Math.max(0, Math.min(0.9999, (e - PREGAME_S) / PLAY_S)), half = Math.min(17, Math.floor(f * 18))
    return half * HALF_INNING_S + 60 + ((e * 3) % (HALF_INNING_S - 120))
  }
  return 600 + e * 3
}

// The showcase's place among the real states: it replaces its venue's state only while that venue is idle or in its
// postgame hour. → { states, stop: null | 'expired' | 'live' | 'pregame', scored: [{ side, delta }] } (scored = since
// `prev`, the states shown before, so the crowd can stand for each home score).
export function applyShowcase(states, venues, showcase, nowMs, prev = {}) {
  if (!showcase) return { states, stop: null, scored: [] }
  const real = states[showcase.venueKey]
  if (real?.state === 'live') return { states, stop: 'live', scored: [] }
  if (real?.state === 'pregame') return { states, stop: 'pregame', scored: [] }
  const venue = venues.find((v) => v.key === showcase.venueKey)
  const st = venue && showcaseState(venue, showcase.team, showcase.startedAt, nowMs)
  if (!st) return { states, stop: 'expired', scored: [] }
  const before = prev[showcase.venueKey]?.game?.showcase ? prev[showcase.venueKey].game : null
  const scored = []
  for (const side of ['home', 'away']) {
    const d = (st.game[side].score ?? 0) - (before?.[side]?.score ?? 0)
    if (d > 0 && st.state !== 'pregame') scored.push({ side, delta: d })
  }
  return { states: { ...states, [showcase.venueKey]: { ...st, next: real?.next ?? null } }, stop: null, scored }
}

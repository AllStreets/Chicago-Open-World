// app/src/sports/simSchedule.js — the simulated calendar: typical home dates and times for Chicago's seven
// teams (backlog default 6). Deterministic; results are fixed but only revealed after each game ends.
import { TEAMS } from '../../../shared/teams.js'
import { chicagoToUtc, addDays, weekday } from './chicagoTime.js'

export function hashFrac(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}
const OPP = {
  mlb: ['MIL', 'STL', 'CIN', 'PIT', 'LAD', 'NYM', 'SF', 'ATL', 'DET', 'MIN'],
  nfl: ['GB', 'DET', 'MIN', 'DAL', 'NYG', 'SEA', 'TB', 'LAR'],
  nba: ['MIL', 'DET', 'CLE', 'IND', 'BOS', 'NYK', 'LAL', 'MIA'],
  nhl: ['DET', 'STL', 'MIN', 'NSH', 'COL', 'DAL', 'WPG', 'TOR'],
  wnba: ['IND', 'NY', 'LV', 'CON', 'ATL', 'MIN', 'SEA', 'WSH'],
  'usa.1': ['CLB', 'CIN', 'NE', 'NYC', 'ORL', 'MIA', 'TOR', 'MTL'],
}
// hashFrac (plain FNV-1a) barely moves its high bits when only the last character differs, so `${id}:h` and
// `${id}:a` gave near-identical draws (every Fire match a draw, every other game won by one). Score draws run
// through a murmur3 finalizer so each salt is an independent uniform in [0, 1).
function rnd(id, salt) {
  let h = Math.floor(hashFrac(`${salt}|${id}|${salt}`) * 4294967296)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function poisson(lambda, u, max) {
  let k = 0, p = Math.exp(-lambda), cdf = p
  while (u > cdf && k < max) { k++; p *= lambda / k; cdf += p }
  return k
}
function normal(mean, sd, u1, u2) {
  return mean + sd * Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2)
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)))
// Ties resolved the way the sport resolves them (extra innings / OT / shootout); home wins those ~55%.
function breakTie(h, a, id, by) {
  if (h !== a) return [h, a]
  return rnd(id, 'ot') < 0.55 ? [h + by, a] : [h, a + by]
}
function football(id, side, home) {
  const r = (s) => rnd(id, `${side}${s}`)
  const td = poisson(home ? 2.5 : 2.2, r('td'), 5), fg = poisson(1.6, r('fg'), 4)
  let pts = td * 7 + fg * 3
  if (td && r('2pt') < 0.15) pts += r('2pt') < 0.07 ? 1 : -1 // a missed PAT or a two-point try
  if (r('sf') < 0.04) pts += 2
  return Math.min(42, pts)
}
// (game id, league) → [home score, away score]: deterministic, sport-shaped, home edge ~55%.
export function simScore(id, league) {
  const r = (s) => rnd(id, s)
  switch (league) {
    case 'mlb': return breakTie(poisson(4.7, r('h'), 12), poisson(4.3, r('a'), 12), id, 1)
    case 'nhl': return breakTie(poisson(3.2, r('h'), 8), poisson(2.8, r('a'), 8), id, 1)
    case 'usa.1': return [poisson(1.6, r('h'), 4), poisson(1.15, r('a'), 4)]
    case 'nfl': {
      const [h, a] = [football(id, 'h', true), football(id, 'a', false)]
      return h === a ? breakTie(h, a, id, h >= 39 ? 3 : r('otk') < 0.6 ? 3 : 6) : [h, a]
    }
    case 'nba': case 'wnba': {
      const [mean, sd, lo, hi] = league === 'nba' ? [113, 11, 82, 135] : [82, 9, 62, 108]
      const h = clamp(normal(mean + 1.5, sd, r('h1'), r('h2')), lo, hi), a = clamp(normal(mean - 1.5, sd, r('a1'), r('a2')), lo, hi)
      return h === a ? breakTie(h + 8, a + 8, id, 2 + Math.floor(r('otm') * 7)) : [h, a]
    }
    default: return [poisson(2, r('h'), 9), poisson(2, r('a'), 9)]
  }
}
const within = (md, a, b) => md >= a && md <= b
const weekend = (dow) => dow === 0 || dow === 6
// (month-day, weekday, day-of-year) → [hour, minute] of a home game, or null.
const RULES = {
  cubs: (md, dow, doy) => (within(md, '04-01', '09-27') && dow !== 1 && Math.floor(doy / 3) % 2 === 0 ? (weekend(dow) ? [13, 20] : [19, 5]) : null),
  whitesox: (md, dow, doy) => (within(md, '04-01', '09-27') && dow !== 1 && Math.floor(doy / 3) % 2 === 1 ? (weekend(dow) ? [13, 10] : [18, 40]) : null),
  bears: (md, dow, doy) => (within(md, '09-13', '12-31') && dow === 0 && Math.floor(doy / 7) % 2 === 0 ? [12, 0] : null),
  fire: (md, dow, doy) => (within(md, '03-01', '10-31') && dow === 6 && Math.floor(doy / 7) % 2 === 1 ? [19, 30] : null),
  bulls: (md, dow, doy) => ((md <= '04-12' || md >= '10-20') && doy % 3 === 0 ? [19, 0] : null),
  blackhawks: (md, dow, doy) => ((md <= '04-12' || md >= '10-20') && doy % 3 === 1 ? [19, 30] : null),
  sky: (md, dow, doy) => (within(md, '05-15', '09-15') && (dow === 2 || dow === 5) && Math.floor(doy / 7) % 2 === 0 ? [19, 0] : null),
}

export function simulatedGames(year) {
  const games = []
  let date = `${year}-01-01`
  for (let doy = 0; date.startsWith(`${year}-`); doy++, date = addDays(date, 1)) {
    const md = date.slice(5), dow = weekday(date)
    for (const t of TEAMS) {
      const hm = RULES[t.key](md, dow, doy)
      if (!hm) continue
      const id = `sim-${t.key}-${date}`
      const opp = OPP[t.league][Math.floor(hashFrac(id) * OPP[t.league].length)]
      const [us, them] = simScore(id, t.league)
      games.push({
        id, teams: [t.key], results: { [t.key]: us > them ? 'W' : us < them ? 'L' : 'T' }, sport: t.sport, league: t.league,
        start: new Date(chicagoToUtc(date, hm[0], hm[1])).toISOString(), venue: t.home, venueName: '',
        status: 'STATUS_SCHEDULED', state: 'pre', detail: '',
        home: { abbr: t.abbr, name: t.full, score: us, winner: us > them }, away: { abbr: opp, name: opp, score: them, winner: them > us },
        chicagoHome: true, attendance: null, simulated: true,
      })
    }
  }
  return games
}

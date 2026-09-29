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
const RANGE = { mlb: [0, 9], nfl: [3, 38], nba: [88, 124], wnba: [68, 98], nhl: [0, 6], 'usa.1': [0, 4] }
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
      const [lo, hi] = RANGE[t.league]
      let us = lo + Math.floor(hashFrac(`${id}:h`) * (hi - lo + 1))
      const them = lo + Math.floor(hashFrac(`${id}:a`) * (hi - lo + 1))
      if (us === them && t.sport !== 'soccer') us += 1
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

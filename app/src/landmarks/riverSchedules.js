// app/src/landmarks/riverSchedules.js — the river's two scheduled shows as pure functions of the date (A-5, A-11):
// Art on theMART's projection on the Merchandise Mart's river façade, and the Centennial Fountain's water arc.
import { chicagoClock } from '../lib/chicagoTime.js'

// Art on theMART, 2026 season (artonthemart.com): Thursday to Sunday, one 30-minute program a night; no shows from
// the end of December to early April. Each window is [from month, day], [to month, day], start [hour, minute].
export const ART_ON_THE_MART = {
  days: [4, 5, 6, 0], minutes: 30,
  windows: [
    { from: [4, 9], to: [5, 31], start: [20, 30] },
    { from: [6, 4], to: [9, 6], start: [21, 0] },
    { from: [9, 10], to: [12, 27], start: [19, 30] },
  ],
  source: 'https://artonthemart.com/ (2026 schedule: Thu–Sun, 30 min a night) and https://artonthemart.com/how-it-works/ (556 × 165 ft image, 34 projectors)',
}
// The Nicholas J. Melas Centennial Fountain (MWRD): May 1 – September 30, five minutes at the top of each hour from
// 10 am; the last arc starts at 10 pm (the fountain closes at 11 pm).
export const CENTENNIAL_ARC = {
  season: { from: [5, 1], to: [9, 30] }, firstHour: 10, lastHour: 22, minutes: 5,
  source: 'https://www.mwrd.org/what-we-do/reducing-flooding/chicago-area-waterway-system-caws/centennial-fountain',
}

const md = (m, d) => m * 100 + d
const inSeason = (c, from, to) => { const x = md(c.month, c.day); return x >= md(...from) && x <= md(...to) }

// { on, minute (0 … 30 into the program), program (which of the season's pieces: a slow rotation by date) }
export function artOnTheMart(date) {
  const c = chicagoClock(date), S = ART_ON_THE_MART
  if (!S.days.includes(c.weekday)) return { on: false, reason: 'day' }
  const w = S.windows.find((x) => inSeason(c, x.from, x.to))
  if (!w) return { on: false, reason: 'season' }
  const m = (c.hour - w.start[0]) * 60 + (c.minute - w.start[1]) + c.second / 60
  if (m < 0 || m >= S.minutes) return { on: false, reason: 'hours' }
  return { on: true, minute: m, program: (c.month * 31 + c.day) % 4 }
}

// { on, second (0 … 300 into the arc) }
export function centennialArc(date) {
  const c = chicagoClock(date), S = CENTENNIAL_ARC
  if (!inSeason(c, S.season.from, S.season.to)) return { on: false, reason: 'season' }
  if (c.hour < S.firstHour || c.hour > S.lastHour) return { on: false, reason: 'hours' }
  if (c.minute >= S.minutes) return { on: false, reason: 'between' }
  return { on: true, second: c.minute * 60 + c.second }
}

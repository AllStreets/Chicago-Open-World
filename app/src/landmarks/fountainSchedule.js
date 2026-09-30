// app/src/landmarks/fountainSchedule.js — Buckingham Fountain's real schedule as a pure function of the date.
import { chicagoClock } from '../lib/chicagoTime.js'

export const FOUNTAIN_SCHEDULE = {
  season: { from: [5, 1], to: [10, 15] }, open: 8, close: 23, showMinutes: 20, lastShowHour: 22,
  source: 'https://en.wikipedia.org/wiki/Buckingham_Fountain (Chicago Park District: 8 am–11 pm, early May–mid-October, 20-min shows hourly, last at 10 pm, lights after dusk)',
}
const S = FOUNTAIN_SCHEDULE
const OFF = (reason) => ({ state: 'off', reason, levels: { centre: 0, seahorse: 0, ring: 0, lower: 0 }, colour: null })
const DISPLAY = { centre: 0.3, seahorse: 1, ring: 0.6, lower: 0.6 }
export const SHOW_COLOURS = [[1, 0.35, 0.6], [0.3, 0.6, 1], [0.4, 1, 0.6], [1, 0.8, 0.3], [0.8, 0.4, 1]]

export function showLevels(m) {
  const wave = 0.5 + 0.5 * Math.sin((m * Math.PI * 2) / 1.5)
  if (m < 2) return { centre: 0.3 + 0.35 * (m / 2), seahorse: 1, ring: 0.8, lower: 0.8 }
  if (m < 17) return { centre: 0.45 + 0.3 * wave, seahorse: 1, ring: 0.6 + 0.4 * wave, lower: 0.9 }
  return { centre: 1, seahorse: 1, ring: 1, lower: 1 }
}
export function showColour(m) {
  const x = m / 1.5, i = Math.floor(x) % SHOW_COLOURS.length, j = (i + 1) % SHOW_COLOURS.length, f = x - Math.floor(x)
  return SHOW_COLOURS[i].map((v, k) => v + (SHOW_COLOURS[j][k] - v) * f)
}
const show = (m, dark, reason) => ({ state: 'show', reason, minute: m, levels: showLevels(m), colour: dark ? showColour(m) : null })

export function fountainShow(date, { dark = false, previewStart = null, stoppedAt = null } = {}) {
  if (previewStart != null) {
    const m = (date.getTime() - previewStart) / 60000
    if (m >= 0 && m < S.showMinutes) return show(m, dark, 'preview')
  }
  const c = chicagoClock(date), md = c.month * 100 + c.day
  if (md < S.season.from[0] * 100 + S.season.from[1] || md > S.season.to[0] * 100 + S.season.to[1]) return OFF('season')
  if (c.hour < S.open || c.hour >= S.close) return OFF('hours')
  if (c.hour <= S.lastShowHour && c.minute < S.showMinutes) {
    const m = c.minute + (c.second + date.getMilliseconds() / 1000) / 60 // ms: the music and jets run on this clock
    // someone pressed stop during this show: the plain display until the next one
    if (stoppedAt != null && stoppedAt >= date.getTime() - m * 60000 && stoppedAt <= date.getTime()) return { state: 'display', reason: 'stopped', levels: DISPLAY, colour: null }
    return show(m, dark, 'show')
  }
  return { state: 'display', reason: 'display', levels: DISPLAY, colour: null }
}

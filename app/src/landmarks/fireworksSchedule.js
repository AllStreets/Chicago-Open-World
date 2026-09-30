// app/src/landmarks/fireworksSchedule.js — Navy Pier's summer fireworks as a pure function of the date (user request
// 2026-09-29). Free shows Wednesdays at 9 pm and Saturdays at 10 pm from late May to early September, fired from a
// barge in the lake off the pier's south side (the Grant Park side), out along its outer half.
import { chicagoClock } from '../lib/chicagoTime.js'
import { SHOW_S } from './fireworksChoreo.js'

export const FIREWORKS = {
  season: { from: [5, 23], to: [9, 5] }, starts: { 3: [21, 0], 6: [22, 0] }, // weekday (0 = Sunday) → [hour, minute]
  source: 'https://navypier.org/pier-events/summer-fireworks/ (Wednesdays 9 pm, Saturdays 10 pm, May 23 – Sept 5, 2026; weather permitting)',
}
export const BARGE = [2020, 0, -830] // local metres: ~190 m off the south flank, two-thirds of the way out

export function fireworksShow(date, { previewStart = null, stoppedAt = null } = {}) {
  const now = date.getTime()
  if (previewStart != null) {
    const t = (now - previewStart) / 1000
    if (t >= 0 && t < SHOW_S) return { state: 'show', reason: 'preview', t }
  }
  const c = chicagoClock(date), start = FIREWORKS.starts[c.weekday], md = c.month * 100 + c.day
  const S = FIREWORKS.season
  if (!start || md < S.from[0] * 100 + S.from[1] || md > S.to[0] * 100 + S.to[1]) return { state: 'off' }
  const t = (c.hour - start[0]) * 3600 + (c.minute - start[1]) * 60 + c.second + date.getMilliseconds() / 1000
  if (t < 0 || t >= SHOW_S) return { state: 'off' }
  if (stoppedAt != null && stoppedAt >= now - t * 1000 && stoppedAt <= now) return { state: 'off', reason: 'stopped' }
  return { state: 'show', reason: 'show', t }
}

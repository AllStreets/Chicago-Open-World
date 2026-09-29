// app/src/sports/crowd.js — who is in the stands: shirts, how full, when drawn.
import { teamByKey } from '../../../shared/teams.js'

export function rng(seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const NEUTRALS = [['#F2F2F0', 0.1], ['#8B8D90', 0.06], ['#1E1F22', 0.05], ['#3D5A80', 0.05]]
export function shirtColors(n, home, away, seed = 1) {
  const table = [[home[0], 0.42], [home[1], 0.18], [away?.[0] ?? '#8B8D90', 0.1], [away?.[1] ?? '#F2F2F0', 0.04], ...NEUTRALS]
  const r = rng(seed), out = new Array(n)
  for (let i = 0; i < n; i++) { let x = r(), k = 0; while (k < table.length - 1 && x >= table[k][1]) { x -= table[k][1]; k++ } out[i] = table[k][0] }
  return out
}
export const DENSITY = { idle: 0, pregame: 0.35, live: 0.92, postgame: 0.3 }
export function crowdDensity(state, game, capacity) {
  if (state === 'live' && game?.attendance && capacity) return Math.min(1, Math.max(0.3, game.attendance / capacity))
  return DENSITY[state] ?? 0
}
export const PLAZA_DENSITY = { idle: 0, pregame: 0.8, live: 0.08, postgame: 0.9 }
export const plazaDensity = (state) => PLAZA_DENSITY[state] ?? 0
export const LIFE_RANGE_M = 1500
export function lifeVisible(cam, center, quality, range = LIFE_RANGE_M) {
  if (quality === 'LOW') return false
  return Math.hypot(cam[0] - center[0], cam[2] - center[1]) <= range
}
export const shownCount = (total, density) => Math.max(0, Math.min(total, Math.floor(total * density)))
export function flagMask(n, share = 0.25, seed = 7) { const r = rng(seed), m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = r() < share ? 1 : 0; return m }
export function homeTeamFor(venue, st) {
  const k = st?.game?.teams?.find((t) => venue.teams.includes(t)) ?? st?.next?.teams?.find((t) => venue.teams.includes(t)) ?? venue.teams[0]
  return teamByKey(k)
}
// After a Cubs win the whole day is a celebration at Wrigley: W flags in the stands and fans on the field.
export function celebration(venueKey, st) {
  return venueKey === 'wrigleyfield' && st?.winDay ? { wave: 1, fans: 160, minDensity: 0.15 } : { wave: 0, fans: 0, minDensity: 0 }
}

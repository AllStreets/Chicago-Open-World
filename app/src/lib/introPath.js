// app/src/lib/introPath.js — the cinematic push-in from Lake Michigan at load.
import { BOOKMARKS } from './bookmarks.js'

export const INTRO_SECONDS = 7
const P = [[5200, 900, 600], [3400, 620, -700], BOOKMARKS.streeterville.position]
const T = [[0, 120, -300], [250, 90, -350], BOOKMARKS.streeterville.target]
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const bez = (pts, t) => pts[0].map((_, i) => (1 - t) ** 2 * pts[0][i] + 2 * (1 - t) * t * pts[1][i] + t ** 2 * pts[2][i])

export function introPose(t) {
  const k = ease(Math.min(1, Math.max(0, t)))
  return { position: bez(P, k), target: bez(T, k) }
}

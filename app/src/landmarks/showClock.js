// app/src/landmarks/showClock.js — where the city's two shows are, and how far into their music we are.
import { LIFT_DEMO } from '../bridges/lift.js'

// Seconds into the bridge music of a manual lift; null once it is lowering (the music fades) or when idle.
export const liftShowTime = (lift, now) => (lift && !lift.stoppedAt ? (now - lift.startedAt) / 1000 : null)

// The two pairs of red gate lights, at both approaches, either side of the roadway (3 m up on their posts).
export function gatePoints(b) {
  const [ux, uz] = b.axis, [lx, lz] = [uz, -ux], d = b.span / 2 + 8
  const out = []
  for (const s of [-1, 1]) for (const o of [-1, 1]) out.push([b.centre[0] + ux * d * s + lx * 7 * o, 3, b.centre[1] + uz * d * s + lz * 7 * o])
  return out
}
// The i-th bridge in the lift order warns 8 s before its leaves start, and keeps flashing while they are up.
export const gateActive = (i, elapsedS, angle, T = LIFT_DEMO) => angle > 0.001 || (elapsedS >= i * T.staggerS - 8 && elapsedS < i * T.staggerS + 1)

// The music comes from the raised bridge nearest the camera.
export function nearestMoving(bridges, angles, cam) {
  let best = null, bd = Infinity
  for (const b of bridges) {
    if (!(angles[b.key] > 0)) continue
    const d = Math.hypot(b.centre[0] - cam[0], b.centre[1] - cam[1])
    if (d < bd) { bd = d; best = [b.centre[0], 8, b.centre[1]] }
  }
  return best
}

// How far the fountain's music carries: a show someone started, across downtown; the hourly scheduled show, only
// near the fountain itself (as in life) — otherwise the music would play for 20 minutes of every hour.
export const fountainMusicRange = (reason) => (reason === 'preview' ? 2500 : 450)

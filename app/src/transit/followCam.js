// app/src/transit/followCam.js — ride along with a train (C15): chase or side view, never inside a building
// (V1 clearance: roof + 25 m) and never underground (a subway train is followed along the surface).
import { clearanceAt } from '../lib/clearance.js'

export const FOLLOW = { chase: { back: 38, up: 14, ahead: 70, side: 0 }, side: { back: -4, up: 5, ahead: 0, side: 26 } }

const MAX_PITCH_DEG = 45
const PULL_BACK_M = [38, 80, 140, 220, 320]

// One candidate camera placement: `side` metres to the right of the track, `back` metres behind the head.
function place(head, f, r, ground, v, side, back, clearance) {
  const px = head[0] - f[0] * back + r[0] * side, pz = head[2] - f[1] * back + r[1] * side
  const floor = ground + v.up, c = clearance(px, pz)
  return { position: [px, Math.max(floor, c), pz], blocked: c > Math.max(floor, 25) + 5 } // 25 m: the no-data clearance
}

// `len` is the train's length: the chase sits behind its last car; the side view frames the leading car.
export function followPose(head, dir, view = 'chase', clearance = clearanceAt, len = 0) {
  const v = FOLLOW[view] ?? FOLLOW.chase, l = Math.hypot(dir[0], dir[2]) || 1, f = [dir[0] / l, dir[2] / l], r = [-f[1], f[0]]
  const ground = Math.max(head[1], 0)
  const target = (ahead) => [head[0] + f[0] * ahead, ground + 2, head[2] + f[1] * ahead]
  // In the Loop's canyons the preferred spot is often over a roof: try the other side, then a chase from behind.
  const ch = FOLLOW.chase
  const tries = view === 'side'
    ? [[v, v.side, v.back, v.ahead], [v, -v.side, v.back, v.ahead], [ch, 0, ch.back + len, ch.ahead]]
    : [[v, v.side, v.back + len, v.ahead]]
  for (const [vv, side, back, ahead] of tries) {
    const c = place(head, f, r, ground, vv, side, back, clearance)
    if (!c.blocked) return { position: c.position, target: target(ahead) }
  }
  // Everything is roofs: rise above them but pull back along the track so the train stays in view, not straight below.
  const t = target(ch.ahead)
  let c
  for (const back of PULL_BACK_M) {
    c = place(head, f, r, ground, ch, 0, back + len, clearance)
    const pitch = Math.atan2(c.position[1] - t[1], back + len + ch.ahead) * 180 / Math.PI
    if (pitch <= MAX_PITCH_DEG) break
  }
  return { position: c.position, target: t }
}

export function followStep(follow, trains, clearance = clearanceAt) {
  const t = trains.find((x) => x.id === follow.trainId)
  if (!t) return { ended: 'left' }
  const len = (t.cars ?? []).reduce((a, c) => a + (c?.length ?? 0), 0)
  return { pose: followPose(t.head.p, t.head.dir, follow.view, clearance, len), train: t }
}

const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'])
export const shouldExitFollow = (e) => !MODIFIERS.has(e.key)

// app/src/transit/followCam.js — ride along with a train (C15): chase or side view, never inside a building
// (V1 clearance: roof + 25 m). A subway train is followed down into its tube (user, 2026-09-30) when the tunnels are
// drawn: the camera stays inside the tube's walls, floor and ceiling; without them it rides along the surface.
import { clearanceAt } from '../lib/clearance.js'
import { activeTunnelRoom, TUNNEL } from './tunnels.js'

export const FOLLOW = { chase: { back: 38, up: 14, ahead: 70, side: 0 }, side: { back: -4, up: 5, ahead: 0, side: 26 } }

// in a tube: just behind the last car at window height, or beside the leading car looking back along its flank
export const FOLLOW_UNDER = { chase: { back: [10, 6, 3], up: 2.3, ahead: 30 }, side: { lat: [3.4, -3.4, 2.1, -2.1], ahead: 7, up: 1.9, look: 14 } }
export const UNDER_Y = TUNNEL.mouthY + 1 // rail top below this: the train is in its tube

// `tail` (the last car's rear and heading) keeps the chase in the tube on curves, where "behind the head" is a wall
function underPose(head, f, r, view, room, len, tail) {
  const U = FOLLOW_UNDER, from = (o, g, along, lat, up) => [o[0] + g[0] * along - g[1] * lat, o[1] + up, o[2] + g[1] * along + g[0] * lat]
  if (view === 'side') {
    const target = from(head, f, -U.side.look, 0, 1.4)
    for (const lat of U.side.lat) { const p = from(head, f, U.side.ahead, lat, U.side.up); if (room(...p)) return { position: p, target, underground: true } }
  }
  const [o, g, extra] = tail ? [tail.p, tail.f, 0] : [head, f, len]
  let p = null
  for (const back of U.chase.back) { p = from(o, g, -(back + extra), 0, U.chase.up); if (room(...p)) break }
  return { position: p, target: from(o, g, U.chase.ahead + (tail ? 0 : len), 0, 1.5), underground: true }
}

const MAX_PITCH_DEG = 45
const PULL_BACK_M = [38, 80, 140, 220, 320]

// One candidate camera placement: `side` metres to the right of the track, `back` metres behind the head.
function place(head, f, r, ground, v, side, back, clearance) {
  const px = head[0] - f[0] * back + r[0] * side, pz = head[2] - f[1] * back + r[1] * side
  const floor = ground + v.up, c = clearance(px, pz)
  return { position: [px, Math.max(floor, c), pz], blocked: c > Math.max(floor, 25) + 5 } // 25 m: the no-data clearance
}

// `len` is the train's length: the chase sits behind its last car; the side view frames the leading car.
export function followPose(head, dir, view = 'chase', clearance = clearanceAt, len = 0, room = null, tail = null) {
  const v = FOLLOW[view] ?? FOLLOW.chase, l = Math.hypot(dir[0], dir[2]) || 1, f = [dir[0] / l, dir[2] / l], r = [-f[1], f[0]]
  if (room && head[1] < UNDER_Y) return underPose(head, f, r, view, room, len, tail)
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

// `lookup` resolves a train missing from the last published frame (it may not have been drawn yet) before giving up.
// P5: a live/simulated source switch renames every CTA train; `follow.last` ({ line, p }) lets the follow carry on
// with the nearest train of the same line within 1.5 km instead of ending.
const SWITCH_M = 1500
function sameLineNear(last, trains) {
  let best = null, bestD = SWITCH_M
  for (const x of trains) {
    if (x.line !== last.line || !x.head) continue
    const d = Math.hypot(x.head.p[0] - last.p[0], x.head.p[2] - last.p[2])
    if (d < bestD) { best = x; bestD = d }
  }
  return best
}

export function followStep(follow, trains, clearance = clearanceAt, lookup = null, room = activeTunnelRoom()) {
  let t = trains.find((x) => x.id === follow.trainId) ?? lookup?.(follow.trainId) ?? null, retarget
  if (!t && follow.last) { t = sameLineNear(follow.last, trains); retarget = t?.id }
  if (!t) return { ended: 'left' }
  const len = (t.cars ?? []).reduce((a, c) => a + (c?.length ?? 0), 0)
  // the rear of the last car, heading the way the train runs (cars may be turned round, so not from their yaw)
  const cars = (t.cars ?? []).filter(Boolean), last = cars.at(-1), prev = cars.at(-2)
  const tail = last?.pos && prev?.pos ? (() => {
    const dx = prev.pos[0] - last.pos[0], dz = prev.pos[2] - last.pos[2], l = Math.hypot(dx, dz) || 1, g = [dx / l, dz / l], h = (last.length ?? 0) / 2
    return { p: [last.pos[0] - g[0] * h, last.pos[1], last.pos[2] - g[1] * h], f: g }
  })() : null
  return { pose: followPose(t.head.p, t.head.dir, follow.view, clearance, len, room, tail), train: t, ...(retarget ? { retarget } : {}) }
}

const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'])
// Tab, and Enter/Space on a focused button, are someone using the HUD by keyboard — not taking the camera back.
const HUD_KEYS = new Set(['Enter', ' ', 'Spacebar'])
export const shouldExitFollow = (e) => {
  if (MODIFIERS.has(e.key) || e.key === 'Tab') return false
  const tag = e.target?.tagName
  return !(HUD_KEYS.has(e.key) && (tag === 'BUTTON' || tag === 'A' || e.target?.getAttribute?.('role') === 'button'))
}

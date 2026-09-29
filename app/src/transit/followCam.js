// app/src/transit/followCam.js — ride along with a train (C15): chase or side view, never inside a building
// (V1 clearance: roof + 25 m) and never underground (a subway train is followed along the surface).
import { clearanceAt } from '../lib/clearance.js'

export const FOLLOW = { chase: { back: 38, up: 14, ahead: 70, side: 0 }, side: { back: -4, up: 5, ahead: 0, side: 26 } }

export function followPose(head, dir, view = 'chase', clearance = clearanceAt) {
  const v = FOLLOW[view] ?? FOLLOW.chase, l = Math.hypot(dir[0], dir[2]) || 1, f = [dir[0] / l, dir[2] / l], r = [-f[1], f[0]]
  const ground = Math.max(head[1], 0)
  const px = head[0] - f[0] * v.back + r[0] * v.side, pz = head[2] - f[1] * v.back + r[1] * v.side
  return {
    position: [px, Math.max(ground + v.up, clearance(px, pz)), pz],
    target: [head[0] + f[0] * v.ahead, ground + 2, head[2] + f[1] * v.ahead],
  }
}

export function followStep(follow, trains, clearance = clearanceAt) {
  const t = trains.find((x) => x.id === follow.trainId)
  if (!t) return { ended: 'left' }
  return { pose: followPose(t.head.p, t.head.dir, follow.view, clearance), train: t }
}

const MODIFIERS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'])
export const shouldExitFollow = (e) => !MODIFIERS.has(e.key)

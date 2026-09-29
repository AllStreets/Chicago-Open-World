// app/src/bridges/lights.js — colours and positions of the river bridges' lanterns and navigation lights.
import { rotateAboutAxis } from './lift.js'
const OPEN = (60 * Math.PI) / 180
export function lightColour(kind, angle = 0) {
  if (kind === 'lantern') return [1.0, 0.83, 0.6]
  if (kind === 'nav' && angle > OPEN) return [0.2, 1.0, 0.45]
  return [1.0, 0.12, 0.08]
}
export function lightPosition(light, leaves, angles) {
  if (light.leaf == null) return light.p
  const l = leaves[light.leaf], a = angles[l.bridge] ?? 0
  return a ? rotateAboutAxis(light.p, l.pivot, l.k, a) : light.p
}

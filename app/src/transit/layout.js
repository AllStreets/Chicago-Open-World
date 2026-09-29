// app/src/transit/layout.js — which instanced mesh draws each car this frame (its model near, a box far away)
// and where the night lights go. Pure, so the draw-call budget and LOD are testable.
export const MODELS = ['cta5000', 'cta7000', 'metraCoach', 'metraLoco']
export const TRAIN_MESHES = [...MODELS, 'impostor', 'lights']
export const SHADOW_CASTERS = ['cta5000', 'cta7000'] // Metra stock skips the shadow pass (budget B.1.6)
export const MAX_TRAIN_CALLS = 8
export const LOD_M = { LOW: 250, HIGH: 600, ULTRA: 900 }
export const SPILL_AHEAD_M = 9

export function layoutCars(trains, cam, { lod = LOD_M.HIGH, hidden = [], colours = {} } = {}) {
  const out = { cta5000: [], cta7000: [], metraCoach: [], metraLoco: [], impostor: [], lights: [], hits: [] }
  for (const t of trains) {
    if (hidden.includes(t.line)) continue
    const colour = colours[t.line] ?? [1, 1, 1]
    for (const c of t.cars) {
      if (!c) continue
      const far = Math.hypot(c.pos[0] - cam[0], c.pos[1] - cam[1], c.pos[2] - cam[2]) > lod
      const item = { ...c, colour, trainId: t.id }
      out[far ? 'impostor' : c.model].push(item)
      out.hits.push(item)
      if (c.lead === 1 && !far) { // the leading cab: a headlight flare at the nose, a warm spill on the track ahead
        const f = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)], nose = [c.pos[0] + (f[0] * c.length) / 2, c.pos[1] + 1.35, c.pos[2] + (f[2] * c.length) / 2]
        out.lights.push({ mode: 0, pos: nose, yaw: c.yaw, size: 1.6 })
        out.lights.push({ mode: 1, pos: [nose[0] + f[0] * SPILL_AHEAD_M, c.pos[1] + 0.05, nose[2] + f[2] * SPILL_AHEAD_M], yaw: c.yaw, size: 7 })
      }
    }
  }
  return out
}

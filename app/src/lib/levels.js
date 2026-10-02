// app/src/lib/levels.js — the world's vertical levels (D1-8). The manifest says whether the river is at its real depth
// (`levels.river`: its y, the Riverwalk's, and a side file with the river corridor); a manifest without `levels` is
// today's flat world, and everything here then returns exactly what the app did before. Never a hard-coded RIVER_Y.
import { WATER_PLANE_Y } from '../world/materials/waterSurface.js'

export const FLAT = Object.freeze({ river: null, lake: null })

// manifest → { river: { y, riverwalk, file } | null, lake: { y } | null } (D5: `levels.lake` is the lake at its real level)
export function readLevels(manifest) {
  const r = manifest?.levels?.river, l = manifest?.levels?.lake
  const lake = l && Number.isFinite(l.y) ? { y: l.y } : null
  if (!r || !Number.isFinite(r.y)) return lake ? { river: null, lake } : FLAT
  return { river: { y: r.y, riverwalk: Number.isFinite(r.riverwalk) ? r.riverwalk : null, file: typeof r.file === 'string' ? r.file : null }, lake }
}

// D2: the multi-level streets (Lower Wacker, Lower Michigan …) — `levels.lower` names their centreline file and the two
// lower levels' ys. Absent (an older world, or LEVELS_LOWER=0) = nothing is drawn under the street and U is unavailable.
export function readLowerLevels(manifest) {
  const l = manifest?.levels?.lower
  if (!l || typeof l.file !== 'string' || !Number.isFinite(l.y)) return null
  return { file: l.file, y: l.y, y2: Number.isFinite(l.y2) ? l.y2 : null }
}

// the river-corridor mask (pipeline riverLevel.js corridorMask): row runs of 40 m cells near the sunken river
export function inCorridor(mask, x, z) {
  if (!mask?.runs) return false
  const i = Math.floor((x - mask.x0) / mask.cell), j = Math.floor((z - mask.z0) / mask.cell)
  const r = mask.runs
  // runs are sorted by row: binary-search the first run of row j
  let lo = 0, hi = r.length / 3
  while (lo < hi) { const m = (lo + hi) >> 1; if (r[m * 3] < j) lo = m + 1; else hi = m }
  for (let k = lo * 3; k < r.length && r[k] === j; k += 3) if (i >= r[k + 1] && i <= r[k + 2]) return true
  return false
}

// D1-6: the mirror plane follows the view — the river's surface while the view's target is over the river corridor,
// the lake's everywhere else: its real level when the manifest has one (D5), else WATER_PLANE_Y (the flat world's plane).
export const lakePlaneY = (levels) => (Number.isFinite(levels?.lake?.y) ? levels.lake.y + 0.01 : WATER_PLANE_Y)
export function planeYFor(target, levels, corridor) {
  const lake = lakePlaneY(levels)
  if (!levels?.river || !target || !corridor) return lake
  return inCorridor(corridor, target[0], target[2]) ? levels.river.y + 0.01 : lake
}

// where the view looks: the ground point under the screen's centre (the camera's own spot when it looks up)
export function viewTarget(position, direction, groundY = 0) {
  if (direction[1] < -0.02) {
    const t = (groundY - position[1]) / direction[1]
    if (t > 0 && t < 20000) return [position[0] + direction[0] * t, groundY, position[2] + direction[2] * t]
  }
  return [position[0], groundY, position[2]]
}

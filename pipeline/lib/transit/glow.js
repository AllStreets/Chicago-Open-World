// pipeline/lib/transit/glow.js — the line-colour glow: one ribbon per line per track, expanded towards the camera
// in the vertex shader (app/src/transit/transitMaterials.js). NORMAL carries the track tangent.
export const GLOW_LIFT_M = 0.45 // above rail top: clear of the rails, below a passing train's floor
export const GHOST_BELOW_Y = -1

export const createGlow = () => ({ positions: [], normals: [], colors: [], side: [], lane: [], lanes: [], line: [], intensity: [], ghost: [] })

function tangents(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1
    return [d[0] / l, d[1] / l, d[2] / l]
  })
}

export function glowPiece(g, pts, { lines, colours, lineIndex, intensity }) {
  if (pts.length < 2 || !lines.length) return
  const T = tangents(pts), k = lines.length
  const vert = (i, side, j) => {
    const p = pts[i]
    g.positions.push(p[0], p[1] + GLOW_LIFT_M, p[2]); g.normals.push(...T[i]); g.colors.push(...colours[j])
    g.side.push(side); g.lane.push(j - (k - 1) / 2); g.lanes.push(k); g.line.push(lineIndex[j]); g.intensity.push(intensity[j])
    g.ghost.push(p[1] < GHOST_BELOW_Y ? 1 : 0)
  }
  for (let j = 0; j < k; j++) for (let i = 0; i < pts.length - 1; i++) {
    for (const [a, s] of [[i, -1], [i, 1], [i + 1, 1], [i, -1], [i + 1, 1], [i + 1, -1]]) vert(a, s, j)
  }
}

const F = (a) => new Float32Array(a)
export const toGlowLayer = (g) => ({
  positions: g.positions, normals: g.normals, colors: g.colors,
  extra: { SIDE: F(g.side), LANE: F(g.lane), LANES: F(g.lanes), LINE: F(g.line), INTENSITY: F(g.intensity), GHOST: F(g.ghost) },
})

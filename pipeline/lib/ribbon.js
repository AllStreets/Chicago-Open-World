// pipeline/lib/ribbon.js — polyline → flat mitered ribbon (non-indexed tris, facing up).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return l ? [v[0] / l, v[1] / l] : [NaN, NaN] }

// Direction a → b, or null when either point is missing or they coincide.
const dir = (a, b) => (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-3 ? norm(sub(b, a)) : null)

export function bufferPolyline(points, hw, y = 0, ends = {}) {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-3)
  const out = { positions: [], normals: [], uvs: [] }
  if (pts.length < 2) return out
  const L = [], R = [], along = [0]
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const d0 = i > 0 ? norm(sub(pts[i], prev)) : dir(ends.before, pts[0]) ?? norm(sub(next, pts[i]))
    const d1 = i < pts.length - 1 ? norm(sub(next, pts[i])) : dir(pts[i], ends.after) ?? d0
    let t = norm([d0[0] + d1[0], d0[1] + d1[1]])
    if (!Number.isFinite(t[0]) || Math.hypot(...t) < 1e-6) t = d1
    const n = [-t[1], t[0]] // perpendicular to the averaged tangent
    const cos = Math.abs(n[0] * -d1[1] + n[1] * d1[0])
    const m = Math.min(2, 1 / Math.max(0.5, cos))
    L.push([pts[i][0] + n[0] * hw * m, pts[i][1] + n[1] * hw * m])
    R.push([pts[i][0] - n[0] * hw * m, pts[i][1] - n[1] * hw * m])
    if (i > 0) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const push = (p, u, v) => { out.positions.push(p[0], y, p[1]); out.normals.push(0, 1, 0); out.uvs.push(u, v) }
  const tri = (a, ua, va, b, ub, vb, c, uc, vc) => {
    const cy = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
    if (cy >= 0) { push(a, ua, va); push(b, ub, vb); push(c, uc, vc) } else { push(a, ua, va); push(c, uc, vc); push(b, ub, vb) }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    tri(L[i], along[i], hw, R[i], along[i], -hw, L[i + 1], along[i + 1], hw)
    tri(R[i], along[i], -hw, R[i + 1], along[i + 1], -hw, L[i + 1], along[i + 1], hw)
  }
  return out
}

// pipeline/lib/transit/polyline.js — arc length, projection, resampling and simplification on track polylines.
export const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

export function cumulative(pts) {
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + segLen(pts[i - 1], pts[i]))
  return s
}

export function projectOnPolyline(pts, p) {
  const cum = cumulative(pts)
  let best = { d: Infinity, s: 0, i: 0, t: 0, pt: pts[0] }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0
    const q = [a[0] + dx * t, a[1] + dz * t], d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < best.d) best = { d, s: cum[i] + t * Math.sqrt(L2), i, t, pt: q }
  }
  return best
}

export function resample(pts, segTags, maxSeg) {
  const out = [pts[0]], tags = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(segLen(a, b) / maxSeg))
    for (let k = 1; k <= n; k++) { out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); tags.push(segTags[i]) }
  }
  return { pts: out, tags }
}

// deviation of p from chord a→b: the larger of the plan offset and the height error (ramps must survive)
function perp3(p, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2)) : 0
  return Math.max(Math.hypot(p[0] - (a[0] + dx * t), p[2] - (a[2] + dz * t)), Math.abs(p[1] - (a[1] + (b[1] - a[1]) * t)))
}
export function simplifyLine3(pts, tol) {
  if (pts.length < 3) return pts
  let maxD = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) { const d = perp3(pts[i], pts[0], pts.at(-1)); if (d > maxD) { maxD = d; idx = i } }
  if (maxD <= tol) return [pts[0], pts.at(-1)]
  return [...simplifyLine3(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplifyLine3(pts.slice(idx), tol)]
}

export function runsWhere(pts, pred) {
  const out = []
  let cur = []
  for (const p of pts) {
    if (pred(p)) cur.push(p)
    else { if (cur.length >= 2) out.push(cur); cur = [] }
  }
  if (cur.length >= 2) out.push(cur)
  return out
}

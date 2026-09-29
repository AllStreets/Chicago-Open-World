// app/src/transit/path.js — a service's track as arc length → position and direction.
export function makePath(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]))
  return { pts, cum, length: cum.at(-1) }
}

export function pointAt(path, s) {
  const { pts, cum } = path, x = Math.min(Math.max(s, 0), path.length)
  let lo = 0, hi = cum.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= x) lo = mid; else hi = mid }
  const a = pts[lo], b = pts[hi], seg = cum[hi] - cum[lo], f = seg ? (x - cum[lo]) / seg : 0
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1
  return { p: [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f], dir: [d[0] / l, d[1] / l, d[2] / l] }
}

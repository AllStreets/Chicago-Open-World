// pipeline/lib/transit/meshkit.js — a tiny triangle-soup builder for track structure, stations and rolling stock.
// Every vertex carries position, normal, linear RGB colour, a material kind and along-track metres.
export const KIND = { steel: 0, concrete: 1, ballast: 2, rail: 3, accent: 4, roof: 5, sign: 6, glass: 7, dark: 8, stainless: 9, door: 10, headlight: 11, tail: 12, livery: 13 }

export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

export const createMesh = () => ({ positions: [], normals: [], colors: [], kind: [], along: [] })
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const unit3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const neg = (v) => [-v[0], -v[1], -v[2]]

export function tri(m, a, b, c, n, col, kind, al = [0, 0, 0]) {
  if (dot(cross3(sub(b, a), sub(c, a)), n) < 0) { [b, c] = [c, b]; al = [al[0], al[2], al[1]] }
  for (const [p, s] of [[a, al[0]], [b, al[1]], [c, al[2]]]) {
    m.positions.push(p[0], p[1], p[2]); m.normals.push(n[0], n[1], n[2]); m.colors.push(col[0], col[1], col[2]); m.kind.push(kind); m.along.push(s)
  }
}
export function quad(m, a, b, c, d, n, col, kind, al = [0, 0, 0, 0]) {
  tri(m, a, b, c, n, col, kind, [al[0], al[1], al[2]])
  tri(m, a, c, d, n, col, kind, [al[0], al[2], al[3]])
}

export const BOX_FACES = ['top', 'bottom', 'front', 'back', 'left', 'right']
export function box(m, c, ax, ay, az, h, col, kind, faces = BOX_FACES) {
  const P = (sx, sy, sz) => [0, 1, 2].map((k) => c[k] + ax[k] * sx * h[0] + ay[k] * sy * h[1] + az[k] * sz * h[2])
  const F = {
    top: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], ay],
    bottom: [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1], neg(ay)],
    front: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1], ax],
    back: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1], neg(ax)],
    left: [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1], az],
    right: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], neg(az)],
  }
  for (const f of faces) { const [a, b, cc, d, n] = F[f]; quad(m, P(...a), P(...b), P(...cc), P(...d), n, col, kind) }
}

const unit2 = (v) => { const l = Math.hypot(v[0], v[1]); return l ? [v[0] / l, v[1] / l] : [NaN, NaN] }
export function frames(pts) {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const d0 = i > 0 ? unit2([p[0] - prev[0], p[2] - prev[2]]) : unit2([next[0] - p[0], next[2] - p[2]])
    const d1 = i < pts.length - 1 ? unit2([next[0] - p[0], next[2] - p[2]]) : d0
    let t = unit2([d0[0] + d1[0], d0[1] + d1[1]])
    if (!Number.isFinite(t[0])) t = Number.isFinite(d1[0]) ? d1 : [1, 0]
    const s = [-t[1], t[0]]
    const cos = Math.abs(s[0] * -d1[1] + s[1] * d1[0])
    return { t, s, miter: Number.isFinite(cos) ? Math.min(2, 1 / Math.max(0.5, cos)) : 1 }
  })
}

export function cumulative3(pts) {
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]))
  return s
}

export function sweep(m, pts, profile, col, kind, { closed = true } = {}) {
  const F = frames(pts), S = cumulative3(pts)
  const ring = (i) => profile.map(([u, v]) => [pts[i][0] + F[i].s[0] * u * F[i].miter, pts[i][1] + v, pts[i][2] + F[i].s[1] * u * F[i].miter])
  const edges = closed ? profile.length : profile.length - 1
  let prev = ring(0)
  for (let i = 1; i < pts.length; i++) {
    const cur = ring(i)
    const t = unit2([pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]])
    if (!Number.isFinite(t[0])) { prev = cur; continue }
    const side = [-t[1], t[0]]
    for (let k = 0; k < edges; k++) {
      const k2 = (k + 1) % profile.length, [u0, v0] = profile[k], [u1, v1] = profile[k2]
      const nu = v1 - v0, nv = -(u1 - u0), L = Math.hypot(nu, nv) || 1 // outward for a counter-clockwise profile
      const n = [(side[0] * nu) / L, nv / L, (side[1] * nu) / L]
      quad(m, prev[k], prev[k2], cur[k2], cur[k], n, col, kind, [S[i - 1], S[i - 1], S[i], S[i]])
    }
    prev = cur
  }
}

export function wall(m, pts, { u, thick, bottom, top }, col, kind) {
  const F = frames(pts)
  const at = (i, du, y) => [pts[i][0] + F[i].s[0] * (u + du) * F[i].miter, y, pts[i][2] + F[i].s[1] * (u + du) * F[i].miter]
  for (let i = 0; i < pts.length - 1; i++) {
    const j = i + 1, t = unit2([pts[j][0] - pts[i][0], pts[j][2] - pts[i][2]])
    if (!Number.isFinite(t[0])) continue
    const n = [-t[1], 0, t[0]]
    const b0 = bottom(pts[i]), b1 = bottom(pts[j]), t0 = top(pts[i]), t1 = top(pts[j])
    if (t0 - b0 < 0.05 && t1 - b1 < 0.05) continue
    for (const e of [-1, 1]) quad(m, at(i, (e * thick) / 2, b0), at(j, (e * thick) / 2, b1), at(j, (e * thick) / 2, t1), at(i, (e * thick) / 2, t0), [n[0] * e, 0, n[2] * e], col, kind)
    quad(m, at(i, -thick / 2, t0), at(j, -thick / 2, t1), at(j, thick / 2, t1), at(i, thick / 2, t0), [0, 1, 0], col, kind)
  }
}

export function chunksOf(pts, len) {
  const out = []
  let cur = [pts[0]], acc = 0
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1]
    const b = pts[i]
    let seg = Math.hypot(b[0] - a[0], b[2] - a[2])
    while (seg > 0 && acc + seg >= len) {
      const f = (len - acc) / seg, p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
      cur.push(p); out.push(cur); cur = [p]; seg -= len - acc; acc = 0; a = p
    }
    if (seg > 0) { cur.push(b); acc += seg }
  }
  if (cur.length >= 2) out.push(cur)
  return out
}

export const toLayer = (m) => ({ positions: m.positions, normals: m.normals, colors: m.colors, extra: { KIND: new Float32Array(m.kind), ALONG: new Float32Array(m.along) } })
export const triCount = (m) => m.positions.length / 9

// ── rolling-stock primitives (V4) ─────────────────────────────────────────────
export function cylinder(m, c, axis, r, halfLen, seg, col, kind, caps = true) {
  const A = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
  const U = axis === 'y' ? [1, 0, 0] : [0, 1, 0], V = cross3(A, U)
  const at = (k, h) => { const a = (k / seg) * Math.PI * 2; return [0, 1, 2].map((i) => c[i] + A[i] * h + (U[i] * Math.cos(a) + V[i] * Math.sin(a)) * r) }
  const top = [0, 1, 2].map((i) => c[i] + A[i] * halfLen), bot = [0, 1, 2].map((i) => c[i] - A[i] * halfLen), nA = A.map((v) => -v)
  for (let k = 0; k < seg; k++) {
    const mid = ((k + 0.5) / seg) * Math.PI * 2, n = [0, 1, 2].map((i) => U[i] * Math.cos(mid) + V[i] * Math.sin(mid))
    quad(m, at(k, -halfLen), at(k + 1, -halfLen), at(k + 1, halfLen), at(k, halfLen), n, col, kind)
    if (caps) { tri(m, top, at(k, halfLen), at(k + 1, halfLen), A, col, kind); tri(m, bot, at(k + 1, -halfLen), at(k, -halfLen), nA, col, kind) }
  }
}

export function extrudeX(m, profile, x0, x1, col, kind, { caps = [true, true] } = {}) {
  const cz = profile.reduce((a, p) => a + p[0], 0) / profile.length, cy = profile.reduce((a, p) => a + p[1], 0) / profile.length
  profile.forEach(([z0, y0], k) => {
    const [z1, y1] = profile[(k + 1) % profile.length]
    let n = unit3([0, z1 - z0, -(y1 - y0)])
    if (n[1] * ((y0 + y1) / 2 - cy) + n[2] * ((z0 + z1) / 2 - cz) < 0) n = n.map((v) => -v)
    quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], n, col, kind)
    if (caps[0]) tri(m, [x0, cy, cz], [x0, y0, z0], [x0, y1, z1], [-1, 0, 0], col, kind)
    if (caps[1]) tri(m, [x1, cy, cz], [x1, y0, z0], [x1, y1, z1], [1, 0, 0], col, kind)
  })
}

const facing = (n, mid, from) => (n[0] * (mid[0] - from[0]) + n[1] * (mid[1] - from[1]) + n[2] * (mid[2] - from[2]) < 0 ? n.map((v) => -v) : n)
export function quadFacing(m, a, b, c, d, from, col, kind) {
  const n = unit3(cross3([c[0] - a[0], c[1] - a[1], c[2] - a[2]], [d[0] - b[0], d[1] - b[1], d[2] - b[2]]))
  const mid = [0, 1, 2].map((i) => (a[i] + b[i] + c[i] + d[i]) / 4)
  quad(m, a, b, c, d, facing(n, mid, from), col, kind)
}
export function triFacing(m, a, b, c, from, col, kind) {
  const n = unit3(cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]))
  tri(m, a, b, c, facing(n, [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3), from), col, kind)
}

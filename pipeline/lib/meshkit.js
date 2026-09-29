// pipeline/lib/meshkit.js — the small mesh kit every procedural landmark and bridge builder shares.
// Meshes are raw, non-indexed { positions, normals, uvs } in world metres (+x east, −z north, +y up).
export const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]]
export const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]]
export const mul2 = (a, s) => [a[0] * s, a[1] * s]
export const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1]
export const len2 = (a) => Math.hypot(a[0], a[1])
export const norm2 = (a) => mul2(a, 1 / (len2(a) || 1))
export const left = (d) => [d[1], -d[0]]
export const bearing = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const norm3 = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
export const at3 = (p2, y) => [p2[0], y, p2[1]]

export const mesh = () => ({ positions: [], normals: [], uvs: [] })
// Push a triangle; when `want` is given the winding is flipped so the normal agrees with it.
export function tri(out, a, b, c, want, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  const u = sub3(b, a), v = sub3(c, a)
  let n = cross3(u, v)
  const l = Math.hypot(...n)
  if (l < 1e-9) return
  if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((x) => -x) }
  for (const [p, t] of [[a, ua], [b, ub], [c, uc]]) { out.positions.push(...p); out.normals.push(n[0] / l || 0, n[1] / l || 0, n[2] / l || 0); out.uvs.push(...t) }
}
export function quad(out, a, b, c, d, want, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  tri(out, a, b, c, want, [u0, v0], [u1, v0], [u1, v1]); tri(out, a, c, d, want, [u0, v0], [u1, v1], [u0, v1])
  return out
}
export const merge = (...ms) => { const o = mesh(); for (const m of ms) for (const k of ['positions', 'normals', 'uvs']) o[k].push(...m[k]); return o }

// Cylinder between two 3D points; uvX pins the u coordinate (the wheel's LEDs read their angle from it).
export function tube(out, a, b, r, sides = 6, uvX = null) {
  const d = norm3(sub3(b, a)), h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = norm3(cross3(d, h)), e2 = cross3(d, e1)
  const ring = (p) => Array.from({ length: sides }, (_, k) => {
    const t = (k / sides) * Math.PI * 2, o = [e1[0] * Math.cos(t) + e2[0] * Math.sin(t), e1[1] * Math.cos(t) + e2[1] * Math.sin(t), e1[2] * Math.cos(t) + e2[2] * Math.sin(t)]
    return { p: [p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r], o }
  })
  const A = ring(a), B = ring(b), len = Math.hypot(...sub3(b, a))
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, want = A[k].o.map((x, i) => x + A[k2].o[i])
    const u0 = uvX ?? k / sides, u1 = uvX ?? (k + 1) / sides
    tri(out, A[k].p, A[k2].p, B[k2].p, want, [u0, 0], [u1, 0], [u1, len]); tri(out, A[k].p, B[k2].p, B[k].p, want, [u0, 0], [u1, len], [u0, len])
  }
  return out
}
export function disc(at, r, y, sides = 48) {
  const out = mesh()
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
    const p0 = [at[0] + r * Math.cos(a0), y, at[1] + r * Math.sin(a0)], p1 = [at[0] + r * Math.cos(a1), y, at[1] + r * Math.sin(a1)]
    tri(out, [at[0], y, at[1]], p0, p1, [0, 1, 0], [at[0], at[1]], [p0[0], p0[2]], [p1[0], p1[2]])
  }
  return out
}
export const ringAround = (c, r, n = 24) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * Math.PI * 2), c[1] + r * Math.sin((i / n) * Math.PI * 2)])

// Oriented box: centre c (x,z), axis u (unit x,z), length L along u, width W across, heights y0..y1. Walls get metre UVs.
export function slab(out, c, u, L, W, y0, y1) {
  const v = left(u), hl = L / 2, hw = W / 2
  const P = (a, b, y) => at3(add2(add2(c, mul2(u, a)), mul2(v, b)), y)
  const cs = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]
  for (let i = 0; i < 4; i++) {
    const [a0, b0] = cs[i], [a1, b1] = cs[(i + 1) % 4], n = add2(mul2(u, (a0 + a1) / 2), mul2(v, (b0 + b1) / 2))
    quad(out, P(a0, b0, y0), P(a1, b1, y0), P(a1, b1, y1), P(a0, b0, y1), [n[0], 0, n[1]], [0, y0, Math.hypot(a1 - a0, b1 - b0), y1])
  }
  quad(out, P(-hl, -hw, y1), P(hl, -hw, y1), P(hl, hw, y1), P(-hl, hw, y1), [0, 1, 0], [0, 0, L, W])
  quad(out, P(-hl, -hw, y0), P(hl, -hw, y0), P(hl, hw, y0), P(-hl, hw, y0), [0, -1, 0], [0, 0, L, W])
  return out
}

// Surface of revolution from an absolute [radius, height] profile. The normal is the profile direction turned
// clockwise in the (r, y) plane: walking up an outer wall faces out, walking inward faces up.
// lobes/depth scallop the radius: r·(1 − depth·|sin(lobes·θ/2)|), the shell edge of Buckingham's basins.
export function revolve(at, profile, { sides = 48, lobes = 0, depth = 0 } = {}) {
  const out = mesh(), f = (a) => 1 - depth * Math.abs(Math.sin((lobes * a) / 2))
  const P = (r, y, a) => [at[0] + Math.cos(a) * r * f(a), y, at[1] + Math.sin(a) * r * f(a)]
  for (let j = 0; j < profile.length - 1; j++) {
    const [r0, y0] = profile[j], [r1, y1] = profile[j + 1], n = [y1 - y0, -(r1 - r0)]
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2
      const want = [Math.cos(am) * n[0], n[1], Math.sin(am) * n[0]]
      const A = P(r0, y0, a0), B = P(r0, y0, a1), C = P(r1, y1, a1), D = P(r1, y1, a0)
      tri(out, A, B, C, want, [a0 * r0, y0], [a1 * r0, y0], [a1 * r1, y1]); tri(out, A, C, D, want, [a0 * r0, y0], [a1 * r1, y1], [a0 * r1, y1])
    }
  }
  return out
}

// Parametric patch pt(i, j) for i ∈ [0, S], j ∈ [0, T]; normals = sign · (∂/∂i × ∂/∂j), taken per quad from its diagonals.
// { smooth: true }: every grid point takes the average of its four quads' normals (a mirror shows flat facets).
export function gridSurface(pt, S, T, sign = 1, wrapT = true, { smooth = false } = {}) {
  const out = mesh()
  const J = (j) => (wrapT ? ((j % T) + T) % T : j)
  const quadN = (i, j) => { const j1 = wrapT ? (j + 1) % T : j + 1, a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j1), d = pt(i, j1); return cross3(sub3(c, a), sub3(d, b)).map((x) => x * sign) }
  const vN = (i, j) => {
    const s = [0, 0, 0]
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const qi = i + di, qj = wrapT ? J(j + dj) : j + dj
      if (qi < 0 || qi >= S || qj < 0 || qj >= T) continue
      const n = quadN(qi, qj); s[0] += n[0]; s[1] += n[1]; s[2] += n[2]
    }
    return norm3(s)
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) {
    const j1 = wrapT ? (j + 1) % T : j + 1
    const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j1), d = pt(i, j1)
    const n = quadN(i, j), from = out.positions.length
    tri(out, a, b, c, n, [i, j], [i + 1, j], [i + 1, j + 1]); tri(out, a, c, d, n, [i, j], [i + 1, j + 1], [i, j + 1])
    if (!smooth) continue
    // tri() may swap b/c to face `n`; set each written vertex's normal from the grid point it sits on
    const grid = [[i, j], [i + 1, j], [i + 1, j1], [i, j1]], pts = [a, b, c, d]
    for (let k = from; k < out.positions.length; k += 3) {
      const p = out.positions.slice(k, k + 3), g = grid[pts.findIndex((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])]
      const nn = vN(g[0], g[1]); out.normals[k] = nn[0]; out.normals[k + 1] = nn[1]; out.normals[k + 2] = nn[2]
    }
  }
  return out
}

// Half-cylinder (elliptical) vault along u: base y0, crown y0 + rise, with end caps.
export function barrel(c, u, L, W, y0, rise, n = 12) {
  const out = mesh(), v = left(u)
  const P = (a, k) => { const t = (k / n) * Math.PI; return at3(add2(add2(c, mul2(u, a)), mul2(v, (Math.cos(t) * W) / 2)), y0 + Math.sin(t) * rise) }
  for (let k = 0; k < n; k++) {
    const mid = (k + 0.5) / n * Math.PI, want = [v[0] * Math.cos(mid), Math.sin(mid), v[1] * Math.cos(mid)]
    quad(out, P(-L / 2, k), P(L / 2, k), P(L / 2, k + 1), P(-L / 2, k + 1), want, [0, k, L, k + 1])
  }
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) tri(out, at3(add2(c, mul2(u, (s * L) / 2)), y0), P((s * L) / 2, k), P((s * L) / 2, k + 1), [u[0] * s, 0, u[1] * s])
  return out
}

// Rotate a local mesh (x forward, y up, z right) so +x points along bearing(yawDeg), then move and scale it.
export function place(m, { at = [0, 0], y = 0, yawDeg = 0, scale = 1 } = {}) {
  const f = bearing(yawDeg), r = [-f[1], f[0]], out = mesh()
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], yy = m.positions[i + 1], z = m.positions[i + 2]
    out.positions.push(at[0] + (f[0] * x + r[0] * z) * scale, y + yy * scale, at[1] + (f[1] * x + r[1] * z) * scale)
    const nx = m.normals[i], ny = m.normals[i + 1], nz = m.normals[i + 2]
    out.normals.push(f[0] * nx + r[0] * nz, ny, f[1] * nx + r[1] * nz)
  }
  out.uvs.push(...m.uvs)
  return out
}

// Uniform Catmull–Rom resampling of a 2D polyline (~`step` metres apart), through every control point.
export function catmullRom(points, step) {
  const out = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
    const n = Math.max(1, Math.ceil(len2(sub2(p2, p1)) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)))
    }
  }
  out.push([...points[points.length - 1]])
  return out
}

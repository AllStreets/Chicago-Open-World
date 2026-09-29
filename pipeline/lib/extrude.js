// pipeline/lib/extrude.js — footprint → wall + roof triangles (non-indexed), optional taper.
import earcut from 'earcut'
import { ensureCCW, ensureCW } from './geom.js'

function scaler(taper) {
  if (!taper) return () => (p) => p
  const { center: [cx, cz], shaftTop, topScale } = taper
  return (y) => {
    const s = 1 - (1 - topScale) * Math.min(1, Math.max(0, y / shaftTop))
    return ([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]
  }
}

function pushWalls(ring, base, top, at, out) {
  const lo = at(base), hi = at(top)
  let u = 0
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length]
    const len = Math.hypot(B[0] - A[0], B[1] - A[1])
    if (len < 1e-6) continue
    const [ax0, az0] = lo(A), [bx0, bz0] = lo(B), [ax1, az1] = hi(A), [bx1, bz1] = hi(B)
    const a0 = [ax0, base, az0], b0 = [bx0, base, bz0], a1 = [ax1, top, az1], b1 = [bx1, top, bz1]
    // normal from the real (possibly tilted) quad: (b0 - a0) x (a1 - a0)
    const ux = b0[0] - a0[0], uy = 0, uz = b0[2] - a0[2]
    const vx = a1[0] - a0[0], vy = top - base, vz = a1[2] - a0[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx = nx / nl || 0; ny = ny / nl || 0; nz = nz / nl || 0 // `|| 0` avoids -0
    const uvA0 = [u, base], uvB0 = [u + len, base], uvA1 = [u, top], uvB1 = [u + len, top]
    for (const [p, t] of [[a0, uvA0], [b0, uvB0], [a1, uvA1], [b0, uvB0], [b1, uvB1], [a1, uvA1]]) {
      out.positions.push(...p); out.normals.push(nx, ny, nz); out.uvs.push(...t)
    }
    u += len
  }
}

function pushRoof(outer, holes, top, at, out) {
  const tr = at(top)
  const flat = [], holeIdx = []
  for (const p of outer) flat.push(...tr(p))
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const p of h) flat.push(...tr(p)) }
  const tris = earcut(flat, holeIdx.length ? holeIdx : undefined, 2)
  for (let i = 0; i < tris.length; i += 3) {
    let [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]]
    const ax = flat[a * 2], az = flat[a * 2 + 1]
    const bx = flat[b * 2], bz = flat[b * 2 + 1]
    const cx = flat[c * 2], cz = flat[c * 2 + 1]
    // y-component of (b-a)x(c-a) must be positive for an upward-facing tri
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) [b, c] = [c, b]
    for (const k of [a, b, c]) {
      const x = flat[k * 2], z = flat[k * 2 + 1]
      out.positions.push(x, top, z); out.normals.push(0, 1, 0); out.uvs.push(x, z)
    }
  }
}

export function extrudeBuilding({ outer, holes = [], base = 0, top, taper }) {
  const out = { positions: [], normals: [], uvs: [] }
  const at = scaler(taper)
  const o = ensureCCW(outer)
  // Holes wind CW on the map so their wall normals point into the courtyard.
  const hs = holes.map(ensureCW)
  pushWalls(o, base, top, at, out)
  for (const h of hs) pushWalls(h, base, top, at, out)
  pushRoof(o, hs, top, at, out)
  return out
}

// pipeline/lib/extrude.js — footprint → wall + roof triangles (non-indexed).
import earcut from 'earcut'
import { ensureCCW, ensureCW } from './geom.js'

function pushWalls(ring, base, top, out) {
  let u = 0
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    // Outward normal for a map-CCW ring (+X east, -Z north): (-(dz), 0, dx) / len
    const nx = -(bz - az) / len || 0, nz = (bx - ax) / len || 0 // `|| 0` avoids -0
    const a0 = [ax, base, az], b0 = [bx, base, bz], a1 = [ax, top, az], b1 = [bx, top, bz]
    const uvA0 = [u, base], uvB0 = [u + len, base], uvA1 = [u, top], uvB1 = [u + len, top]
    for (const [p, t] of [[a0, uvA0], [b0, uvB0], [a1, uvA1], [b0, uvB0], [b1, uvB1], [a1, uvA1]]) {
      out.positions.push(...p); out.normals.push(nx, 0, nz); out.uvs.push(...t)
    }
    u += len
  }
}

function pushRoof(outer, holes, top, out) {
  const flat = [], holeIdx = []
  for (const [x, z] of outer) flat.push(x, z)
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const [x, z] of h) flat.push(x, z) }
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

export function extrudeBuilding({ outer, holes = [], base = 0, top }) {
  const out = { positions: [], normals: [], uvs: [] }
  const o = ensureCCW(outer)
  // Holes wind CW on the map so their wall normals point into the courtyard.
  const hs = holes.map(ensureCW)
  pushWalls(o, base, top, out)
  for (const h of hs) pushWalls(h, base, top, out)
  pushRoof(o, hs, top, out)
  return out
}

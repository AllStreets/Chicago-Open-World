// pipeline/lib/harbours.js — B-8: the lakefront harbours' floating docks and their boats (data/harbours.json). Docks are
// rows of main docks across the harbour's long axis with finger slips both sides, floating `freeboard` over the lake;
// a mooring field is a grid of buoys where every boat swings to point into the wind. The docks are tile geometry; the
// boats are instances of one Blender model (heroes/out/harbour_boat.glb) the app draws as one InstancedMesh per LOD.
import { orientedBox } from './sacred.js'
import { inPoly } from './riverLevel.js'
import { edgeIndex } from './lakeLevel.js'
import { add2, mul2, mesh, slab, bearing } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

export const BOAT_LENGTH_M = 10 // the model's length overall; instances scale 0.8–1.4×
const P = (m, facade, style, part, lod0Only = false) => Object.assign(m, { facade, seed: 0.5, style, part, lod0Only })

function rng(seed) { let h = seed >>> 0 || 1; return () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296 } }
const hashKey = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)

// runs of a line (from a along d, length L) that lie inside the polygon at least `gap` from its edges
function runsInside(poly, wall, a, d, L, gap, step = 0.5) {
  const out = []
  let s0 = null
  for (let t = 0; t <= L; t += step) {
    const p = add2(a, mul2(d, t)), ok = inPoly(p, poly) && wall.nearest(p, gap) === Infinity
    if (ok && s0 == null) s0 = t
    if ((!ok || t + step > L) && s0 != null) { const t1 = ok ? t : t - step; if (t1 - s0 > 1) out.push([s0, t1]); s0 = null }
  }
  return out
}

const yawOf = (d) => Math.atan2(-d[1], d[0]) // three.js rotation about +Y that turns the model's bow (+X) onto d (xz)

export function layoutHarbour(poly, h, cfg, { lakeY }) {
  const rnd = rng(hashKey(h.key)), D = cfg.dock, M = cfg.mooring
  const wall = edgeIndex([poly.outer, ...(poly.holes ?? [])].flatMap((r) => r.map((p, i) => [p, r[(i + 1) % r.length]])))
  const ob = orientedBox(poly.outer)
  const u = h.rowBearingDeg != null ? bearing(h.rowBearingDeg + 90) : ob.u, v = h.rowBearingDeg != null ? bearing(h.rowBearingDeg) : ob.v
  const L = ob.L, W = ob.W, c = ob.c
  const deck = mesh(), fingers = mesh(), piles = mesh(), slots = []
  const top = lakeY + D.freeboard, bot = top - D.thick
  const dockUpTo = h.layout === 'docks' ? Infinity : h.layout === 'mixed' ? -L / 2 + L * (h.dockShare ?? 0.5) : -Infinity
  // docks: rows across the long axis from one end
  // only as many rows as the harbour's boats fill (at the dock occupancy): no field of empty slips
  const wantSlots = (h.maxBoats * (h.layout === 'mixed' ? h.dockShare ?? 0.5 : 1)) / D.occupancy
  let lastRow = -Infinity
  for (let a = -L / 2 + D.wallGap + D.fingerLen + D.width; a <= Math.min(L / 2, dockUpTo) && slots.length < wantSlots; a += D.rowPitch) {
    lastRow = a
    const start = add2(add2(c, mul2(u, a)), mul2(v, -W / 2 - 5))
    for (const [t0, t1] of runsInside(poly, wall, start, v, W + 10, D.wallGap)) {
      const len = t1 - t0, mid = add2(start, mul2(v, (t0 + t1) / 2))
      if (len < 14) continue
      slab(deck, mid, v, len, D.width, bot, top)
      for (let k = 0; k * D.pileEvery <= len; k++) for (const s of [-1, 1]) slab(piles, add2(add2(start, mul2(v, t0 + Math.min(len, k * D.pileEvery))), mul2(u, s * (D.width / 2 + 0.3))), v, 0.36, 0.36, lakeY - 0.6, lakeY + 2.1)
      for (const s of [-1, 1]) {
        const n = mul2(u, s)
        for (let x = 1.5; x <= len - 1.5; x += D.fingerEvery) {
          const root = add2(add2(start, mul2(v, t0 + x)), mul2(n, D.width / 2)), tip = add2(root, mul2(n, D.fingerLen))
          if (!inPoly(tip, poly) || wall.nearest(tip, 1.5) !== Infinity) continue
          slab(fingers, add2(root, mul2(n, D.fingerLen / 2)), n, D.fingerLen, D.fingerW, bot + 0.1, top - 0.05)
          // the slip beside this finger (toward +v), if the next finger stands too
          if (x + D.fingerEvery > len - 1.5) continue
          const sc = 0.82 + 0.24 * rnd(), bl = BOAT_LENGTH_M * sc
          const bc = add2(add2(root, mul2(v, D.fingerEvery / 2)), mul2(n, bl / 2 + 0.5))
          if (!inPoly(add2(bc, mul2(n, bl / 2)), poly)) continue
          const bowIn = rnd() < 0.7
          slots.push({ x: bc[0], z: bc[1], yaw: yawOf(mul2(n, bowIn ? -1 : 1)), scale: sc, keep: rnd() < D.occupancy })
        }
      }
    }
  }
  // moorings: a grid over the rest, every boat pointing into the wind
  const wind = M.windBearingDeg
  for (let a = Math.max(-L / 2 + M.inset, lastRow + D.fingerLen + M.inset); a <= L / 2 - M.inset; a += M.dx) {
    if (h.layout === 'docks') break
    for (let b = -W / 2 + M.inset; b <= W / 2 - M.inset; b += M.dz) {
      const p = add2(add2(c, mul2(u, a)), mul2(v, b + ((Math.round(a / M.dx) % 2) * M.dz) / 2))
      if (!inPoly(p, poly) || wall.nearest(p, M.inset) !== Infinity) continue
      const sc = 0.8 + 0.6 * rnd(), d = bearing(wind + (rnd() * 2 - 1) * M.jitterDeg)
      // the buoy is at p; the boat lies downwind of it, bow to the buoy
      const bc = add2(p, mul2(d, -(BOAT_LENGTH_M * sc) / 2 - 2))
      slots.push({ x: bc[0], z: bc[1], yaw: yawOf(d), scale: sc, keep: rnd() < M.occupancy, mooring: true })
    }
  }
  let kept = slots.filter((s) => s.keep)
  if (kept.length > h.maxBoats) { const k = h.maxBoats / kept.length; kept = kept.filter(() => rnd() < k) }
  const boats = kept.map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, scale: s.scale, kind: rnd() < h.sail ? 0 : 1, hull: Math.floor(rnd() * cfg.palette.hull.length), trim: Math.floor(rnd() * cfg.palette.trim.length), mooring: Boolean(s.mooring) }))
  return {
    // the main docks show from afar (the boats are drawn to 3.2 km); the fingers and piles only close by
    meshes: [P(deck, F.stone, 'sidewalk-concrete', 'harbour-docks'), P(fingers, F.stone, 'sidewalk-concrete', 'harbour-fingers', true), P(piles, F.steel, 'grid-deck-steel', 'harbour-piles', true)].filter((m) => m.positions.length),
    boats, slots: slots.length,
  }
}

// every harbour in data/harbours.json whose OSM polygon is found → { key, name, meshes, boats }
export function layoutHarbours(cfg, waterById, { lakeY }) {
  const out = []
  for (const h of cfg.harbours) {
    const polys = waterById(h.osm)
    if (!polys.length) continue
    const poly = polys.reduce((a, b) => (Math.abs(b.bbox.maxX - b.bbox.minX) * Math.abs(b.bbox.maxZ - b.bbox.minZ) > Math.abs(a.bbox.maxX - a.bbox.minX) * Math.abs(a.bbox.maxZ - a.bbox.minZ) ? b : a))
    out.push({ key: h.key, name: h.name, ...layoutHarbour(poly, h, cfg, { lakeY }) })
  }
  return out
}

// the boats as compact JSON for the app: [x, z, yaw, scale, kind, hull, trim] per boat
export function boatsJson(harbours, cfg, { lakeY, model }) {
  const r = (v, k) => Math.round(v * k) / k
  return {
    version: 1, y: lakeY, model, lengthM: BOAT_LENGTH_M, palette: cfg.palette,
    harbours: harbours.map((h) => ({ key: h.key, name: h.name, count: h.boats.length })),
    boats: harbours.flatMap((h) => h.boats.flatMap((b) => [r(b.x, 10), r(b.z, 10), r(b.yaw, 100), r(b.scale, 100), b.kind, b.hull, b.trim])),
  }
}

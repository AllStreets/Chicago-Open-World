// pipeline/lib/riverwalk.js — D1-2: the Chicago Riverwalk at river level (levels.json RIVERWALK_Y, 1 m over the
// water, ≈ 5.3 m under Upper Wacker) — https://en.wikipedia.org/wiki/Chicago_Riverwalk, Ross Barney / Sasaki.
// The floor is the OSM Riverwalk polygon minus the bascule piers it runs past, plus a passage in front of each pier
// (the Riverwalk goes under every bridge). Between the bridges are its rooms (data/riverwalk.json): Marina Plaza's
// tiers and boat slips, the Cove's kayak dock, the River Theater's steps up to Upper Wacker, the Water Plaza, the
// Jetty's piers and floating gardens, the Boardwalk, the Vietnam Veterans Memorial, the planted east section. Behind it
// the retaining wall under Wacker with the vaults' storefronts, a stair up to the street at every bridge, the limestone
// parapet along Upper Wacker, and the railing at the water. Pure: build-world.js turns the result into tiles.
import polygonClipping from 'polygon-clipping'
import { add2, sub2, mul2, dot2, len2, norm2, left, at3, mesh, tri, quad, slab, tube } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
import { openRing, signedArea, ringBBox, ringCentroid, pointInRing } from './geom.js'
import { wallRuns, polyIndex, inPoly } from './riverLevel.js'
import { pierBoxes, pierRing, PIT } from './bridges.js'
import { flatMesh } from './ground.js'

export const RW = {
  passageW: 5.5,       // the walk in front of a bascule pier (m)
  passageSide: 4.0,    // …and past it either side
  stair: { width: 2.4, riser: 0.171, tread: 0.3, gap: 0.3 }, // ≈ 31 risers of 6¾ in to Upper Wacker
  theater: { rise: 0.442, tread: 1.0, steps: 12 }, // River Theater: 12 seat-steps, ≈ 5.3 m from the river to Wacker
  railH: 1.1, postEvery: 3,
  parapetH: 1.05, parapetT: 0.35,
  bay: 9.75,           // the vaults under Wacker: 32 ft column bays (LUSAS Wacker Drive case study)
  vault: { w: 6.2, h: 3.0, rise: 1.1 },
  overWaterDepth: 0.6, // a floor over the water is a 0.6 m slab with a soffit (passages, the jetties)
  keepClear: 6.0,
  lampEvery: 18, lampH: 3.8,      // every feature leaves at least this much open floor to the river: the walk goes on
}
const STY = { granite: 'riverwalk-granite', concrete: 'pit-concrete', wood: 'boardwalk-wood', steel: 'lamp-post-black', glass: 'tender-glass', limestone: 'bedford-limestone', memorial: 'black-granite', green: 'lurie-hedge', walk: 'sidewalk-concrete' }
const P = (m, facade, style, part, { seed = 0.5, lod0Only = true } = {}) => ({ mesh: m, facade, seed, style, part, lod0Only })
const close = (r) => [...r, r[0]]
const toPolys = (mp) => mp.map(([o, ...h]) => ({ outer: openRing(o), holes: h.map(openRing) })).filter((p) => p.outer.length >= 3 && Math.abs(signedArea(p.outer)) > 0.5)
const asMP = (polys) => polys.map((p) => [close(p.outer), ...(p.holes ?? []).map(close)])

// Rooms between their bridges: the east–west extent (x, metres) each may occupy, from its bridges' piers (or the
// Riverwalk's own ends) — the "street table" of the plan.
export function roomExtents(rooms, bridges, ring) {
  const bb = ringBBox(ring), byKey = new Map(bridges.map((b) => [b.key, b]))
  const halfX = (b) => Math.abs(b.axis[1]) * (b.width / 2 + PIT.wall + 1 + RW.stair.gap + RW.stair.tread * Math.round(5.3 / RW.stair.riser)) + Math.abs(b.axis[0]) * (b.span / 2) // the pier and its stair
  return rooms.map((r) => {
    const e = r.east ? byKey.get(r.east) : null, w = r.west ? byKey.get(r.west) : null
    if ((r.east && !e) || (r.west && !w)) throw new Error(`riverwalk room ${r.key}: bridge ${r.east ?? r.west} not found`)
    return { ...r, x0: w ? w.centre[0] + halfX(w) : bb.minX - 1, x1: e ? e.centre[0] - halfX(e) : bb.maxX + 1 }
  })
}

// The piers the Riverwalk passes: the leaf whose pier box overlaps the Riverwalk polygon.
export function riverwalkPiers(bridges, ring, deckY, levels) {
  const bb = ringBBox(ring), out = []
  for (const b of bridges) {
    if (b.centre[0] < bb.minX - 150 || b.centre[0] > bb.maxX + 150 || b.centre[1] < bb.minZ - 150 || b.centre[1] > bb.maxZ + 150) continue
    for (const p of pierBoxes(b, deckY, levels)) {
      const r = pierRing(p, 'outer')
      let hit = false
      try { hit = polygonClipping.intersection([close(r)], [close(ring)]).length > 0 } catch {}
      if (hit) out.push({ bridge: b, box: p, ring: r })
    }
  }
  return out
}

// The floor: the Riverwalk polygon minus the piers, plus a passage in front of (and beside) each pier.
export function riverwalkFloor(ring, piers, y) {
  let mp = [[close(ring)]]
  for (const p of piers) mp = polygonClipping.difference(mp, [close(p.ring)])
  const passages = piers.map((p) => passageRing(p))
  mp = polygonClipping.union(mp, ...passages.map((r) => [close(r)]))
  for (const p of piers) mp = polygonClipping.difference(mp, [close(p.ring)]) // a passage never cuts into the next pier
  return { zones: toPolys(mp).map((z) => ({ ...z, y })), passages }
}
export function passageRing({ box }) {
  const g = box.g, v = left(g.d), at = (a, o) => add2(add2(g.p2, mul2(g.d, a)), mul2(v, o))
  const a0 = box.a1 + PIT.wall, a1 = a0 + RW.passageW, w = box.outer + RW.passageSide
  return [at(a0 - 0.2, -w), at(a1, -w), at(a1, w), at(a0 - 0.2, w)]
}

// a point is on the floor, clear of its edges by m
const onFloor = (zIdx, zones, pt, m = 0) => {
  if (!zIdx.find(pt)) return false
  if (!m) return true
  for (const d of [[m, 0], [-m, 0], [0, m], [0, -m]]) if (!zIdx.find([pt[0] + d[0], pt[1] + d[1]])) return false
  return true
}

// Mesh helpers: a run of steps against a wall line a→b (n points away from the floor), each a slab from the floor up.
function stepsAlong(out, a, b, n, { floor, count, rise, tread, from = 0 }) {
  const L = len2(sub2(b, a)), u = norm2(sub2(b, a)), mid = mul2(add2(a, b), 0.5)
  for (let k = 0; k < count; k++) {
    const dist = from + (count - k - 0.5) * tread // step k = 0 is the lowest, farthest out
    slab(out, add2(mid, mul2(n, -dist)), u, L, tread, floor, floor + (k + 1) * rise)
  }
  return out
}
const runLen = (r) => len2(sub2(r.b, r.a))
const runMid = (r) => mul2(add2(r.a, r.b), 0.5)
// the parts of wall runs whose x lies within the room
function clipRuns(runs, room) {
  const out = []
  for (const r of runs) {
    const dx = r.b[0] - r.a[0]
    let t0 = 0, t1 = 1
    if (Math.abs(dx) < 1e-9) { if (r.a[0] < room.x0 || r.a[0] > room.x1) continue } else {
      const ta = (room.x0 - r.a[0]) / dx, tb = (room.x1 - r.a[0]) / dx
      t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(1, Math.max(ta, tb))
    }
    if (t1 - t0 < 1e-6) continue
    const at = (t) => [r.a[0] + (r.b[0] - r.a[0]) * t, r.a[1] + (r.b[1] - r.a[1]) * t]
    out.push({ ...r, a: at(t0), b: at(t1) })
  }
  return out
}

// Every room's features (meshes and the footprints the walk must keep off), from the floor's walls.
function roomFeatures(room, ctx) {
  const { y, riverY, retaining, riverEdge, zIdx, zones, gardens, roomPoly } = ctx
  const meshes = [], obstacles = []
  const back = clipRuns(retaining.filter((r) => r.top === 0), room) // the wall under Wacker, within the room
  const front = clipRuns(riverEdge, room)                            // the river's edge
  const longest = (runs, min = 6) => runs.filter((r) => runLen(r) >= min).sort((p, q) => runLen(q) - runLen(p))
  const rectObs = (c, u, L, W) => obstacles.push([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => add2(add2(c, mul2(u, (s * L) / 2)), mul2(left(u), (t * W) / 2))))
  const midX = (room.x0 + room.x1) / 2
  // storefronts in the vaults under Wacker (Marina Plaza, the Cove, the Water Plaza, the Jetty, the Memorial)
  if (['marina', 'cove', 'waterPlaza', 'jetty', 'memorial'].includes(room.kind)) {
    const glass = mesh(), frame = mesh()
    for (const r of longest(back, RW.bay)) {
      const u = norm2(sub2(r.b, r.a)), n = r.n, L = runLen(r)
      for (let s = RW.bay / 2; s + RW.vault.w / 2 < L; s += RW.bay) {
        const c = add2(add2(r.a, mul2(u, s)), mul2(n, -0.06)), h = RW.vault
        const P0 = (o, yy) => at3(add2(c, mul2(u, o)), yy)
        // a segmental arch: a rectangle and a 6-piece fan above it, facing the floor (−n)
        const want = [-n[0], 0, -n[1]]
        quad(glass, P0(-h.w / 2, y), P0(h.w / 2, y), P0(h.w / 2, y + h.h), P0(-h.w / 2, y + h.h), want, [0, 0, h.w, h.h])
        for (let k = 0; k < 6; k++) {
          const t0 = (k / 6) * Math.PI, t1 = ((k + 1) / 6) * Math.PI
          tri(glass, P0(0, y + h.h), P0((-Math.cos(t0) * h.w) / 2, y + h.h + Math.sin(t0) * h.rise), P0((-Math.cos(t1) * h.w) / 2, y + h.h + Math.sin(t1) * h.rise), want)
        }
        slab(frame, add2(add2(r.a, mul2(u, s + RW.bay / 2)), mul2(n, -0.25)), u, 0.9, 0.5, y, 0) // the pilaster between two vaults
      }
    }
    meshes.push(P(glass, F.wall, STY.glass, 'vault-storefront', { seed: 0.35 }), P(frame, F.stone, STY.concrete, 'vault-pilaster'))
  }
  // how far the floor runs out from the back wall at a point of a run (to the river's edge or the next wall)
  const depthAt = (r, t) => {
    const p0 = add2(r.a, mul2(sub2(r.b, r.a), t))
    let d = 0.3
    while (d < 60 && onFloor(zIdx, zones, add2(p0, mul2(r.n, -d)), 0)) d += 0.5
    return d - 0.3
  }
  // the back wall cut into pieces of about `len` metres, each with the floor's depth in front of it
  const pieces = (runs, len) => runs.flatMap((r) => {
    const k = Math.max(1, Math.round(runLen(r) / len))
    return Array.from({ length: k }, (_, i) => {
      const a = add2(r.a, mul2(sub2(r.b, r.a), i / k)), b = add2(r.a, mul2(sub2(r.b, r.a), (i + 1) / k)), q = { a, b, n: r.n }
      return { ...q, depth: Math.min(depthAt(q, 0.15), depthAt(q, 0.5), depthAt(q, 0.85)) }
    })
  })
  const KEEP = RW.keepClear
  if (room.kind === 'theater') {
    // the River Theater: seat-steps from the river up to Upper Wacker along its back wall; where the floor is too
    // shallow for all twelve, fewer (they stop short of the street), always leaving a walk along the river
    const st = mesh(), T = RW.theater
    for (const q of pieces(longest(back, 3), 3)) {
      const count = Math.min(T.steps, Math.floor((q.depth - KEEP) / T.tread))
      if (count < 3) continue
      stepsAlong(st, q.a, q.b, q.n, { floor: y, count, rise: T.rise, tread: T.tread })
      rectObs(add2(runMid(q), mul2(q.n, -(count * T.tread) / 2)), norm2(sub2(q.b, q.a)), runLen(q) + 0.4, count * T.tread + 1)
    }
    meshes.push(P(st, F.stone, STY.granite, 'river-theater', { lod0Only: false }))
  }
  if (room.kind === 'marina') {
    // three seating tiers against the wall, facing Marina City; boat slips on a floating dock at the water
    const tiers = mesh()
    for (const q of pieces(longest(back, 3), 3).filter((x) => x.depth >= 5 + KEEP)) {
      stepsAlong(tiers, q.a, q.b, q.n, { floor: y, count: 3, rise: 0.45, tread: 1.4, from: 0.8 })
      rectObs(add2(runMid(q), mul2(q.n, -2.5)), norm2(sub2(q.b, q.a)), runLen(q) + 0.4, 5.4)
    }
    meshes.push(P(tiers, F.stone, STY.granite, 'marina-tiers'), ...docks(front, riverY, { fingers: true }))
  }
  if (room.kind === 'cove') meshes.push(...docks(front, riverY, { fingers: false, kayak: true }))
  if (room.kind === 'waterPlaza') {
    // a granite basin of shallow play water against the back wall, as deep as the floor allows with the walk kept clear
    const r = longest(back, 12)[0]
    const rim = mesh(), w = mesh()
    if (r) {
      const u = norm2(sub2(r.b, r.a)), W = Math.min(7.4, Math.max(0, Math.min(depthAt(r, 0.3), depthAt(r, 0.5), depthAt(r, 0.7)) - KEEP - 1.4)), L = Math.min(17.4, runLen(r) - 3)
      if (W >= 2.5 && L >= 6) {
        const c = add2(runMid(r), mul2(r.n, -(0.8 + W / 2 + 0.3)))
        for (const [o, LL, WW] of [[[0, W / 2 + 0.3], L + 0.6, 0.6], [[0, -W / 2 - 0.3], L + 0.6, 0.6], [[L / 2 + 0.3, 0], 0.6, W + 1.2], [[-L / 2 - 0.3, 0], 0.6, W + 1.2]]) slab(rim, add2(add2(c, mul2(u, o[0])), mul2(left(u), o[1])), u, LL, WW, y, y + 0.35)
        slab(w, c, u, L, W, y, y + 0.22)
        rectObs(c, u, L + 1.6, W + 1.6)
      }
    }
    meshes.push(P(rim, F.stone, STY.granite, 'water-plaza-rim'), P(w, F.water, null, 'water-plaza-water', { seed: 0.1 }))
  }
  if (room.kind === 'jetty') {
    // piers out over the river, and the floating wetland gardens between them
    const piers = mesh(), soff = mesh()
    for (const r of longest(front, 8)) {
      const u = norm2(sub2(r.b, r.a)), n = r.n, L = runLen(r), k = Math.max(1, Math.floor(L / 22))
      for (let i = 0; i < k; i++) {
        const c = add2(add2(r.a, mul2(u, (L * (i + 0.5)) / k)), mul2(n, -4.2))
        ctx.gaps.push(add2(r.a, mul2(u, (L * (i + 0.5)) / k))) // the railing opens onto each pier
        slab(piers, c, n, 8.4, 3.2, y - 0.25, y + 0.03)
        slab(soff, c, n, 8.0, 0.5, riverY - 0.4, y - 0.25) // a pile bent under each pier
      }
    }
    const gm = mesh()
    for (const g of gardens) for (const t of flatSlab(g, riverY + 0.05, riverY + 0.4)) gm.positions.push(...t.positions), gm.normals.push(...t.normals), gm.uvs.push(...t.uvs)
    meshes.push(P(piers, F.stone, STY.wood, 'jetty-pier'), P(soff, F.stone, STY.concrete, 'jetty-piles'), P(gm, F.ivy, STY.green, 'floating-garden', { seed: 0.4 }))
  }
  if (room.kind === 'boardwalk') {
    // wooden decking over the floor of the Boardwalk room
    const deck = mesh(), polys = roomPoly ? clipTo(roomPoly, zones) : []
    for (const p of polys) { const f = flatMesh([p], y + 0.05); for (const k of ['positions', 'normals', 'uvs']) deck[k].push(...f[k]) }
    meshes.push(P(deck, F.stone, STY.wood, 'boardwalk-deck', { lod0Only: false }))
  }
  if (room.kind === 'memorial') {
    // the Vietnam Veterans Memorial: a black granite wall of names and, where the floor is deep enough, its fountain
    const wall = mesh(), basin = mesh(), wtr = mesh()
    const r = longest(back, 10)[0]
    if (r && depthAt(r, 0.5) >= 2.7 + KEEP) {
      const u = norm2(sub2(r.b, r.a)), c = add2(runMid(r), mul2(r.n, -2.2)), L = Math.min(26, runLen(r) - 2)
      slab(wall, c, u, L, 0.45, y, y + 1.6)
      rectObs(c, u, L + 1, 2)
      if (depthAt(r, 0.5) >= 13 + KEEP) {
        const f = add2(runMid(r), mul2(r.n, -9))
        for (let k = 0; k < 16; k++) { const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2; slab(basin, add2(f, mul2([Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)], 3.2)), [-Math.sin((a0 + a1) / 2), Math.cos((a0 + a1) / 2)], 1.3, 0.4, y, y + 0.45) }
        slab(wtr, f, u, 5.6, 5.6, y, y + 0.32)
        rectObs(f, u, 8, 8)
      }
    }
    meshes.push(P(wall, F.stone, STY.memorial, 'memorial-wall'), P(basin, F.stone, STY.granite, 'memorial-fountain'), P(wtr, F.water, null, 'memorial-water', { seed: 0.1 }))
  }
  if (room.kind === 'promenade') {
    // planted beds against the wall every 18 m (the east section's terraces, Michigan–Wabash's beds)
    const box = mesh(), green = mesh()
    for (const r of longest(back, 8)) {
      const u = norm2(sub2(r.b, r.a)), L = runLen(r)
      for (let s = 6; s + 4 < L; s += 18) {
        const t = (s + 3) / L, c = add2(add2(r.a, mul2(u, s + 3)), mul2(r.n, -1.9))
        if (!onFloor(zIdx, zones, c, 1.5) || depthAt(r, t) < 3.2 + KEEP) continue
        slab(box, c, u, 6, 2.6, y, y + 0.6); slab(green, c, u, 5.6, 2.2, y + 0.6, y + 0.75)
        rectObs(c, u, 7, 3.6)
      }
    }
    meshes.push(P(box, F.stone, STY.concrete, 'planter'), P(green, F.ivy, STY.green, 'planting', { seed: 0.4 }))
  }
  return { meshes: meshes.filter((m) => m.mesh.positions.length), obstacles }
}
function centreOnFloor(zIdx, x, front) {
  const r = front.find((q) => Math.abs(runMid(q)[0] - x) < 30) ?? front[0]
  return r ? add2(runMid(r), mul2(r.n, 8)) : [x, 0]
}
function clipTo(p, zones) {
  try { return toPolys(polygonClipping.intersection(asMP([p]), asMP(zones))) } catch { return [] }
}
// a closed prism over a polygon (top, bottom and its walls)
function flatSlab(p, y0, y1) {
  const top = flatMesh([p], y1), bottom = flatMesh([p], y0), out = [top]
  const b = mesh()
  for (let i = 0; i < bottom.positions.length; i += 9) for (const k of [0, 2, 1]) { b.positions.push(...bottom.positions.slice(i + k * 3, i + k * 3 + 3)); b.normals.push(0, -1, 0); b.uvs.push(...bottom.uvs.slice(((i / 3) + k) * 2, ((i / 3) + k) * 2 + 2)) }
  out.push(b)
  const w = mesh()
  for (const r of [p.outer, ...(p.holes ?? [])]) for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], n = norm2(left(sub2(c, a)))
    const m = mul2(add2(a, c), 0.5), out1 = pointInRing(add2(m, mul2(n, 0.05)), p.outer) ? mul2(n, -1) : n
    quad(w, at3(a, y0), at3(c, y0), at3(c, y1), at3(a, y1), [out1[0], 0, out1[1]], [0, y0, len2(sub2(c, a)), y1])
  }
  out.push(w)
  return out
}
// floating docks along the river's edge: a 2.4 m dock 1 m off the wall, with finger piers for boats
function docks(front, riverY, { fingers, kayak = false }) {
  const d = mesh(), top = riverY + 0.4
  for (const r of front.filter((q) => runLen(q) >= 10)) {
    const u = norm2(sub2(r.b, r.a)), n = r.n, L = runLen(r) - 4
    if (L < 6) continue
    const c = add2(runMid(r), mul2(n, -2.2))
    slab(d, c, u, L, 2.4, top - 0.45, top)
    if (fingers) for (let s = -L / 2 + 4; s < L / 2 - 2; s += 7) slab(d, add2(add2(c, mul2(u, s)), mul2(n, -5.2)), n, 8, 1.1, top - 0.4, top)
    if (kayak) for (let s = -L / 2 + 3; s < L / 2 - 2; s += 2.2) slab(d, add2(add2(c, mul2(u, s)), mul2(n, -1.9)), n, 1.4, 0.7, top, top + 0.35) // the kayaks racked at the edge
  }
  return [P(d, F.stone, STY.wood, kayak ? 'kayak-dock' : 'boat-slips')]
}

// ── The whole Riverwalk ───────────────────────────────────────────────────────────────────────────────────────────
// ring: the OSM Riverwalk polygon; water: the sunken river (riverLevel.js sunkWater); bridges: detectBridges output;
// greens: OSM park polygons (rooms, floating gardens); spec: data/riverwalk.json; levels: { river, riverwalk, lower }.
export function buildRiverwalk({ ring, water, bridges, greens = [], spec, deckY, levels }) {
  const y = levels.riverwalk, riverY = levels.river
  const near = water.filter((p) => { const b = p.bbox ?? ringBBox(p.outer), r = ringBBox(ring); return b.maxX > r.minX - 50 && b.minX < r.maxX + 50 && b.maxZ > r.minZ - 50 && b.minZ < r.maxZ + 50 })
  const piers = riverwalkPiers(bridges, ring, deckY, levels)
  const { zones, passages } = riverwalkFloor(ring, piers, y)
  const zIdx = polyIndex(zones)
  const runs = wallRuns({ water: near, zones, riverY })
  const retaining = runs.filter((r) => r.kind === 'retaining')
  // the river's edge of the floor: the water's own wall runs that stop at the floor, n pointing onto the floor
  const riverEdge = runs.filter((r) => r.kind === 'zone-edge' && r.top === y)
  const rooms = roomExtents(spec.rooms, bridges, ring)
  const meshes = [], obstacles = [], gaps = []
  const byId = new Map(greens.map((g) => [g.id, g]))
  const gardens = greens.filter((g) => g.tags?.floating === 'yes' && pointInRing(ringCentroid(g.outer), ring))
  for (const room of rooms) {
    const f = roomFeatures(room, { y, riverY, retaining, riverEdge, zIdx, zones, gardens, roomPoly: room.osm ? byId.get(room.osm) ?? null : null, gaps })
    meshes.push(...f.meshes.map((m) => ({ ...m, room: room.key }))); obstacles.push(...f.obstacles)
  }
  // a stair up to the street beside every pier: against the wall under Wacker, rising away from the pier, its top
  // landing on the street where the parapet opens — it never crosses the walk
  const stairs = mesh()
  const S = RW.stair, n = Math.round(-y / S.riser), run = n * S.tread
  const stairTops = []
  const backRuns = retaining.filter((r) => r.top === 0 && runLen(r) >= 4)
  for (const p of piers) {
    const g = p.box.g, v = left(g.d), at = (a, o) => add2(add2(g.p2, mul2(g.d, a)), mul2(v, o))
    for (const side of [1, -1]) {
      const q = at(p.box.a0 + 1, side * (p.box.outer + 0.5))
      const r = backRuns.map((x) => ({ x, d: segDist(q, x.a, x.b) })).filter((x) => x.d < 8).sort((a, b) => a.d - b.d)[0]?.x
      if (!r) continue
      let u = norm2(sub2(r.b, r.a)), a0 = r.a
      if (dot2(u, mul2(v, side)) < 0) { u = mul2(u, -1); a0 = r.b }
      const s0 = dot2(sub2(at(0, side * (p.box.outer + S.gap)), a0), u), L = runLen(r)
      if (s0 < -2 || s0 + run > L + 0.01) continue
      const start = Math.max(0, s0), ok = Array.from({ length: n }, (_, k) => onFloor(zIdx, zones, add2(add2(a0, mul2(u, start + (k + 0.5) * S.tread)), mul2(r.n, -S.width / 2)), 0)).every(Boolean)
      if (!ok) continue
      for (let k = 0; k < n; k++) slab(stairs, add2(add2(a0, mul2(u, start + (k + 0.5) * S.tread)), mul2(r.n, -S.width / 2)), u, S.tread, S.width, y, y + (k + 1) * S.riser)
      const A = add2(a0, mul2(u, start)), B = add2(a0, mul2(u, start + run)), w = mul2(r.n, -(S.width + 0.4))
      obstacles.push([A, B, add2(B, w), add2(A, w)])
      stairTops.push(add2(B, mul2(u, -0.5)))
      break // one stair per pier
    }
  }
  meshes.push(P(stairs, F.stone, STY.granite, 'stairs', { lod0Only: false }))
  // the limestone parapet along Upper Wacker, open where a stair comes up
  const para = mesh()
  for (const r of retaining.filter((q) => q.top === 0)) {
    const u = norm2(sub2(r.b, r.a)), L = runLen(r)
    if (L < 0.3) continue
    const k = Math.max(1, Math.round(L / 3))
    for (let i = 0; i < k; i++) {
      const c = add2(r.a, mul2(u, (L * (i + 0.5)) / k))
      if (stairTops.some((t) => len2(sub2(t, c)) < RW.stair.width)) continue // the stair comes up here
      slab(para, add2(c, mul2(r.n, RW.parapetT / 2)), u, L / k + 0.02, RW.parapetT, 0, RW.parapetH)
    }
  }
  meshes.push(P(para, F.stone, STY.limestone, 'wacker-parapet', { lod0Only: false }))
  // the railing at the water: steel posts every 3 m and a top rail, on every floor edge over the river
  const rail = mesh()
  for (const r of riverEdge) {
    const L = runLen(r), k = Math.max(1, Math.round(L / RW.postEvery)), a = add2(r.a, mul2(r.n, 0.15)), b = add2(r.b, mul2(r.n, 0.15))
    const open = (pt) => gaps.some((g) => len2(sub2(g, pt)) < 2.0)
    let lastPost = -1
    for (let j = 0; j < k; j++) {
      const p0 = add2(a, mul2(sub2(b, a), j / k)), p1 = add2(a, mul2(sub2(b, a), (j + 1) / k))
      if (open(p0) || open(p1) || open(mul2(add2(p0, p1), 0.5))) continue
      if (lastPost !== j) tube(rail, at3(p0, y), at3(p0, y + RW.railH), 0.04, 3)
      tube(rail, at3(p1, y), at3(p1, y + RW.railH), 0.04, 3); lastPost = j + 1
      tube(rail, at3(p0, y + RW.railH), at3(p1, y + RW.railH), 0.035, 3)
    }
  }
  meshes.push(P(rail, F.steel, STY.steel, 'railing'))
  // lamp posts along the water every 18 m, their lanterns lit at night (the bridges' own lantern glass)
  const posts = mesh(), lamps = mesh()
  let since = 9
  for (const r of riverEdge) {
    const L = runLen(r), u = norm2(sub2(r.b, r.a))
    for (let s = 0; s < L; s += 1) {
      if (++since < RW.lampEvery) continue
      const pt = add2(add2(r.a, mul2(u, s)), mul2(r.n, 1.1))
      if (!onFloor(zIdx, zones, pt, 0.6) || gaps.some((g) => len2(sub2(g, pt)) < 3)) continue
      since = 0
      tube(posts, at3(pt, y), at3(pt, y + RW.lampH - 0.35), 0.07, 4)
      slab(lamps, pt, u, 0.42, 0.42, y + RW.lampH - 0.35, y + RW.lampH + 0.15)
    }
  }
  meshes.push(P(posts, F.steel, STY.steel, 'lamp-post'), P(lamps, F.signal, 'lantern-warm', 'lantern'))
  // a floor over the water (the passages, where the polygon runs out over the river): its slab edge and soffit
  const over = mesh()
  let overWater = []
  try { overWater = toPolys(polygonClipping.intersection(asMP(zones), asMP(near))) } catch {}
  for (const p of overWater) for (const m of flatSlab(p, y - RW.overWaterDepth, y - 0.02)) for (const k of ['positions', 'normals', 'uvs']) over[k].push(...m[k])
  meshes.push(P(over, F.stone, STY.concrete, 'floor-over-water', { lod0Only: false }))
  return { zones, piers, passages, runs, rooms, meshes: meshes.filter((m) => m.mesh.positions.length), obstacles, overWater }
}

const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}

// Split a mesh's triangles into the tiles their centroids fall in (the Riverwalk is 1.9 km long: each tile streams its own part).
export function meshByTile(m, tileKeyFor) {
  const out = new Map()
  for (let i = 0; i < m.positions.length; i += 9) {
    const c = [(m.positions[i] + m.positions[i + 3] + m.positions[i + 6]) / 3, (m.positions[i + 2] + m.positions[i + 5] + m.positions[i + 8]) / 3]
    const k = tileKeyFor(c)
    if (!out.has(k)) out.set(k, mesh())
    const o = out.get(k)
    o.positions.push(...m.positions.slice(i, i + 9)); o.normals.push(...m.normals.slice(i, i + 9)); o.uvs.push(...m.uvs.slice((i / 3) * 2, (i / 3) * 2 + 6))
  }
  return out
}
void dot2; void inPoly

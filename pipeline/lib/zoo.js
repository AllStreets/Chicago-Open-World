// pipeline/lib/zoo.js — Lincoln Park Zoo (Workstream B): the zoo's builders, split out of civic.js (B-1) so the park's
// landscape (lincolnpark.js) and the zoo grow apart. Sources, anchors and every number in heroes.json (Lincoln Park
// block); dimensions read from photographs are marked approximate there.
//   Kovler Lion House (Perkins, Fellows & Hamilton, 1912): a long hall of decorative tapestry brick under a hipped clay
//     tile roof with a glazed monitor along its ridge (daylight for the cages), tall round-headed windows, lower bays
//     on the mall front, and the great arched entrance flanked by terra-cotta lions' heads.
import { mesh, merge, slab, add2, mul2, sub2, len2, norm2, revolve, tube, tri, quad, at3 } from './meshkit.js'
import { wallPolygon } from './icons.js'
import { pointInRing } from './geom.js'
import { frameOf, at, rectRing, hipRoof, gableRoof, gambrelRoof, bellRoof, prism, masonryHall, roundHead, flatHead, archivolt, edgeNormal, into, ringBand, offsetRing, siteWater, column, pediment } from './parkkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
// a flat styled colour that stays dark at night (the paint façade, 12, glows after dark like a floodlit field)
const FLAT = F.steel
import { project } from '../../shared/project.js'

// close-range detail stays out of LOD1 (the size budget); the silhouette parts draw at every distance
const FINE = new Set(['trim', 'windows', 'sills', 'archivolt', 'door', 'doors', 'lions', 'monitor-glass', 'mullions', 'lettering', 'pods', 'prairie', 'frames', 'posts', 'animals', 'gallery'])
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part, lod0Only: FINE.has(part) })
const polyArea = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2
const area = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2
export const mainRing = (b) => b.polygons.reduce((a, p) => (Math.abs(area(p.outer)) > Math.abs(area(a.outer)) ? p : a)).outer
// how far the outline reaches from `o` along `d` (its farthest vertex projection — the outlines here are near convex)
export const reach = (ring, o, d) => Math.max(...ring.map((p) => (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1]))

// A lion's head in terra cotta, set on a wall at height y: a maned boss with the muzzle standing out of it.
export function lionHead(out, o, along, dir, y, r) {
  const m = revolve([0, 0], [[r, 0], [r * 0.9, r * 0.25], [r * 0.55, r * 0.4], [0.001, r * 0.45]], { sides: 12 })
  // the lathe stands on its axis; lay it on the wall, its axis along `dir`
  for (let i = 0; i < m.positions.length; i += 3) {
    const px = m.positions[i], py = m.positions[i + 1], pz = m.positions[i + 2]
    out.positions.push(o[0] + along[0] * px + dir[0] * py, y + pz, o[1] + along[1] * px + dir[1] * py)
    const nx = m.normals[i], ny = m.normals[i + 1], nz = m.normals[i + 2]
    out.normals.push(along[0] * nx + dir[0] * ny, nz, along[1] * nx + dir[1] * ny)
  }
  out.uvs.push(...m.uvs)
  slab(out, add2(o, mul2(dir, r * 0.55)), along, r * 0.5, r * 0.4, y - r * 0.45, y + r * 0.05)
  return out
}

export function lionHouse(b, spec = {}) {
  const ring = mainRing(b), fr = frameOf(b, { faceDeg: spec.faceDeg ?? 180 }) // the long front faces the mall, south
  const eave = spec.eaveM ?? 9.5, bayH = spec.bayM ?? 6, hallW = Math.min(fr.W, spec.hallW ?? 20), pitch = ((spec.pitchDeg ?? 30) * Math.PI) / 180, over = 0.8
  const front = fr.v, along = mul2(fr.u, -1)
  // the hall: the main block from the back wall to hallW in front of it; the outline's bays project from its front, lower
  const hc = at(fr, 0, -fr.W / 2 + hallW / 2), hallRing = rectRing(hc, fr.u, fr.L - 0.5, hallW - 0.16)
  // the entrance on the front, at its centre (spec.entranceAt shifts it along the hall)
  const eo = at(fr, spec.entranceAt ?? 0), eReach = reach(ring, eo, front), ef = add2(eo, mul2(front, eReach))
  const halfDoor = spec.doorHalfM ?? 2.4, spring = spec.doorSpringM ?? 4.6, fw = 2 * halfDoor + 6.2
  const nearDoor = (p) => Math.abs((p[0] - ef[0]) * along[0] + (p[1] - ef[1]) * along[1]) < fw / 2 + 1.2
  const hall = masonryHall(hallRing, {
    eave, plinth: 0.9, belts: [spec.beltM ?? 3.0], cornice: 0.7, corniceProud: 0.35,
    windows: { spacing: spec.windowEveryM ?? 5.2, margin: 2.6, minEdge: 6, outline: roundHead(1.05, bayH + 0.6, eave - 2.4) },
    skip: nearDoor,
  })
  // the bays: the outline to bayH, a stone cornice, lower round-headed windows on their own walls
  const hallZone = rectRing(hc, fr.u, fr.L + 0.2, hallW + 0.4)
  const bays = masonryHall(ring, { eave: bayH, plinth: 0.9, belts: [], cornice: 0.5, corniceProud: 0.25 })
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a)), n = edgeNormal(ring, i), mid = mul2(add2(a, c), 0.5)
    if (L < 3 || pointInRing(sub2(mid, mul2(n, 0.6)), hallZone) && !pointInRing(add2(mid, mul2(n, 0.6)), hallZone) || nearDoor(mid)) continue
    const t = norm2(sub2(c, a)), k = Math.max(1, Math.floor((L - 2) / 3.4) + 1)
    for (let j = 0; j < k; j++) {
      const o = add2(a, mul2(t, k === 1 ? L / 2 : 1 + ((L - 2) * j) / (k - 1)))
      wallPolygon(bays.glass, o, t, n, roundHead(0.75, 1.7, bayH - 1.9), 0.05)
      slab(bays.sills, add2(o, mul2(n, 0.12)), t, 1.8, 0.26, 1.52, 1.7)
    }
  }
  // the hall's roof: hipped clay tile over the main block, with the glazed monitor along its ridge
  const rise = (hallW / 2 + over) * Math.tan(pitch)
  const roof = hipRoof(hc, fr.u, fr.L - 0.4, hallW, eave, rise, over)
  const ridgeY = eave + rise, monL = Math.max(8, (fr.L - hallW) * (spec.monitorFrac ?? 0.8)), monW = spec.monitorW ?? 4.2
  const monBase = ridgeY - (monW / 2 / (hallW / 2 + over)) * rise - 0.2, monTop = ridgeY + (spec.monitorH ?? 1.5)
  const monitor = slab(mesh(), hc, fr.u, monL, monW, monBase, monTop)
  const monitorRoof = hipRoof(hc, fr.u, monL, monW, monTop, 0.9, 0.35)
  const mullions = mesh(), nm = Math.round(monL / 1.6)
  for (let k = 0; k <= nm; k++) for (const sd of [-1, 1]) slab(mullions, add2(hc, add2(mul2(fr.u, -monL / 2 + (k * monL) / nm), mul2(fr.v, (sd * monW) / 2))), fr.u, 0.14, 0.12, monBase, monTop)
  // the great arched entrance: a raised brick frontispiece from the hall's front wall out to the entrance bay's face,
  // above the cornice; a dark round-headed opening in a stone archivolt with piers at its sides; a terra-cotta lion's
  // head either side
  const hallFront = -fr.W / 2 + hallW, depth = Math.max(1, eReach - hallFront + 0.4), fc = add2(ef, mul2(front, -depth / 2))
  const door = mesh(), arch = mesh(), front3 = mesh(), lions = mesh()
  slab(front3, fc, along, fw, depth, 0, eave + 2.2)
  const face = add2(ef, mul2(front, 0.01))
  wallPolygon(door, face, along, front, roundHead(halfDoor, 0, spring, 12), 0.05)
  archivolt(arch, face, along, front, halfDoor, 0.75, spring, 0.32, 14)
  for (const sd of [-1, 1]) slab(arch, add2(face, add2(mul2(along, sd * (halfDoor + 0.4)), mul2(front, 0.18))), along, 0.8, 0.36, 0, spring)
  slab(arch, fc, along, fw + 0.5, depth + 0.5, eave + 2.2, eave + 2.55) // its coping
  slab(arch, fc, along, fw + 0.5, depth + 0.5, eave - 0.7, eave) // the cornice carried across it
  slab(arch, fc, along, fw + 0.2, depth + 0.2, 0, 0.9) // and the water table
  for (const sd of [-1, 1]) lionHead(lions, add2(face, mul2(along, sd * (halfDoor + 2.0))), along, front, spring + 0.7, 0.85)
  return { replace: true, pieces: [], meshes: [
    P(into(mesh(), hall.walls, bays.walls, front3), F.brick, 'lp-brick-dark', 'walls'),
    P(bays.top, FLAT, 'lp-slate', 'flat-roof'),
    P(into(mesh(), hall.trim, bays.trim), F.stone, 'lp-limestone', 'trim'),
    P(into(mesh(), hall.glass, bays.glass), FLAT, 'gothic-shadow', 'windows'),
    P(into(mesh(), hall.sills, bays.sills), F.stone, 'lp-limestone', 'sills'),
    P(into(mesh(), roof, monitorRoof), F.stone, 'lp-tile-red', 'roof'),
    P(monitor, FLAT, 'lp-glass', 'monitor-glass'),
    P(mullions, FLAT, 'lp-copper', 'mullions'),
    P(door, FLAT, 'gothic-shadow', 'door'),
    P(arch, F.stone, 'lp-limestone', 'archivolt'),
    P(lions, F.stone, 'lp-tile-red', 'lions'),
  ] }
}

// ── Café Brauer (Dwight H. Perkins, 1908; B-3) ─ the South Pond refectory: Prairie School red brick under green tile
// hipped roofs with deep eaves — the two-storey Great Hall with its tall round-headed windows, a square pavilion at
// each end on the water, and the one-storey arcaded loggias joining them that curve round the pond's edge. The parts
// are traced from the OSM outline (spec.parts, local metres about the outline's bbox centre); heights approximate.
const bboxCentre = (ring) => { const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] }
export function cafeBrauer(b, spec = {}) {
  const ring = mainRing(b), cb = bboxCentre(ring)
  const walls = mesh(), trim = mesh(), glass = mesh(), sills = mesh(), roofs = mesh(), flat = mesh()
  for (const part of spec.parts ?? []) {
    const r = part.ring.map(([x, z]) => [cb[0] + x, cb[1] + z]), eave = part.eaveM
    const two = part.kind !== 'loggia'
    const open = part.kind === 'hall'
      ? [{ outline: roundHead(1.25, 5.4, eave - 2.6), spacing: 3.8 }, { outline: flatHead(1.0, 0.9, 3.5), spacing: 3.8 }]
      : part.kind === 'pavilion'
        ? [{ outline: roundHead(1.35, 0.0, 3.0), spacing: 3.4 }, { outline: roundHead(0.8, 5.0, eave - 2.2), spacing: 3.4 }]
        : [{ outline: roundHead(1.3, 0.0, 2.9), spacing: 3.2 }]
    const hall = masonryHall(r, { eave, plinth: 0.7, belts: two ? [4.5] : [], cornice: 0.45, corniceProud: 0.25, top: part.kind === 'loggia' })
    into(walls, hall.walls); into(trim, hall.trim)
    if (part.kind === 'loggia') { into(flat, hall.top); ringBand(trim, r, eave, eave + 0.9, -0.05) } // a flat roof behind a brick parapet with its coping
    for (const o of open) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], c = r[(i + 1) % r.length], L = len2(sub2(c, a))
        if (L < 3.2) continue
        const t = norm2(sub2(c, a)), n = edgeNormal(r, i), k = Math.max(1, Math.floor((L - 2) / o.spacing) + 1)
        for (let j = 0; j < k; j++) {
          const p = add2(a, mul2(t, k === 1 ? L / 2 : 1 + ((L - 2) * j) / (k - 1)))
          wallPolygon(glass, p, t, n, o.outline, 0.05)
          const y = Math.min(...o.outline.map((q) => q[1]))
          if (y > 0.5) slab(sills, add2(p, mul2(n, 0.1)), t, 2 * Math.max(...o.outline.map((q) => q[0])) + 0.3, 0.22, y - 0.16, y)
        }
      }
    }
    if (part.roof) {
      const ob = frameOf({ polygons: [{ outer: r }] }), rise = part.roof.rise, over = part.roof.over ?? 1.5
      into(roofs, hipRoof(ob.c, ob.u, ob.L, ob.W, eave, rise, over))
    }
  }
  return { replace: true, pieces: [], meshes: [
    P(walls, F.brick, 'lp-brick', 'walls'),
    P(trim, F.stone, 'lp-limestone', 'trim'),
    P(glass, FLAT, 'lp-window-lit', 'windows'),
    P(sills, F.stone, 'lp-limestone', 'sills'),
    P(roofs, F.stone, 'lp-tile-green', 'roof'),
    P(flat, FLAT, 'lp-slate', 'flat-roof'),
  ] }
}

// ── Nature Boardwalk (Studio Gang, 2010; B-3) ─ the People's Gas Education Pavilion on South Pond: bent laminated
// Douglas-fir ribs in a honeycomb lattice over a tortoise-shell vault, the cells along its crown filled with domed
// fibreglass pods; a timber deck under it; the boardwalk loop round the pond with its prairie fringe at the water.
// Plan from OSM (13.5 × 9.4 m, the 1,400 sq ft the sources give); the crown height is approximate.
export function honeycombVault({ c, u, L, span, H, cell = 1.25 }) {
  const v = [u[1], -u[0]]
  const S = (a, t) => {
    const k = Math.cos((Math.PI * a) / L), w = span * (0.78 + 0.22 * k), h = H * (0.72 + 0.28 * k)
    return [c[0] + u[0] * a + v[0] * (Math.cos(t) * w) / 2, h * Math.sin(t), c[1] + u[1] * a + v[1] * (Math.cos(t) * w) / 2]
  }
  const arc = (Math.PI * (span + 2 * H)) / 4, tOf = (y) => (y / arc) * Math.PI // the vault's half-perimeter, to keep the cells near-regular
  const ribs = mesh(), pods = mesh(), edges = new Map(), cells = []
  const R = cell, dx = 1.5 * R, dy = Math.sqrt(3) * R
  for (let i = -Math.ceil(L / dx); i <= Math.ceil(L / dx); i++) for (let j = -1; j <= Math.ceil(arc / dy) + 1; j++) {
    const cx = i * dx, cy = j * dy + (i % 2 ? dy / 2 : 0)
    const hex = Array.from({ length: 6 }, (_, k) => [cx + R * Math.cos((k * Math.PI) / 3), cy + R * Math.sin((k * Math.PI) / 3)])
    if (!hex.every(([x, y]) => Math.abs(x) <= L / 2 + 1e-6 && y >= 0 && y <= arc)) continue
    cells.push({ cx, cy, hex })
    for (let k = 0; k < 6; k++) {
      const p = hex[k], q = hex[(k + 1) % 6], key = [p, q].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).sort().join('|')
      if (!edges.has(key)) edges.set(key, [p, q])
    }
  }
  for (const [p, q] of edges.values()) tube(ribs, S(p[0], tOf(p[1])), S(q[0], tOf(q[1])), 0.11, 4)
  // pods: the cells along the crown, each a shallow dome pushed out from its hexagon (seen from above and below)
  const crown = cells.filter((h) => Math.abs(h.cy - arc / 2) < arc * 0.3)
  for (const h of crown) {
    const ctr = S(h.cx, tOf(h.cy)), up = [ctr[0] - (c[0] + u[0] * h.cx), ctr[1], ctr[2] - (c[1] + u[1] * h.cx)], l = Math.hypot(...up)
    const top = [ctr[0] + (up[0] / l) * 0.28, ctr[1] + (up[1] / l) * 0.28, ctr[2] + (up[2] / l) * 0.28]
    for (let k = 0; k < 6; k++) {
      const p = h.hex[k], q = h.hex[(k + 1) % 6], A = S(p[0], tOf(p[1])), B = S(q[0], tOf(q[1]))
      tri(pods, A, B, top, up); tri(pods, A, top, B, up.map((x) => -x))
    }
  }
  return { ribs, pods, cells: cells.length, edges: edges.size, crownCells: crown.length }
}
export function natureBoardwalk(b, spec = {}) {
  const fr = frameOf(b), H = spec.heightM ?? 5.5
  const vault = honeycombVault({ c: fr.c, u: fr.u, L: fr.L, span: fr.W, H, cell: spec.cellM ?? 1.25 })
  const deck = slab(mesh(), fr.c, fr.u, fr.L + 1.2, fr.W + 0.8, 0, 0.3)
  const walk = mesh(), fringe = mesh()
  // the boardwalk loop: a timber deck 2.4 m wide, set 2 m back from the water, with the prairie planting between
  const pond = (spec.pondWaterId ? siteWater(spec.pondWaterId) : []).reduce((a, w) => (!a || Math.abs(polyArea(w.outer)) > Math.abs(polyArea(a.outer)) ? w : a), null)
  if (pond) {
    const skip = (spec.skipNear ?? []).map((q) => ({ c: project(q.lon, q.lat), r: q.r }))
    const band = (out, r0, r1, y) => {
      const A = offsetRing(pond.outer, r0), B = offsetRing(pond.outer, r1)
      for (let i = 0; i < A.length; i++) {
        const j = (i + 1) % A.length
        if (skip.some((q) => len2(sub2(A[i], q.c)) < q.r)) continue // the hard terraces (Café Brauer's) are not boardwalk
        quad(out, at3(A[i], y), at3(A[j], y), at3(B[j], y), at3(B[i], y), [0, 1, 0])
        quad(out, at3(B[i], y - 0.3), at3(B[j], y - 0.3), at3(B[j], y), at3(B[i], y), [B[i][0] - A[i][0], 0, B[i][1] - A[i][1]])
      }
    }
    band(walk, 2.0, 4.4, 0.34)
    band(fringe, 0.25, 2.0, 0.55)
  }
  return { replace: true, pieces: [], meshes: [
    P(vault.ribs, FLAT, 'boardwalk-wood', 'ribs'),
    P(vault.pods, FLAT, 'lp-pod', 'pods'),
    P(merge(deck, walk), FLAT, 'bp-deck-wood', 'deck'),
    P(fringe, FLAT, 'lp-prairie', 'prairie'),
  ], clear: [rectRing(fr.c, fr.u, fr.L + 4, fr.W + 3)] }
}

// ── The zoo's other houses (B-4) ─────────────────────────────────────────────────────────────────────────────────────
// A brick house on its OSM outline (the Helen Brach Primate House, 1927, Georgian; the McCormick Bird House, 1904; the
// administration building): walls to the eave, stone courses, a hipped roof over the main block (spec.roofStyle), an
// optional glazed monitor along the ridge, windows (round-headed or flat with white frames), and an optional columned
// portico with a pediment on the face spec.portico.faceDeg looks toward.
export function brickHouse(b, spec = {}) {
  const ring = mainRing(b), fr = frameOf(b), eave = spec.eaveM ?? 8, wallStyle = spec.wallStyle ?? 'lp-brick'
  const win = spec.windows === 'flat' ? flatHead(0.9, 1.4, eave - 2.2) : spec.windows === 'arcade' ? roundHead(spec.archHalfM ?? 1.6, 0.0, spec.archSpringM ?? eave - 3.0, 10) : roundHead(1.0, 1.6, eave - 3.0)
  let pf = spec.portico ? frameOf(b, { faceDeg: spec.portico.faceDeg }) : null
  let pOut = pf ? pf.v : null, pFace = pf ? add2(pf.c, mul2(pOut, reach(ring, pf.c, pOut))) : null
  if (pf && spec.portico.at) {
    // on the wall nearest the given point (local to the outline's bbox centre): its foot, outward normal and run
    const q = add2(bboxCentre(ring), spec.portico.at)
    let best = null
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], d = sub2(c, a), l2 = d[0] * d[0] + d[1] * d[1]
      const t = Math.max(0.1, Math.min(0.9, ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / l2)), f = add2(a, mul2(d, t)), dist = len2(sub2(q, f))
      if (!best || dist < best.dist) best = { dist, f, n: edgeNormal(ring, i), t: norm2(d) }
    }
    pFace = best.f; pOut = best.n; pf = { ...pf, u: mul2([-best.n[1], best.n[0]], -1), v: best.n }
  }
  const pSpan = spec.portico?.spanM ?? 9
  const rows = spec.windows === 'flat' ? (spec.windowRows ?? [[1.4, eave - 2.2]]) : null
  const hall = masonryHall(ring, { eave, plinth: 0.8, belts: spec.beltM ? [spec.beltM] : [], cornice: 0.6, corniceProud: 0.3, windows: rows ? null : { spacing: spec.windowEveryM ?? 4, margin: 2, minEdge: 5, outline: win }, skip: (p) => pFace && len2(sub2(p, pFace)) < pSpan / 2 + 1 })
  const rise = spec.roofRiseM ?? Math.min(fr.W / 2, 9) * 0.55, over = spec.overM ?? 0.7
  const flatRoof = spec.roof === 'flat', trim = hall.trim, frames = mesh(), portico = mesh()
  const brg = (d) => [Math.sin((d * Math.PI) / 180), -Math.cos((d * Math.PI) / 180)], cb = bboxCentre(ring)
  // a roof per block when the outline is not one rectangle (spec.roofs: local to the outline's bbox centre)
  const roof = flatRoof ? hall.top : spec.roofs ? into(mesh(), ...spec.roofs.map((r) => hipRoof(add2(cb, r.at), brg(r.bearingDeg), r.L, r.W, eave, r.rise ?? rise, over))) : hipRoof(fr.c, fr.u, fr.L, fr.W, eave, rise, over)
  if (flatRoof) ringBand(trim, ring, eave, eave + (spec.parapetM ?? 1.0), -0.05, 0.4) // the parapet and its coping
  if (rows) {
    // flat-headed windows in white frames (jambs, a transom, a stone lintel and sill), one band per storey row
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a))
      if (L < 5) continue
      const t = norm2(sub2(c, a)), n = edgeNormal(ring, i), k = Math.max(1, Math.floor((L - 4) / (spec.windowEveryM ?? 4)) + 1)
      for (let j = 0; j < k; j++) {
        const o = add2(a, mul2(t, k === 1 ? L / 2 : 2 + ((L - 4) * j) / (k - 1)))
        if (pFace && len2(sub2(o, pFace)) < pSpan / 2 + 1) continue
        const f = add2(o, mul2(n, 0.07))
        for (const [y0, y1] of rows) {
          wallPolygon(hall.glass, o, t, n, flatHead(0.9, y0, y1), 0.05)
          for (const [s, z0, z1, w] of [[-0.95, y0, y1, 0.12], [0.95, y0, y1, 0.12], [0, (y0 + y1) / 2 - 0.05, (y0 + y1) / 2 + 0.05, 1.9]]) slab(frames, add2(f, mul2(t, s)), t, w, 0.08, z0, z1)
          slab(frames, add2(o, mul2(n, 0.12)), t, 2.3, 0.24, y1, y1 + 0.4) // the lintel
          slab(hall.sills, add2(o, mul2(n, 0.12)), t, 2.2, 0.26, y0 - 0.18, y0)
        }
      }
    }
  }
  let monitor = null
  if (spec.monitor) {
    const mL = Math.max(6, (fr.L - fr.W) * 0.7), mW = spec.monitor.widthM ?? 3.6, ridge = eave + rise
    monitor = slab(mesh(), fr.c, fr.u, mL, mW, ridge - 0.9, ridge + (spec.monitor.heightM ?? 1.2))
    into(roof, hipRoof(fr.c, fr.u, mL, mW, ridge + (spec.monitor.heightM ?? 1.2), 0.7, 0.3))
  }
  if (pf) {
    // the portico: columns on a stone stylobate, an entablature and a pediment, against the front wall
    const along = mul2(pf.u, -1), n = spec.portico.columns ?? 4, depth = spec.portico.depthM ?? 3.2, colH = eave - 1.4
    slab(portico, add2(pFace, mul2(pOut, depth / 2)), along, pSpan + 1.2, depth + 0.6, 0, 0.6)
    for (let k = 0; k < n; k++) column(portico, add2(pFace, add2(mul2(along, -pSpan / 2 + (pSpan * k) / (n - 1)), mul2(pOut, depth - 0.5))), 0.6, colH, 0.38, 12)
    slab(portico, add2(pFace, mul2(pOut, depth / 2)), along, pSpan + 1.0, depth + 0.2, colH, eave)
    pediment(portico, add2(pFace, mul2(pOut, -0.1)), along, pOut, pSpan + 1.0, depth + 0.3, eave, spec.portico.pedimentM ?? 2.2)
    wallPolygon(portico, pFace, along, pOut, flatHead(1.3, 0.6, 3.8), 0.04) // the door, in shadow under the portico
  }
  return { replace: true, pieces: [], meshes: [
    P(hall.walls, F.brick, wallStyle, 'walls'),
    P(trim, F.stone, 'lp-limestone', 'trim'),
    P(hall.glass, FLAT, 'gothic-shadow', 'windows'),
    P(hall.sills, F.stone, 'lp-limestone', 'sills'),
    P(frames, FLAT, 'lp-trim-white', 'frames'),
    P(roof, spec.roofStyle === 'lp-slate' ? FLAT : F.stone, spec.roofStyle ?? 'lp-slate', 'roof'),
    ...(monitor ? [P(monitor, FLAT, 'lp-glass', 'monitor-glass')] : []),
    ...(pf ? [P(portico, F.stone, 'lp-trim-white', 'portico')] : []),
  ] }
}

// A modern zoo building on its OSM outline (the Regenstein houses, the Children's Zoo, the hospital, the visitor
// centre): walls in its material to the eave, a glass band, a planted or membrane roof with skylights, and an optional
// glass dome (the Small Mammal–Reptile House's 45 ft rain-forest dome) or a sawtooth of north lights.
export function modernPavilion(b, spec = {}) {
  const ring = mainRing(b), fr = frameOf(b), eave = spec.eaveM ?? 7, meshes = []
  const p = prism(ring, 0, eave), roofTop = mesh(), glass = mesh(), coping = mesh(), sky = mesh()
  into(roofTop, p.top)
  ringBand(coping, ring, eave - 0.05, eave + 0.45, 0.12)
  const gb = spec.glassBand // [y0, y1]: a continuous glazed band round the walls (mullions in steel)
  const mull = mesh()
  if (gb) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a))
    if (L < 2) continue
    const t = norm2(sub2(c, a)), n = edgeNormal(ring, i)
    wallPolygon(glass, add2(add2(a, mul2(t, L / 2)), [0, 0]), t, n, [[-L / 2 + 0.6, gb[0]], [L / 2 - 0.6, gb[0]], [L / 2 - 0.6, gb[1]], [-L / 2 + 0.6, gb[1]]], 0.04)
    for (let s = 0.6; s <= L - 0.6; s += 1.8) slab(mull, add2(add2(a, mul2(t, s)), mul2(n, 0.08)), t, 0.1, 0.1, gb[0], gb[1])
  }
  // skylights: glazed boxes on the roof, along the long axis
  for (let k = 0; k < (spec.skylights ?? 0); k++) {
    const a = -fr.L / 2 + ((k + 0.5) * fr.L) / spec.skylights
    const at0 = add2(fr.c, mul2(fr.u, a))
    if (!pointInRing(at0, ring)) continue
    into(sky, hipRoof(at0, fr.v, Math.min(5, fr.W * 0.4), Math.min(3, fr.L / spec.skylights - 1), eave + 0.3, 1.1, 0))
  }
  if (spec.dome) {
    const r = spec.dome.r, c = spec.dome.at ? at(fr, ...spec.dome.at) : fr.c, top = spec.dome.topM
    const prof = Array.from({ length: 9 }, (_, k) => { const a = (k / 8) * (Math.PI / 2); return [Math.max(0.05, r * Math.cos(a)), eave + (top - eave) * Math.sin(a)] })
    const d = bellRoof(c, fr.u, 0, prof, { K: 2, M: 14, purlins: [2, 5] })
    into(sky, d.glass); meshes.push(P(d.ribs, FLAT, 'lp-steel', 'mullions'))
  }
  meshes.push(
    P(p.walls, spec.wallFacade === 'brick' ? F.brick : spec.wallFacade === 'stone' ? F.stone : FLAT, spec.wallStyle ?? 'lp-rock', 'walls'),
    P(roofTop, FLAT, spec.roofStyle ?? 'lp-green-roof', 'roof'),
    P(coping, FLAT, spec.copingStyle ?? 'lp-steel', 'coping'),
  )
  if (glass.positions.length) meshes.push(P(glass, FLAT, 'lp-glass', 'windows'), P(mull, FLAT, 'lp-steel', 'mullions'))
  if (sky.positions.length) meshes.push(P(sky, FLAT, 'lp-glasshouse', 'skylights'))
  return { replace: true, pieces: [], meshes }
}

// An open-air habitat under mesh (the Regenstein Birds of Prey aviaries, the Macaque Forest): steel posts round the
// outline and a stainless mesh skin over a gabled frame — the grid façade draws the mesh as open lattice.
export function meshHabitat(b, spec = {}) {
  const ring = mainRing(b), fr = frameOf(b), h = spec.heightM ?? 6, ridge = h + (spec.ridgeM ?? 2.5)
  const posts = mesh(), skin = mesh()
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a)), t = norm2(sub2(c, a)), k = Math.max(1, Math.round(L / 3))
    for (let j = 0; j < k; j++) tube(posts, at3(add2(a, mul2(t, (j * L) / k)), 0), at3(add2(a, mul2(t, (j * L) / k)), h), 0.09, 6)
  }
  const pr = prism(ring, 0, h, { top: false }), g = gableRoof(fr.c, fr.u, fr.L, fr.W, h, ridge - h, 0)
  into(skin, pr.walls, g.roof, g.gables)
  tube(posts, at3(add2(fr.c, mul2(fr.u, -fr.L / 2)), ridge), at3(add2(fr.c, mul2(fr.u, fr.L / 2)), ridge), 0.1, 6)
  return { replace: true, pieces: [], meshes: [P(posts, FLAT, 'lp-steel', 'posts'), P(skin, F.grid, 'lp-mesh', 'mesh')] }
}

// Pritzker Penguin Cove (2016, after Boulders Beach): granite-like rock outcrops round a pool with an underwater
// viewing window, on the outline (the rock is the building).
export function rockHabitat(b, spec = {}) {
  const ring = mainRing(b), fr = frameOf(b), rock = mesh(), pool = mesh(), glass = mesh()
  let k = 0
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  // boulders: a ring of irregular blocks round the outline's edge, stepping down toward the pool
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = len2(sub2(c, a)), t = norm2(sub2(c, a)), n = edgeNormal(ring, i)
    for (let s = 0; s < L; s += 2.2) {
      const h = (spec.rockM ?? 3.2) * (0.5 + 0.6 * rnd(++k)), w = 1.8 + rnd(++k) * 0.9, d = 1.6 + rnd(++k) * 0.8
      const o = add2(add2(a, mul2(t, Math.min(s + 1, L - 1))), mul2(n, -d / 2 - 0.4))
      slab(rock, o, norm2(add2(t, mul2(n, (rnd(++k) - 0.5) * 0.3))), w, d, 0, h)
    }
  }
  const inner = offsetRing(ring, -2.6)
  if (Math.abs(polyArea(inner)) > 4) { const p = prism(inner, 0, 0.45); into(pool, p.top); into(glass, p.walls) }
  return { replace: true, pieces: [], meshes: [P(rock, F.stone, 'lp-rock', 'rock'), P(pool, FLAT, 'lp-pool', 'pool'), P(glass, FLAT, 'lp-glass', 'windows')] }
}

// A Farm-in-the-Zoo barn: red board walls with white corner boards, a gambrel (or gable) roof in dark shingle over
// each spec.roofs block, the big doors with their white cross-bracing on the gable ends, a ventilator cupola on the
// ridge, and the silo where the outline has one. Roof blocks are local to the outline's bbox centre.
export function barn(b, spec = {}) {
  const ring = mainRing(b), cb = bboxCentre(ring), eave = spec.eaveM ?? 4.6
  const walls = prism(ring, 0, eave), white = mesh(), roof = mesh(), gables = mesh(), doors = mesh(), silo = mesh(), siloCap = mesh()
  for (const p of ring) slab(white, p, [1, 0], 0.3, 0.3, 0, eave) // corner boards
  ringBand(white, ring, eave - 0.25, eave, 0.08)
  const f0 = frameOf(b), blocks = spec.roofs ?? [{ at: sub2(f0.c, cb), L: f0.L, W: f0.W, bearingDeg: (Math.atan2(f0.u[0], -f0.u[1]) * 180) / Math.PI }]
  for (const r of blocks) {
    const c = [cb[0] + r.at[0], cb[1] + r.at[1]], u = r.bearingDeg != null ? [Math.sin((r.bearingDeg * Math.PI) / 180), -Math.cos((r.bearingDeg * Math.PI) / 180)] : r.alongZ ? [0, 1] : [1, 0], L = r.L, W = r.W
    const g = (r.kind ?? spec.roof ?? 'gambrel') === 'gambrel' ? gambrelRoof(c, u, L, W, eave, W * 0.3, W * 0.42, { kneeIn: 0.18, over: 0.4 }) : gableRoof(c, u, L, W, eave, W * 0.36, 0.5)
    into(roof, g.roof); into(gables, g.gables)
    // the doors on each gable end: dark red boards in a white frame with the white X
    for (const e of [-1, 1]) {
      const o = add2(c, mul2(u, (e * L) / 2)), dir = mul2(u, e), al = [-u[1], u[0]], dw = Math.min(3.6, W * 0.35)
      wallPolygon(doors, o, al, dir, flatHead(dw / 2, 0, 3.6), 0.06)
      for (const [s, y0, y1, w] of [[-dw / 2, 0, 3.7, 0.16], [dw / 2, 0, 3.7, 0.16], [0, 3.6, 3.76, dw + 0.16]]) slab(white, add2(add2(o, mul2(al, s)), mul2(dir, 0.09)), al, w, 0.06, y0, y1)
      // the X: two thin bars corner to corner
      const P0 = add2(add2(o, mul2(al, -dw / 2)), mul2(dir, 0.1)), P1 = add2(add2(o, mul2(al, dw / 2)), mul2(dir, 0.1))
      tube(white, at3(P0, 0.1), at3(P1, 3.5), 0.07, 4); tube(white, at3(P1, 0.1), at3(P0, 3.5), 0.07, 4)
      wallPolygon(doors, add2(o, mul2(dir, 0.01)), al, dir, flatHead(0.7, eave + 0.6, eave + 2.0), 0.06) // the hay door above
    }
    if (r.cupola) { const top = eave + W * 0.42; into(white, slab(mesh(), c, u, 1.6, 1.6, top - 0.4, top + 1.3)); into(roof, hipRoof(c, u, 1.6, 1.6, top + 1.3, 1.0, 0.3)); tube(white, at3(c, top + 2.3), at3(c, top + 3.4), 0.04, 4) }
  }
  if (spec.silo) {
    const c = [cb[0] + spec.silo.at[0], cb[1] + spec.silo.at[1]], r = spec.silo.r, h = spec.silo.heightM
    into(silo, revolve(c, [[r, 0], [r, h]], { sides: 20 }))
    for (let y = 1.5; y < h; y += 1.5) into(white, revolve(c, [[r + 0.05, y], [r + 0.05, y + 0.12]], { sides: 20 })) // the hoops
    into(siloCap, revolve(c, [[r + 0.15, h], [r * 0.8, h + r * 0.55], [r * 0.4, h + r * 0.85], [0.05, h + r * 0.95]], { sides: 20 }))
  }
  return { replace: true, pieces: [], meshes: [
    P(into(mesh(), walls.walls, gables), FLAT, 'lp-barn-red', 'walls'),
    P(white, FLAT, 'lp-trim-white', 'trim'),
    P(doors, FLAT, 'gothic-shadow', 'doors'),
    P(roof, FLAT, 'lp-slate', 'roof'),
    ...(spec.silo ? [P(silo, FLAT, 'lp-barn-red', 'silo'), P(siloCap, FLAT, 'lp-copper', 'silo-cap')] : []),
  ] }
}

// The Kovler Sea Lion Pool: a free-form pool with rockwork shores, a rock haul-out island, and the curved underwater
// viewing gallery on its south side (synthetic anchor at the pool's centre; plan approximate).
export function seaLionPool(b, spec = {}) {
  const c = b.centroid, rx = spec.rxM ?? 17, rz = spec.rzM ?? 12, N = 40, outline = []
  for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2, w = 1 + 0.08 * Math.sin(3 * a) + 0.05 * Math.cos(5 * a); outline.push([c[0] + rx * w * Math.cos(a), c[1] + rz * w * Math.sin(a)]) }
  const water = prism(outline, 0.15, 0.4).top, rock = mesh(), glass = mesh(), wall = mesh()
  let k = 0
  const rnd = (i) => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x) }
  for (let i = 0; i < N; i++) {
    const a = outline[i], q = outline[(i + 1) % N], t = norm2(sub2(q, a)), n = edgeNormal(outline, i)
    const south = n[1] > 0.55 // the viewing gallery's glass on the south shore
    if (south) { wallPolygon(glass, a, t, n, [[0, -0.2], [len2(sub2(q, a)), -0.2], [len2(sub2(q, a)), 1.1], [0, 1.1]], 0.02); slab(wall, add2(mul2(add2(a, q), 0.5), mul2(n, 0.4)), t, len2(sub2(q, a)) + 0.1, 0.8, 0, 1.25); continue }
    slab(rock, add2(mul2(add2(a, q), 0.5), mul2(n, 0.9)), t, len2(sub2(q, a)) + 0.6, 1.8 + rnd(++k), 0, 0.8 + 1.4 * rnd(++k))
  }
  for (let i = 0; i < 6; i++) slab(rock, add2(c, [(rnd(++k) - 0.5) * rx * 0.5, (rnd(++k) - 0.5) * rz * 0.4]), norm2([rnd(++k) - 0.5, rnd(++k) - 0.5]), 2 + 2 * rnd(++k), 1.5 + rnd(++k), 0, 1.2 + 1.5 * rnd(++k))
  return { replace: true, pieces: [], clear: [outline], meshes: [P(water, FLAT, 'lp-pool', 'water'), P(rock, F.stone, 'lp-rock', 'rock'), P(wall, F.stone, 'lp-limestone', 'gallery'), P(glass, FLAT, 'lp-glass', 'windows')] }
}

// The AT&T Endangered Species Carousel: forty-eight carved endangered animals on a turntable under a round, open
// pavilion — a ring of slender columns carrying a shallow conical roof with a lantern and its flag.
export function carousel(b, spec = {}) {
  const fr = frameOf(b), c = fr.c, R = spec.radiusM ?? Math.min(fr.L, fr.W) / 2 - 1, eave = spec.eaveM ?? 4.6
  const cols = mesh(), roof = mesh(), deck = mesh(), animals = mesh(), lantern = mesh()
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, p = add2(c, [R * Math.cos(a), R * Math.sin(a)]); tube(cols, at3(p, 0), at3(p, eave), 0.16, 8) }
  into(roof, revolve(c, [[R + 1.2, eave], [R + 1.2, eave + 0.4], [R * 0.25, eave + R * 0.38], [R * 0.25, eave + R * 0.38 + 0.01]], { sides: 32 }))
  into(roof, revolve(c, [[R + 1.2, eave], [0.001, eave]], { sides: 32 })) // the ceiling
  into(lantern, revolve(c, [[R * 0.25, eave + R * 0.38], [R * 0.25, eave + R * 0.38 + 1.6], [0.001, eave + R * 0.38 + 2.6]], { sides: 16 }))
  tube(lantern, at3(c, eave + R * 0.38 + 2.6), at3(c, eave + R * 0.38 + 4.2), 0.05, 4)
  const rr = R * 0.82
  into(deck, revolve(c, [[rr, 0], [rr, 0.5], [0.001, 0.5]], { sides: 32 }))
  tube(deck, at3(c, 0.5), at3(c, eave), rr * 0.18, 12) // the centre column with its mirrors and organ
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, p = add2(c, [rr * 0.78 * Math.cos(a), rr * 0.78 * Math.sin(a)]), t = [-Math.sin(a), Math.cos(a)]
    tube(animals, at3(p, 0.5), at3(p, eave - 0.2), 0.03, 4) // the brass pole
    tube(animals, at3(add2(p, mul2(t, -0.6)), 1.4 + 0.3 * (k % 2)), at3(add2(p, mul2(t, 0.6)), 1.4 + 0.3 * (k % 2)), 0.28, 6) // the animal
  }
  return { replace: true, pieces: [], meshes: [P(cols, FLAT, 'lp-trim-white', 'columns'), P(roof, FLAT, 'lp-copper', 'roof'), P(lantern, FLAT, 'lp-trim-white', 'lantern'), P(deck, FLAT, 'bp-deck-wood', 'deck'), P(animals, FLAT, 'gate-gold', 'animals')] }
}

export const ZOO_BUILDERS = { lionHouse, cafeBrauer, natureBoardwalk, brickHouse, modernPavilion, meshHabitat, rockHabitat, barn, seaLionPool, carousel }

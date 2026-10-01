// pipeline/lib/zoo.js — Lincoln Park Zoo (Workstream B): the zoo's builders, split out of civic.js (B-1) so the park's
// landscape (lincolnpark.js) and the zoo grow apart. Sources, anchors and every number in heroes.json (Lincoln Park
// block); dimensions read from photographs are marked approximate there.
//   Kovler Lion House (Perkins, Fellows & Hamilton, 1912): a long hall of decorative tapestry brick under a hipped clay
//     tile roof with a glazed monitor along its ridge (daylight for the cages), tall round-headed windows, lower bays
//     on the mall front, and the great arched entrance flanked by terra-cotta lions' heads.
import { mesh, merge, slab, add2, mul2, sub2, len2, norm2, revolve, tube, tri, quad, at3 } from './meshkit.js'
import { wallPolygon } from './icons.js'
import { pointInRing } from './geom.js'
import { frameOf, at, rectRing, hipRoof, masonryHall, roundHead, flatHead, archivolt, edgeNormal, into, ringBand, offsetRing, siteWater } from './parkkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'
// a flat styled colour that stays dark at night (the paint façade, 12, glows after dark like a floodlit field)
const FLAT = F.steel
import { project } from '../../shared/project.js'

// close-range detail stays out of LOD1 (the size budget); the silhouette parts draw at every distance
const FINE = new Set(['trim', 'windows', 'sills', 'archivolt', 'door', 'lions', 'monitor-glass', 'mullions', 'lettering', 'pods', 'prairie'])
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

export const ZOO_BUILDERS = { lionHouse, cafeBrauer, natureBoardwalk }

// pipeline/lib/fulton.js — Fulton Market's Gensler pair on North Green Street (P4 user request), modelled from photos
// and sources (heroes.json carries the URLs):
//   333 North Green ("Gr333n", 2020, 19 storeys, 87.8 m — Flexport Chicago's office): a dark kinetic-wall garage podium
//     over a glass retail base, an open column level, then two deep-blue glass masses wrapped in a bold black grid
//     (each cell two storeys tall), the smaller two floors lower, joined by a recessed glass connector; a sky deck.
//   360 North Green (2024, 24 storeys, 122 m — BCG's Chicago office): a pale silver garage podium, an open level of
//     dark V-trusses, then two offset silver-blue glass bars either side of a dark core, the taller with a dark
//     mechanical crown; stacks of inlaid balconies at the bar ends.
import { convexHull } from './venue.js'
import { orientedBox } from './sacred.js'
import { add2, mul2, left, mesh, merge, tube, slab } from './meshkit.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

const CURTAIN = 3 // façade family 'curtain-glass' (its window pattern, recoloured by the style row)
const P = (m, facade, style, part, seed = 0.5) => ({ mesh: m, facade, seed, style, part })
const frameOf = (b) => { const ob = orientedBox(convexHull(b.polygons.flatMap((p) => p.outer))); return { ...ob, v: left(ob.u) } }
const at = (f, a, c) => add2(add2(f.c, mul2(f.u, a)), mul2(f.v, c)) // a along the long axis, c across it

// the bold grid: a vertical every `bay` metres and a horizontal every `every` metres, 0.45 m proud of the glass
function gridFrame(out, f, cu, L, W, y0, y1, { bay = 6, every = 8.4, d = 0.45, w = 0.55 } = {}) {
  const faces = [[L, W, f.u, f.v], [W, L, f.v, mul2(f.u, -1)]]
  for (const [len, dep, along, nrm] of faces) {
    for (const side of [-1, 1]) {
      const c0 = add2(add2(f.c, mul2(f.u, cu)), mul2(nrm, side * (dep / 2 + d / 2)))
      for (let a = -len / 2; a <= len / 2 + 1e-6; a += len / Math.max(1, Math.round(len / bay))) slab(out, add2(c0, mul2(along, a)), along, w, d, y0, y1)
      for (let y = y0; y <= y1 + 1e-6; y += every) slab(out, c0, along, len + w, d, Math.min(y, y1) - w / 2, Math.min(y, y1) + w / 2)
    }
  }
}

export function gr333n(b, spec = {}) {
  const f = frameOf(b), L = Math.min(f.L, 80), W = Math.min(f.W, 60)
  const podTop = spec.podiumM ?? 26, gap = spec.gapM ?? 5, top = spec.heightM ?? 87.8, lower = spec.lowerM ?? 80.6
  const meshes = []
  // podium: retail glass at the street, the dark shimmering kinetic wall over the garage
  meshes.push(P(slab(mesh(), f.c, f.u, L, W, 0, 9), CURTAIN, 'gr333n-storefront', 'storefront'))
  meshes.push(P(slab(mesh(), f.c, f.u, L, W, 9, podTop), F.grid, 'kinetic-wall', 'kinetic-wall'))
  // the open column level, set back in shadow
  meshes.push(P(slab(mesh(), f.c, f.u, L - 6, W - 6, podTop, podTop + gap), F.paint, 'gr333n-shadow', 'amenity'))
  // two masses and the glass connector between them
  const aW = L * 0.5, bW = L * 0.37, cW = L - aW - bW, y0 = podTop + gap
  const ac = -L / 2 + aW / 2, bc = L / 2 - bW / 2, cc = -L / 2 + aW + cW / 2
  const glass = merge(slab(mesh(), at(f, ac, 0), f.u, aW, W * 0.86, y0, top), slab(mesh(), at(f, bc, W * 0.08), f.u, bW, W * 0.72, y0, lower), slab(mesh(), at(f, cc, 0), f.u, cW + 0.4, W * 0.55, y0, top - 3.5))
  meshes.push(P(glass, CURTAIN, 'gr333n-glass', 'tower'))
  const grid = mesh()
  gridFrame(grid, f, ac, aW, W * 0.86, y0, top)
  gridFrame(grid, { ...f, c: at(f, 0, W * 0.08) }, bc, bW, W * 0.72, y0, lower)
  meshes.push(P(grid, F.paint, 'gr333n-frame', 'frame'))
  // the sky deck: a glass rail around the taller mass's roof, and a small stair/lift penthouse
  const deck = mesh()
  for (const [dx, dz, len, along] of [[0, W * 0.43, aW - 1, f.u], [0, -W * 0.43, aW - 1, f.u], [aW / 2 - 0.5, 0, W * 0.86, f.v], [-aW / 2 + 0.5, 0, W * 0.86, f.v]]) slab(deck, at(f, ac + dx, dz), along, len, 0.15, top, top + 1.1)
  meshes.push(P(deck, CURTAIN, 'gr333n-storefront', 'sky-deck'))
  meshes.push(P(slab(mesh(), at(f, ac + aW * 0.25, -W * 0.2), f.u, 8, 7, top, top + 3.6), F.paint, 'gr333n-frame', 'penthouse'))
  // Flexport's floor (the 12th): a fine line of Flexport blue around the taller mass, lit after dark
  const fy = y0 + (spec.flexportFloorFromTowerBase ?? 4) * 4.2
  meshes.push(P(slab(mesh(), at(f, ac, 0), f.u, aW + 1.1, W * 0.86 + 1.1, fy, fy + 0.35), F.signal, 'flexport-blue', 'flexport'))
  return { replace: true, pieces: [], meshes }
}

export function greenTower360(b, spec = {}) {
  const f = frameOf(b), L = Math.min(f.L, 80), W = Math.min(f.W, 44)
  const podTop = spec.podiumM ?? 22, trussTop = podTop + (spec.trussM ?? 8), top = spec.heightM ?? 122, crown = spec.crownM ?? 7, lowerTop = spec.lowerM ?? 110
  const meshes = []
  meshes.push(P(slab(mesh(), f.c, f.u, L, W, 0, 6), CURTAIN, 'bcg-storefront', 'storefront'))
  meshes.push(P(slab(mesh(), f.c, f.u, L, W, 6, podTop), F.stone, 'bcg-podium', 'podium'))
  // two offset bars either side of the dark core
  const barW = W * 0.4, coreW = W - 2 * barW, off = spec.offsetM ?? 7
  // the transfer level (user fix): "two rows of V-shaped trusses integrated into the parking podium" (Chicago YIMBY),
  // one row under each bar. Each is a closed frame held inside its bar's footprint — a top chord flush with the bar's
  // underside all round, a bottom chord on the podium roof, a post at each corner — with the Vs along the bar's outer
  // face. Members are inset by their radius, so nothing reaches past the podium or the tower above it.
  meshes.push(P(slab(mesh(), f.c, f.u, L - 8, W - 8, podTop, trussTop), F.paint, 'bcg-truss', 'truss-recess'))
  const truss = mesh(), R = 0.45, Rc = 0.4
  let posts = 0
  for (const side of [-1, 1]) {
    const ac = side * off / 2, cc = side * (coreW + barW) / 2, half = (L - off) / 2 - R, hc = barW / 2 - R
    const outerC = cc + side * hc, yb = podTop + Rc, yt = trussTop - Rc
    const corner = (a, c, y) => { const p = at(f, ac + a, c); return [p[0], y, p[1]] }
    const ring = [[-half, cc - hc], [half, cc - hc], [half, cc + hc], [-half, cc + hc]]
    for (let k = 0; k < 4; k++) {
      const [a0, c0] = ring[k], [a1, c1] = ring[(k + 1) % 4]
      tube(truss, corner(a0, c0, yt), corner(a1, c1, yt), Rc, 6) // top chord, all round under the bar's edge
      tube(truss, corner(a0, c0, podTop), corner(a0, c0, trussTop), R, 6); posts++ // the corner post
    }
    tube(truss, corner(-half, outerC, yb), corner(half, outerC, yb), Rc, 6) // bottom chord along the outer face
    const n = Math.max(3, Math.round((2 * half) / 13))
    for (let i = 0; i < n; i++) {
      const a0 = -half + (2 * half * (i + 0.5)) / n, h = half / n
      tube(truss, corner(a0, outerC, yb), corner(a0 - h, outerC, yt), R, 6)
      tube(truss, corner(a0, outerC, yb), corner(a0 + h, outerC, yt), R, 6)
    }
  }
  meshes.push(Object.assign(P(truss, F.paint, 'bcg-truss', 'v-truss'), { posts }))
  const bar1 = slab(mesh(), at(f, -off / 2, -(coreW + barW) / 2), f.u, L - off, barW, trussTop, top - crown)
  const bar2 = slab(mesh(), at(f, off / 2, (coreW + barW) / 2), f.u, L - off, barW, trussTop, lowerTop)
  meshes.push(P(merge(bar1, bar2), CURTAIN, 'bcg-glass', 'tower'))
  meshes.push(P(slab(mesh(), f.c, f.u, L - off - 6, coreW + 0.4, trussTop, lowerTop - 6), F.paint, 'bcg-core', 'core'))
  meshes.push(P(slab(mesh(), at(f, -off / 2, -(coreW + barW) / 2), f.u, (L - off) * 0.92, barW * 0.92, top - crown, top), F.paint, 'bcg-core', 'crown'))
  // the inlaid balconies: in the gap between the bars at both ends of the core, a terrace slab on every floor
  const balc = mesh()
  for (const end of [-1, 1]) for (let y = trussTop + 4.2; y < lowerTop - 2; y += 4.2) slab(balc, at(f, end * (L / 2 - off / 2 - 4), 0), f.u, 6, coreW + 0.2, y - 0.3, y)
  meshes.push(P(balc, F.paint, 'bcg-podium', 'balconies'))
  return { replace: true, pieces: [], meshes }
}

export const FULTON_BUILDERS = { gr333n, greenTower360 }

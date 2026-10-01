// app/src/world/lowerLevels.js — Chicago's streets under the streets (D2-2), built from public/world/lower-levels.json
// (pipeline lowerLevels.js: centrelines [x, z, y], width, level 1 = Lower Wacker's −5.1 m, level 2 = the third level).
// Pure arrays, like transit/tunnels.js: one mesh of roadway, lane lines, walls, the upper deck's soffit, columns every
// 32 ft (9.75 m) and the strip lights, plus the cutaway mask (a signed-distance raster of the lower decks' footprint)
// the U view uses to open the street above them. Nothing here touches the street level.

export const LOWER = {
  wallPad: 0.3,       // the side walls stand just outside the roadway
  wallTop: -0.04,     // level-1 walls rise to just under the street surface (the cutaway sees down them)
  ownSlab: 0.6,       // a lower deck's own slab: the third level's ceiling is the underside of the level above
  ceilClear: 3.0,     // a ceiling only where the roadway is this far under it: the ramps' mouths are open to the sky
  lampM: 12,          // a strip light every 12 m
  laneM: 3.3,
  dashM: 3, gapM: 6, markW: 0.14, markLift: 0.02,
  columnHalf: 0.3,    // 0.6 m square concrete columns
  columnMinW: 8,      // narrow service drives have none
  wallPieceM: 6,      // walls are laid in short pieces so a side street's mouth can stay open
  maskCell: 2, maskPad: 6, maskRange: 4, // the cutaway mask: 2 m cells, ±4 m of signed distance
}
// colours (linear-ish, before the self-lit shader's light): dark asphalt, worn white lines, grimy concrete, the soffit,
// the sodium-warm lamps and the CHI accent for the cut column tops
const C = {
  deck: [0.075, 0.075, 0.08], mark: [0.78, 0.78, 0.72], edge: [0.85, 0.66, 0.12], wall: [0.25, 0.245, 0.23], wallLow: [0.12, 0.118, 0.11],
  ceiling: [0.15, 0.15, 0.155], column: [0.34, 0.335, 0.31], cap: [0.27, 0.85, 1.0], lamp: [1.0, 0.82, 0.55],
}
const LIT = { surface: 0.32, lamp: 3.0, cap: 1.6 }

const ceilYOf = (j, lv) => (lv === 1 ? -j.slab : j.y[1] - LOWER.ownSlab)
const wallTopOf = (j, lv) => (lv === 1 ? LOWER.wallTop : ceilYOf(j, lv))

// one way piece → arc length, unit tangents and mitred left normals per vertex
function frame(p) {
  const n = p.length, s = new Float64Array(n), t = [], nrm = []
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
  for (let i = 0; i + 1 < n; i++) { const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], L = Math.hypot(dx, dz) || 1; t.push([dx / L, dz / L]) }
  for (let i = 0; i < n; i++) {
    const a = t[Math.max(0, i - 1)], b = t[Math.min(t.length - 1, i)]
    let mx = -(a[1] + b[1]), mz = a[0] + b[0]
    const L = Math.hypot(mx, mz) || 1
    mx /= L; mz /= L
    const cos = Math.max(0.5, mx * -b[1] + mz * b[0]) // mitre, capped at 2× (sharp corners bevel)
    nrm.push([mx / cos, mz / cos])
  }
  return { s, t, nrm, len: s[n - 1] }
}

// a position along a piece: { x, z, y, nx, nz, tx, tz } at arc length u (the segment's own normal)
function at(p, f, u) {
  let i = 0
  while (i < p.length - 2 && f.s[i + 1] < u) i++
  const L = f.s[i + 1] - f.s[i] || 1, k = Math.max(0, Math.min(1, (u - f.s[i]) / L)), a = p[i], b = p[i + 1], [tx, tz] = f.t[i]
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, nx: -tz, nz: tx, tx, tz }
}

// a spatial index of every deck segment, to ask "is this point on another way's roadway?" (junction mouths)
function deckIndex(ways, cell = 40) {
  const g = new Map(), key = (i, j) => `${i},${j}`
  ways.forEach((w, wi) => {
    for (let i = 1; i < w.p.length; i++) {
      const a = w.p[i - 1], b = w.p[i], r = w.w / 2 + LOWER.wallPad
      for (let ci = Math.floor((Math.min(a[0], b[0]) - r) / cell); ci <= Math.floor((Math.max(a[0], b[0]) + r) / cell); ci++) {
        for (let cj = Math.floor((Math.min(a[1], b[1]) - r) / cell); cj <= Math.floor((Math.max(a[1], b[1]) + r) / cell); cj++) {
          const k = key(ci, cj); if (!g.has(k)) g.set(k, []); g.get(k).push({ wi, a, b, r, lv: w.lv })
        }
      }
    }
  })
  // inside another way's roadway (same level), shrunk by `inset` — mode 'near': its deck within 1.5 m of y; 'any': at
  // any height; 'below': its deck more than 0.5 m under y
  return (x, z, y, lv, self, inset = 0.1, mode = 'near') => {
    for (const s of g.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []) {
      if (s.wi === self || s.lv !== lv) continue
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1
      const u = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2))
      if (Math.hypot(x - s.a[0] - u * dx, z - s.a[1] - u * dz) > s.r - inset) continue
      const dy = s.a[2] + u * (s.b[2] - s.a[2]) - y
      if (mode === 'any' || (mode === 'near' ? Math.abs(dy) < 1.5 : dy < -0.5)) return true
    }
    return false
  }
}

function sink() {
  const pos = [], col = [], s = [], lit = [], idx = []
  // a quad a-b-c-d (in order round its edge), wound so its front faces `want` (a world-space direction)
  const quad = (a, b, c, d, rgb, l, sv, want) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const flip = n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0
    const base = pos.length / 3
    for (const [k, q] of [a, b, c, d].entries()) { pos.push(q[0], q[1], q[2]); col.push(...(Array.isArray(rgb[0]) ? rgb[k] : rgb)); s.push(sv[k] ?? sv[0]); lit.push(l) }
    if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const done = () => ({ position: new Float32Array(pos), color: new Float32Array(col), s: new Float32Array(s), lit: new Float32Array(lit), index: (pos.length / 3 > 65535 ? Uint32Array : Uint16Array).from(idx) })
  return { quad, done, count: () => idx.length / 3 }
}

const UP = [0, 1, 0], DOWN = [0, -1, 0]

// lower-levels.json → mesh arrays: { position, color, s, lit, index } (one draw call) and stats
// Ramps that run inside another roadway's footprint (OSM centrelines of a ramp and the road it leaves sit a few metres
// apart, closer than their widths): the part of a ramp that rises above a roadway it overlaps is left out, so no ramp
// sheet lies across Lower Wacker's deck — it appears where it leaves the road. A third-level ramp climbing to the level
// above (a service drive dipping under Lower Wacker) is likewise left out above its ceiling wherever it overlaps a
// level-1 roadway, so it never pokes up through that deck.
export function hideThroughDecks(j) {
  const ways = j.ways ?? [], idx = deckIndex(ways), ceil2 = ceilYOf(j, 2), out = []
  ways.forEach((w, wi) => {
    const levelY = j.y[w.lv]
    if (!w.p.some((q) => q[2] > levelY + 0.3)) { out.push(w); return } // on its level throughout: nothing to hide
    const dense = [w.p[0]]
    for (let i = 1; i < w.p.length; i++) {
      const a = w.p[i - 1], b = w.p[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
      for (let k = 1; k <= n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n])
    }
    let run = []
    const flush = () => { if (run.length > 1) out.push({ ...w, p: run }); run = [] }
    for (const q of dense) {
      const hidden = (q[2] > levelY + 0.3 && idx(q[0], q[1], q[2], w.lv, wi, -(w.w / 2 - 0.5), 'below')) ||
        (w.lv === 2 && q[2] > ceil2 && idx(q[0], q[1], q[2], 1, wi, -(w.w / 2 + 1.5), 'any'))
      if (hidden) flush(); else run.push(q)
    }
    flush()
  })
  return { ...j, ways: out }
}

// --- D4-1: the ramp portals -----------------------------------------------------------------------------------------
// Where a ramp leaves the street it runs in an open trench until it passes under the street's slab: the street opens
// over it (cutMask().portal, always — not only in the U view), retaining walls line it and rise into a parapet, and a
// header closes it where the tunnel begins — with the street's name lettered on it at the famous ramps. The trench is
// drawn whatever the camera does (sunlit, like the street), so traffic visibly drives down into it.
export const PORTAL = {
  minDip: 0.6,     // a ramp that dips less than this (a garage door's apron) needs no opening
  parapet: 1.0,    // the parapet stands this far above the street
  rampIn: 1.5,     // … reaching full height once the roadway is this far down (it tapers to nothing at the mouth)
  cap: 0.3,        // the parapet's (and the header's) thickness
  edgePad: 0.15,   // the street's opening reaches halfway under the parapet cap
  throatIn: 0.4,   // the dark of the tunnel, just inside the header
  signH: 1.0, signAspect: 8, signDrop: 0.08, signProud: 0.06,
  mouthY: -0.3,    // an end above this is the street mouth; below it, the tunnel (a header)
  mouthInset: 2.5, headerInset: 0.6, // the street's opening stops this far short of the mouth / the header
  verge: 1.5,      // the trench floor runs this far under the street beyond the parapet (two ramps side by side close up)
}
const STREET_Y = 0.12 // the street's road ribbon (pipeline GROUND_Y.roads), where a ramp's mouth meets it
const PC = { wall: [0.2, 0.196, 0.185], wallLow: [0.085, 0.083, 0.08], cap: [0.3, 0.295, 0.28], header: [0.22, 0.215, 0.2], deck: [0.035, 0.035, 0.038] }
// the depth under which a roadway is covered by the street's own slab (the open trench ends there)
export const openBelowY = (j) => -(j.slab ?? 0.9) - LOWER.ceilClear

// lower-levels.json → { covered: the json the deck mesh draws (hideThroughDecks of what is left), portals: [{ …way,
// p, ends: ['mouth' | 'deep', 'mouth' | 'deep'] }] } — each ramp's open stretch from its mouth down to openBelowY, cut
// at the exact crossing. Portals take the OSM ramp as it is (no stretch hidden): the trench is under the street.
export function splitPortals(input) {
  const oy = openBelowY(input), portals = [], rest = []
  for (const w of input.ways ?? []) {
    const runs = []
    let flag = w.p[0][2] > oy, run = [w.p[0]]
    for (let i = 1; i < w.p.length; i++) {
      const a = w.p[i - 1], q = w.p[i], f2 = q[2] > oy
      if (f2 !== flag) {
        const t = (oy - a[2]) / (q[2] - a[2]), c = [a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, oy]
        run.push(c); runs.push({ open: flag, p: run }); run = [c]; flag = f2
      }
      run.push(q)
    }
    runs.push({ open: flag, p: run })
    for (const r of runs) {
      const pts = r.p.filter((q, k) => k === 0 || Math.hypot(q[0] - r.p[k - 1][0], q[1] - r.p[k - 1][1]) > 1e-3)
      if (pts.length < 2) continue
      const lo = Math.min(...pts.map((q) => q[2]))
      if (r.open && lo < -PORTAL.minDip) {
        const end = (q) => (q[2] > PORTAL.mouthY ? 'mouth' : 'deep')
        portals.push({ ...w, p: pts, ends: [end(pts[0]), end(pts[pts.length - 1])] })
      } else rest.push({ ...w, p: pts })
    }
  }
  return { covered: hideThroughDecks({ ...input, ways: rest }), portals }
}

// the deck pieces actually drawn (the deck mesh and the portals): what Traffic checks its vehicles against
export function shownPieces(input) {
  const { covered, portals } = splitPortals(input)
  return [...covered.ways, ...portals]
}

// where a sign goes: the portal whose end lies within `withinM` of a named ramp end ([x, z]), and its header (the
// deep end). named: [{ key, text, at: [x, z] }] → [{ key, text, piece, end, d }]
export function placeSigns(portals, named = [], withinM = 5) {
  const out = []
  for (const s of named) {
    let best = null
    portals.forEach((w, i) => {
      for (const e of [0, 1]) {
        const q = e ? w.p[w.p.length - 1] : w.p[0], d = Math.hypot(q[0] - s.at[0], q[1] - s.at[1])
        if (d <= withinM && (!best || d < best.d)) best = { d, i, e }
      }
    })
    if (!best) continue
    const deep = portals[best.i].ends.indexOf('deep')
    if (deep >= 0) out.push({ key: s.key, text: s.text, piece: best.i, end: deep, d: best.d })
  }
  return out
}

// lower-levels.json (+ the named ramps) → { mesh (roadway, walls, parapets, headers; one draw call, lit by the sun),
// dark: { position, uv, index, throatStart, rows } (the signs, then the tunnel throats: one textured draw call, the
// throats left out by draw range while the lower decks themselves are drawn), signs, stats }
export function buildPortals(input, named = []) {
  const { portals } = splitPortals(input), M = sink(), onOther = deckIndex(portals)
  const slabY = -(input.slab ?? 0.9), top = STREET_Y + PORTAL.parapet
  const topAt = (y) => STREET_Y + PORTAL.parapet * Math.max(0, Math.min(1, (STREET_Y - y) / PORTAL.rampIn))
  const headers = []
  portals.forEach((w, wi) => {
    const p = w.p, f = frame(p), hw = w.w / 2
    paveRoadway(M, w, p, f, PC.deck)
    // a concrete verge out to the parapet's outer face, so the street's opening never shows past the roadway
    for (const side of [1, -1]) {
      const V = (i, o) => [p[i][0] + f.nrm[i][0] * o * side, p[i][2] - 0.04, p[i][1] + f.nrm[i][1] * o * side] // just under a neighbouring ramp's roadway
      const o0 = hw, o1 = hw + LOWER.wallPad + PORTAL.cap + PORTAL.verge
      for (let i = 1; i < p.length; i++) M.quad(V(i - 1, o0), V(i - 1, o1), V(i, o1), V(i, o0), PC.wallLow, LIT.surface, [f.s[i - 1]], UP)
    }
    // retaining walls rising into a parapet, in short pieces (a junction with another ramp stays open)
    for (const side of [1, -1]) {
      const o = side * (hw + LOWER.wallPad), oc = side * (hw + LOWER.wallPad + PORTAL.cap), n = Math.max(1, Math.ceil(f.len / LOWER.wallPieceM))
      for (let k = 0; k < n; k++) {
        const u0 = (f.len * k) / n, u1 = (f.len * (k + 1)) / n, a = at(p, f, u0), b = at(p, f, u1), m = at(p, f, (u0 + u1) / 2)
        const ta = topAt(a.y), tb = topAt(b.y)
        if (Math.max(ta - a.y, tb - b.y) < 0.15) continue
        // a wall that would stand in (or right beside) a neighbouring ramp's trench at about its depth is left out, so two
        // ramps side by side (OSM draws each direction a few metres apart) read as one wide trench
        if (onOther(m.x + m.nx * o, m.z + m.nz * o, m.y, w.lv, wi, -(LOWER.wallPad + PORTAL.cap + 0.6))) continue
        const A = [a.x + a.nx * o, a.z + a.nz * o], B = [b.x + b.nx * o, b.z + b.nz * o]
        const Ac = [a.x + a.nx * oc, a.z + a.nz * oc], Bc = [b.x + b.nx * oc, b.z + b.nz * oc]
        const inward = [-m.nx * side, 0, -m.nz * side], outward = [m.nx * side, 0, m.nz * side]
        M.quad([A[0], a.y - 0.3, A[1]], [B[0], b.y - 0.3, B[1]], [B[0], tb, B[1]], [A[0], ta, A[1]], [PC.wallLow, PC.wallLow, PC.wall, PC.wall], LIT.surface, [u0, u1, u1, u0], inward)
        if (Math.max(ta, tb) > STREET_Y + 0.05) {
          M.quad([Ac[0], STREET_Y - 0.05, Ac[1]], [Bc[0], STREET_Y - 0.05, Bc[1]], [Bc[0], tb, Bc[1]], [Ac[0], ta, Ac[1]], PC.wall, LIT.surface, [u0], outward)
          M.quad([A[0], ta, A[1]], [B[0], tb, B[1]], [Bc[0], tb, Bc[1]], [Ac[0], ta, Ac[1]], PC.cap, LIT.surface, [u0], UP)
        }
      }
    }
    // the header where the tunnel begins: its face (from the soffit up to the parapet), back and cap
    w.ends.forEach((kind, e) => {
      if (kind !== 'deep') return
      const i = e ? p.length - 1 : 0, j = e ? p.length - 2 : 1, L = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) || 1
      const ox = (p[i][0] - p[j][0]) / L, oz = (p[i][1] - p[j][1]) / L, nx = -oz, nz = ox
      const r = hw + LOWER.wallPad + PORTAL.cap, c = p[i], bottom = Math.max(slabY, c[2])
      const P = (along, across, y) => [c[0] + ox * along + nx * across, y, c[1] + oz * along + nz * across]
      M.quad(P(0, r, bottom), P(0, -r, bottom), P(0, -r, top), P(0, r, top), PC.header, LIT.surface, [0], [-ox, 0, -oz])
      M.quad(P(PORTAL.cap, r, STREET_Y - 0.05), P(PORTAL.cap, -r, STREET_Y - 0.05), P(PORTAL.cap, -r, top), P(PORTAL.cap, r, top), PC.wall, LIT.surface, [0], [ox, 0, oz])
      M.quad(P(0, r, top), P(0, -r, top), P(PORTAL.cap, -r, top), P(PORTAL.cap, r, top), PC.cap, LIT.surface, [0], UP)
      headers.push({ piece: wi, end: e, c, o: [ox, oz], n: [nx, nz], hw, bottom })
    })
  })
  // the signs on the headers, then the throats (the tunnel's dark, just inside each header)
  const placed = placeSigns(portals, named)
  const pos = [], uv = [], idx = []
  const quad4 = (q, t) => { const b = pos.length / 3; for (const v of q) pos.push(...v); for (const v of t) uv.push(...v); idx.push(b, b + 1, b + 2, b, b + 2, b + 3) }
  const rows = placed.length + 1 // the atlas: one row per sign, and a black row for the throats
  const signs = placed.map((s, k) => {
    const h = headers.find((x) => x.piece === s.piece && x.end === s.end)
    const width = Math.min(2 * h.hw - 0.2, PORTAL.signH * PORTAL.signAspect), frac = width / (PORTAL.signH * PORTAL.signAspect)
    const y1 = top - PORTAL.signDrop, y0 = y1 - PORTAL.signH, d = -PORTAL.signProud
    const P = (across, y) => [h.c[0] + h.o[0] * d + h.n[0] * across, y, h.c[1] + h.o[1] * d + h.n[1] * across]
    const v0 = 1 - (k + 1) / rows, v1 = 1 - k / rows, u0 = 0.5 - frac / 2, u1 = 0.5 + frac / 2
    // seen from the ramp (looking along +o) the right hand is +n: the text runs that way; the face looks back up the ramp
    quad4([P(-width / 2, y0), P(width / 2, y0), P(width / 2, y1), P(-width / 2, y1)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]])
    return { key: s.key, text: s.text, frac, x: h.c[0], z: h.c[1], d: s.d }
  })
  const throatStart = idx.length, vb = 0.5 / rows
  for (const h of headers) {
    const r = h.hw + LOWER.wallPad, d = PORTAL.throatIn, y0 = h.c[2] - 0.3
    if (h.bottom - y0 < 0.4) continue
    const P = (across, y) => [h.c[0] + h.o[0] * d + h.n[0] * across, y, h.c[1] + h.o[1] * d + h.n[1] * across]
    quad4([P(r, y0), P(-r, y0), P(-r, h.bottom), P(r, h.bottom)], [[0.5, vb], [0.5, vb], [0.5, vb], [0.5, vb]])
  }
  const mesh = M.done()
  const dark = { position: new Float32Array(pos), uv: new Float32Array(uv), index: Uint16Array.from(idx), throatStart, rows }
  return { mesh, dark, signs, stats: { triangles: M.count() + idx.length / 3, portals: portals.length, headers: headers.length, signs: signs.length } }
}

// the roadway and its markings: solid edge lines, dashed lane lines (white; the edges a worn yellow)
function paveRoadway(M, w, p, f, rgb = C.deck) {
  const hw = w.w / 2
  const L = (i, o) => [p[i][0] + f.nrm[i][0] * o, p[i][2], p[i][1] + f.nrm[i][1] * o]
  for (let i = 1; i < p.length; i++) M.quad(L(i - 1, hw), L(i - 1, -hw), L(i, -hw), L(i, hw), rgb, LIT.surface, [f.s[i - 1], f.s[i - 1], f.s[i], f.s[i]], UP)
  const lanes = Math.max(1, Math.round(w.w / LOWER.laneM))
  const strip = (o, u0, u1, col) => {
    const a = at(p, f, u0), b = at(p, f, u1), h = LOWER.markW / 2, lift = LOWER.markLift
    const P = (q, oo) => [q.x + q.nx * oo, q.y + lift, q.z + q.nz * oo]
    M.quad(P(a, o + h), P(a, o - h), P(b, o - h), P(b, o + h), col, LIT.surface, [u0, u0, u1, u1], UP)
  }
  if (w.w >= 6) for (const o of [hw - 0.35, -(hw - 0.35)]) for (let u = 0; u < f.len; u += 20) strip(o, u, Math.min(f.len, u + 20), C.edge)
  for (let k = 1; k < lanes; k++) {
    const o = -hw + (k * w.w) / lanes
    for (let u = LOWER.gapM / 2; u + 0.5 < f.len; u += LOWER.dashM + LOWER.gapM) strip(o, u, Math.min(f.len, u + LOWER.dashM), C.mark)
  }
}

export function buildLowerDecks(input) {
  const split = splitPortals(input), j = split.covered, ways = j.ways, M = sink(), onOther = deckIndex(ways)
  // D4-1: nothing of a deck (a wall, the soffit, a lamp or a column) stands in a ramp's open trench
  const portalIdx = deckIndex(split.portals), inPortal = (x, z) => portalIdx(x, z, 0, 1, -1, -0.2, 'any') || portalIdx(x, z, 0, 2, -1, -0.2, 'any')
  let columns = 0, lamps = 0
  ways.forEach((w, wi) => {
    const p = w.p, f = frame(p), hw = w.w / 2, ceilY = ceilYOf(j, w.lv), wallTop = wallTopOf(j, w.lv), levelY = j.y[w.lv]
    paveRoadway(M, w, p, f)
    // the side walls, in short pieces; a piece standing on another way's roadway is left out (the junction stays open)
    for (const side of [1, -1]) {
      const o = side * (hw + LOWER.wallPad), n = Math.max(1, Math.ceil(f.len / LOWER.wallPieceM))
      for (let k = 0; k < n; k++) {
        const u0 = (f.len * k) / n, u1 = (f.len * (k + 1)) / n, a = at(p, f, u0), b = at(p, f, u1), m = at(p, f, (u0 + u1) / 2)
        if (wallTop - Math.max(a.y, b.y) < 0.3) continue
        if (onOther(m.x + m.nx * o, m.z + m.nz * o, m.y, w.lv, wi) || inPortal(m.x + m.nx * o, m.z + m.nz * o)) continue
        const A = [a.x + a.nx * o, a.z + a.nz * o], B = [b.x + b.nx * o, b.z + b.nz * o]
        M.quad([A[0], a.y - 0.3, A[1]], [B[0], b.y - 0.3, B[1]], [B[0], wallTop, B[1]], [A[0], wallTop, A[1]], [C.wallLow, C.wallLow, C.wall, C.wall], LIT.surface, [u0, u1, u1, u0], [-m.nx * side, 0, -m.nz * side])
      }
    }
    // the soffit (the underside of the deck above) and its strip lights, only where the roadway is well under it
    const covered = (y) => y < ceilY - LOWER.ceilClear
    for (let i = 1; i < p.length; i++) {
      if (!covered(p[i - 1][2]) || !covered(p[i][2]) || inPortal((p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2)) continue
      const o = hw + LOWER.wallPad, A = (k, oo) => [p[k][0] + f.nrm[k][0] * oo, ceilY, p[k][1] + f.nrm[k][1] * oo]
      M.quad(A(i - 1, o), A(i - 1, -o), A(i, -o), A(i, o), C.ceiling, LIT.surface, [f.s[i - 1], f.s[i - 1], f.s[i], f.s[i]], DOWN)
    }
    const rows = w.w >= 12 ? [-w.w / 4, w.w / 4] : [0]
    for (let u = LOWER.lampM / 2; u < f.len; u += LOWER.lampM) {
      const q = at(p, f, u)
      if (!covered(q.y)) continue
      for (const o of rows) {
        const cx = q.x + q.nx * o, cz = q.z + q.nz * o, y = ceilY - 0.06, hl = 1.2, hwid = 0.22
        if (inPortal(cx, cz)) continue
        const P = (a, b) => [cx + q.tx * a + q.nx * b, y, cz + q.tz * a + q.nz * b]
        M.quad(P(-hl, hwid), P(-hl, -hwid), P(hl, -hwid), P(hl, hwid), C.lamp, LIT.lamp, [u], DOWN)
        lamps++
      }
    }
    // columns every 9.75 m in rows just inside the kerbs (and down the middle of a wide roadway), to the soffit; their
    // tops carry the cut's accent so the U view reads them as sliced
    if (w.w >= LOWER.columnMinW) {
      const crow = [hw - 0.5, -(hw - 0.5), ...(w.w >= 14 ? [0] : [])]
      for (let u = j.columnM / 2; u < f.len; u += j.columnM) {
        const q = at(p, f, u)
        if (!covered(q.y) || Math.abs(q.y - levelY) > 0.05) continue
        for (const o of crow) {
          const cx = q.x + q.nx * o, cz = q.z + q.nz * o
          if (onOther(cx, cz, q.y, w.lv, wi, -0.5) || inPortal(cx, cz)) continue // not in the middle of a crossing roadway (or a ramp)
          const r = LOWER.columnHalf, P = (a, b, y) => [cx + q.tx * a + q.nx * b, y, cz + q.tz * a + q.nz * b]
          for (const [a0, b0, a1, b1] of [[-r, r, r, r], [r, r, r, -r], [r, -r, -r, -r], [-r, -r, -r, r]]) {
            const mx = (a0 + a1) / 2, mb = (b0 + b1) / 2
            M.quad(P(a0, b0, q.y), P(a1, b1, q.y), P(a1, b1, ceilY), P(a0, b0, ceilY), C.column, LIT.surface, [u], [q.tx * mx + q.nx * mb, 0, q.tz * mx + q.nz * mb])
          }
          M.quad(P(-r, r, ceilY), P(r, r, ceilY), P(r, -r, ceilY), P(-r, -r, ceilY), C.cap, LIT.cap, [u], UP)
          columns++
        }
      }
    }
  })
  const mesh = M.done()
  return { ...mesh, stats: { triangles: M.count(), columns, lamps, ways: ways.length } }
}

// The cutaway mask (D2-3): a signed-distance raster of the lower decks' footprint (walls included) — positive inside,
// metres, clamped to ±maskRange and packed into a byte — that the ground and land shaders open the street with.
// D4-1: on the same grid, `portal` is the ramps' open stretches (always open, U or not), flat-ended at the street mouth
// and at the tunnel header so the street opens exactly over the trench.
export function cutMask(input, { cell = LOWER.maskCell, pad = LOWER.maskPad, range = LOWER.maskRange } = {}) {
  const { covered, portals } = splitPortals(input), ways = [...covered.ways, ...portals]
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  for (const w of ways) for (const q of w.p) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]) }
  if (!Number.isFinite(x0)) return null
  x0 -= 20 + pad; z0 -= 20 + pad; x1 += 20 + pad; z1 += 20 + pad
  const W = Math.ceil((x1 - x0) / cell), H = Math.ceil((z1 - z0) / cell), data = new Uint8Array(W * H), portal = new Uint8Array(W * H)
  const enc = (d) => Math.round(((Math.max(-range, Math.min(range, d)) + range) / (2 * range)) * 255)
  const raster = (list, out, radius, capOf) => {
    for (const w of list) {
      const r = radius(w), n = w.p.length
      // square ends: the plane through each capped end, facing out along the piece, held `inset` metres inside it
      const caps = [0, 1].map((e) => {
        const inset = capOf(w, e)
        if (inset == null) return null
        const q = w.p[e ? n - 1 : 0], o = w.p[e ? n - 2 : 1], L = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1
        return [q[0], q[1], (q[0] - o[0]) / L, (q[1] - o[1]) / L, inset]
      }).filter(Boolean)
      for (let i = 1; i < n; i++) {
        const a = w.p[i - 1], b = w.p[i], reach = r + range
        const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - reach - x0) / cell)), i1 = Math.min(W - 1, Math.floor((Math.max(a[0], b[0]) + reach - x0) / cell))
        const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - reach - z0) / cell)), j1 = Math.min(H - 1, Math.floor((Math.max(a[1], b[1]) + reach - z0) / cell))
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) {
          const x = x0 + (ii + 0.5) * cell, z = z0 + (jj + 0.5) * cell
          let d = segDepth(x, z, a, b, r)
          for (const [cx, cz, ox, oz, inset] of caps) if (Math.hypot(x - cx, z - cz) < reach + inset) d = Math.min(d, -((x - cx) * ox + (z - cz) * oz) - inset) // (only near that end: a curving ramp may pass its plane elsewhere)
          const v = enc(d), k = jj * W + ii
          if (v > out[k]) out[k] = v
        }
      }
    }
  }
  raster(ways, data, (w) => w.w / 2 + LOWER.wallPad, () => null)
  // square ends, held back from the mouth (the ramp is still at the street there) and a little from the header (its
  // cap covers the rest), so the raster's softness never opens the street past the trench
  raster(portals, portal, (w) => w.w / 2 + LOWER.wallPad + PORTAL.edgePad, (w, e) => (w.ends[e] === 'mouth' ? PORTAL.mouthInset : PORTAL.headerInset))
  return { data, portal, width: W, height: H, x0, z0, cell, range }
}

// signed distance (m, > 0 inside) to a segment's band of half-width r (round-ended)
function segDepth(x, z, a, b, r) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1
  const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2))
  return r - Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz)
}

// metres inside the cut (> 0) at a point, from the raster (nearest cell): what Traffic asks before drawing a car
export function cutDepth(mask, x, z, channel = 'data') {
  if (!mask) return -Infinity
  const i = Math.floor((x - mask.x0) / mask.cell), k = Math.floor((z - mask.z0) / mask.cell)
  if (i < 0 || k < 0 || i >= mask.width || k >= mask.height) return -mask.range
  return (mask[channel][k * mask.width + i] / 255) * 2 * mask.range - mask.range
}
// metres inside a ramp portal's opening (> 0): the street there is always open
export const portalDepth = (mask, x, z) => cutDepth(mask, x, z, 'portal')

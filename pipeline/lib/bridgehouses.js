// pipeline/lib/bridgehouses.js — A-9: the Chicago River's bridge-tender houses, dressed on their real OpenStreetMap
// footprints (OSM maps nearly every one: "Wells Street Bridgehouse", "DuSable Bridgehouse", "Bridge House" …).
// Each takes its bridge's style (bridges.json houses.style): Beaux-Arts, Art Deco, Moderne, modern glass, and
// Bennett's four DuSable towers with the 1928 reliefs. Near the river a house's stone base runs down to the water
// (levels.json RIVER_Y − 0.5), as the real houses stand on the bascule piers. Data and sources: data/bridgehouses.json.
// The OSM box stays as a hidden piece (hover, clearance); the dressed house is drawn as the building's extra meshes.
import { join } from 'node:path'
import { add2, sub2, mul2, dot2, len2, norm2, mesh, tri, quad, slab, tube, at3 } from './meshkit.js'
import { orientedBox } from './sacred.js'
import { drum } from './crowns.js'
import { ringCentroid } from './geom.js'
import { loadBlenderMesh } from './blenderMesh.js'
import { LANDMARK_FACADES as F } from './facadeIds.js'

export const HOUSE_TRI_LIMIT = 1500
export const DUSABLE_TRI_LIMIT = 8000
export const RELIEF_NAMES = ['discoverers', 'pioneers', 'defense', 'regeneration']
export const NEAR_WATER_M = 4
const STY = { stone: 'tender-limestone', bedford: 'bedford-limestone', relief: 'bedford-limestone-relief', granite: 'bridgehouse-granite', window: 'bridgehouse-window', glass: 'tender-glass', steel: 'lamp-post-black' }
const MIN_SIDE = 5.5

// ── Matching ──────────────────────────────────────────────────────────────────────────────────────────────────────
const cornerOf = (p, c) => `${p[1] < c[1] ? 'n' : 's'}${p[0] < c[0] ? 'w' : 'e'}`
const across = (u) => [-u[1], u[0]]

// OSM bridgehouses → their bridge (the nearest whose deck they flank), corner and which way the river lies.
export function matchBridgehouses(buildings, bridges, { name = 'bridge ?house', skipName = 'railroad|railway|air line', maxM = 45, acrossM = 30 } = {}) {
  const isHouse = new RegExp(name, 'i'), isRail = new RegExp(skipName, 'i'), out = []
  for (const b of buildings) {
    if (!b.polygons?.length || !isHouse.test(b.name ?? '')) continue
    const c = ringCentroid(b.polygons[0].outer)
    let best = null
    for (const br of bridges) {
      const d = sub2(c, br.centre), along = dot2(d, br.axis), side = dot2(d, across(br.axis))
      if (Math.abs(along) > br.span / 2 + maxM || Math.abs(side) > br.width / 2 + acrossM) continue
      const dist = len2(d)
      if (!best || dist < best.dist) best = { br, along, dist }
    }
    if (!best) continue
    if (isRail.test(b.name) && !(best.br.railWayIds?.length)) continue
    const riverDir = mul2(best.br.axis, best.along > 0 ? -1 : 1)
    out.push({ b, bridge: best.br, corner: cornerOf(c, best.br.centre), riverDir, outDir: mul2(riverDir, -1), centre: c })
  }
  return out
}

// ── The house frame: the footprint's oriented box, its four faces ─────────────────────────────────────────────────
function frameOf(ring) {
  const ob = orientedBox(ring), L = Math.max(MIN_SIDE, ob.L), W = Math.max(MIN_SIDE, ob.W)
  const v = across(ob.u)
  const faces = [
    { n: ob.u, t: v, half: L / 2, len: W }, { n: mul2(ob.u, -1), t: mul2(v, -1), half: L / 2, len: W },
    { n: v, t: mul2(ob.u, -1), half: W / 2, len: L }, { n: mul2(v, -1), t: ob.u, half: W / 2, len: L },
  ]
  return { c: ob.c, u: ob.u, L, W, faces, toward: (dir) => faces.reduce((a, f) => (dot2(f.n, dir) > dot2(a.n, dir) ? f : a)) }
}
// a point on a face: `s` along it (from its middle), `o` out from it
const onFace = (fr, f, s, o = 0) => add2(add2(fr.c, mul2(f.n, f.half + o)), mul2(f.t, s))
// a flat panel standing `proud` off a face: s0..s1 along it, y0..y1 (front, sides and top; it sits against the wall)
function panel(m, fr, f, s0, s1, y0, y1, proud) {
  const P = (s, o, y) => at3(onFace(fr, f, s, o), y)
  const n = [f.n[0], 0, f.n[1]]
  quad(m, P(s0, proud, y0), P(s1, proud, y0), P(s1, proud, y1), P(s0, proud, y1), n, [s0, y0, s1, y1])
  quad(m, P(s0, 0, y1), P(s1, 0, y1), P(s1, proud, y1), P(s0, proud, y1), [0, 1, 0])
  quad(m, P(s0, 0, y0), P(s0, proud, y0), P(s0, proud, y1), P(s0, 0, y1), [-f.t[0], 0, -f.t[1]])
  quad(m, P(s1, 0, y0), P(s1, proud, y0), P(s1, proud, y1), P(s1, 0, y1), [f.t[0], 0, f.t[1]])
  return m
}
// a round-headed window: a rectangle to the springing, a half-disc above (front faces only, a hand's breadth proud)
function archWindow(m, fr, f, s, w, y0, ySpring, proud = 0.06) {
  panel(m, fr, f, s - w / 2, s + w / 2, y0, ySpring, proud)
  const n = [f.n[0], 0, f.n[1]], r = w / 2, k = 6, ctr = at3(onFace(fr, f, s, proud), ySpring)
  for (let i = 0; i < k; i++) {
    const a0 = (i / k) * Math.PI, a1 = ((i + 1) / k) * Math.PI
    tri(m, ctr, at3(onFace(fr, f, s + Math.cos(a0) * r, proud), ySpring + Math.sin(a0) * r), at3(onFace(fr, f, s + Math.cos(a1) * r, proud), ySpring + Math.sin(a1) * r), n)
  }
  return m
}
// horizontal bands round the box: a course `h` tall standing `d` proud, every `every` metres from y0 to y1
function courses(m, fr, y0, y1, every, h, d) {
  for (let y = y0 + every; y < y1 - h / 2; y += every) slab(m, fr.c, fr.u, fr.L + 2 * d, fr.W + 2 * d, y - h / 2, y + h / 2)
  return m
}
// a prism on a convex ring (walls and top) — the Moderne house's chamfered plan, its ribbon and its roof
function prism(m, ring, y0, y1, { top = true, bottom = false } = {}) {
  const c = ring.reduce((s, p) => add2(s, mul2(p, 1 / ring.length)), [0, 0])
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], mid = mul2(add2(a, b), 0.5), n = norm2(sub2(mid, c))
    quad(m, at3(a, y0), at3(b, y0), at3(b, y1), at3(a, y1), [n[0], 0, n[1]], [0, y0, len2(sub2(b, a)), y1])
    if (top) tri(m, at3(c, y1), at3(a, y1), at3(b, y1), [0, 1, 0])
    if (bottom) tri(m, at3(c, y0), at3(a, y0), at3(b, y0), [0, -1, 0])
  }
  return m
}
const chamferRing = (fr, grow, ch) => {
  const hl = fr.L / 2 + grow, hw = fr.W / 2 + grow, c = Math.min(ch, hl * 0.45, hw * 0.45), v = across(fr.u)
  const P = (a, b) => add2(add2(fr.c, mul2(fr.u, a)), mul2(v, b))
  return [P(-hl + c, -hw), P(hl - c, -hw), P(hl, -hw + c), P(hl, hw - c), P(hl - c, hw), P(-hl + c, hw), P(-hl, hw - c), P(-hl, -hw + c)]
}
// a hip roof on the box: eaves at y, ridge `rise` above along the long axis
function hipRoof(m, fr, y, rise, eave) {
  const hl = fr.L / 2 + eave, hw = fr.W / 2 + eave, v = across(fr.u), ridge = Math.max(0, hl - hw)
  const P = (a, b, yy) => at3(add2(add2(fr.c, mul2(fr.u, a)), mul2(v, b)), yy)
  const r0 = P(-ridge, 0, y + rise), r1 = P(ridge, 0, y + rise)
  const e = [P(-hl, -hw, y), P(hl, -hw, y), P(hl, hw, y), P(-hl, hw, y)]
  const up = (dir) => [dir[0], 0.8, dir[1]]
  quad(m, e[0], e[1], r1, r0, up(mul2(v, -1))); quad(m, e[2], e[3], r0, r1, up(v))
  tri(m, e[1], e[2], r1, up(fr.u)); tri(m, e[3], e[0], r0, up(mul2(fr.u, -1)))
  quad(m, e[0], e[1], e[2], e[3], [0, -1, 0])
  return m
}
const part = (m, facade, style, name, { seed = 0.5, lod0Only = true } = {}) => Object.assign(m, { facade, seed, style, part: name, lod0Only })

// ── The styles ────────────────────────────────────────────────────────────────────────────────────────────────────
// Every house: the plinth (from the water near the river, else from the street), then its body above the street.
function plinth(fr, bottom, spec, { stone = STY.granite, every = 0.9 } = {}) {
  const m = mesh()
  slab(m, fr.c, fr.u, fr.L + 0.4, fr.W + 0.4, bottom, 0.6)                       // the battered base and water table
  if (bottom < -0.5) courses(m, fr, bottom, 0.0, every, 0.14, 0.27)               // rusticated courses down to the water
  return part(m, F.stone, stone, 'plinth', { lod0Only: false })
}
function windowsAround(m, fr, faces, w, y0, ySpring, gap = 2.6) {
  for (const f of faces) {
    const k = Math.max(1, Math.floor((f.len - 0.8) / gap))
    for (let i = 0; i < k; i++) archWindow(m, fr, f, (i - (k - 1) / 2) * (f.len / k), w, y0, ySpring)
  }
  return m
}

function beauxArts(fr, sp, ctx) {
  const H = sp.bodyM, body = slab(mesh(), fr.c, fr.u, fr.L, fr.W, 0, H), trim = mesh(), win = mesh()
  // corner quoins, a frieze band, the cornice
  for (const f of fr.faces) for (const s of [-1, 1]) panel(trim, fr, f, s * (f.len / 2) - (s > 0 ? 0.55 : -0.55), s * f.len / 2, 0.6, H - 0.5, 0.1)
  slab(trim, fr.c, fr.u, fr.L + 0.25, fr.W + 0.25, H - 1.0, H - 0.8)
  slab(trim, fr.c, fr.u, fr.L + 2 * sp.cornice, fr.W + 2 * sp.cornice, H - 0.35, H)
  windowsAround(win, fr, fr.faces, sp.windowW, sp.windowY[0], sp.windowY[1] - sp.windowW / 2)
  const roof = hipRoof(mesh(), fr, H, sp.roofM, sp.cornice - 0.05)
  return [part(body, F.stone, ctx.stone, 'house', { lod0Only: false }), part(trim, F.stone, ctx.stone, 'trim'), part(win, F.steel, STY.window, 'windows'),
    part(roof, F.roofing, null, 'roof', { seed: 0.35, lod0Only: false })] // verdigris copper
}

function deco(fr, sp, ctx) {
  const H = sp.bodyM, [s1, s2] = sp.steps, body = mesh(), fins = mesh(), win = mesh()
  slab(body, fr.c, fr.u, fr.L, fr.W, 0, H - s1)
  slab(body, fr.c, fr.u, fr.L - 1.0, fr.W - 1.0, H - s1, H - s2)
  slab(body, fr.c, fr.u, fr.L - 2.2, fr.W - 2.2, H - s2, H)
  for (const f of fr.faces) {
    const k = Math.max(3, Math.round(f.len / sp.finEvery)), step = f.len / k
    for (let i = 0; i <= k; i++) panel(fins, fr, f, -f.len / 2 + i * step - 0.1, -f.len / 2 + i * step + 0.1, 0.7, H - s1 - 0.3, 0.18)  // fluted piers
    for (let i = 1; i < k - 1; i += 2) panel(win, fr, f, -f.len / 2 + i * step + 0.12, -f.len / 2 + (i + 1) * step - 0.12, 1.4, H - s1 - 0.9, 0.05) // tall window strips
  }
  slab(fins, fr.c, fr.u, fr.L + 0.3, fr.W + 0.3, H - s1 - 0.3, H - s1)            // the parapet's coping, stepped above
  return [part(body, F.stone, ctx.stone, 'house', { lod0Only: false }), part(fins, F.stone, ctx.stone, 'fins'), part(win, F.steel, STY.window, 'windows')]
}

function moderne(fr, sp, ctx) {
  const H = sp.bodyM, body = prism(mesh(), chamferRing(fr, 0, sp.chamfer), 0, H)
  const ribbon = prism(mesh(), chamferRing(fr, 0.04, sp.chamfer), sp.ribbon[0], sp.ribbon[1], { top: false })
  const roof = prism(mesh(), chamferRing(fr, sp.overhang, sp.chamfer + sp.overhang * 0.4), H, H + 0.35, { bottom: true })
  const band = prism(mesh(), chamferRing(fr, 0.06, sp.chamfer), sp.ribbon[1] + 0.25, sp.ribbon[1] + 0.45, { top: false })
  return [part(body, F.stone, ctx.stone, 'house', { lod0Only: false }), part(ribbon, F.steel, STY.window, 'windows'),
    part(roof, F.stone, ctx.stone, 'roof', { lod0Only: false }), part(band, F.stone, ctx.stone, 'trim')]
}

function modern(fr, sp) {
  const H = sp.bodyM, base = slab(mesh(), fr.c, fr.u, fr.L, fr.W, 0, 0.7), glass = slab(mesh(), fr.c, fr.u, fr.L - 0.1, fr.W - 0.1, 0.7, H - 0.45), frame = mesh()
  for (const f of fr.faces) {
    const k = Math.max(2, Math.round(f.len / sp.mullionEvery)), step = f.len / k
    for (let i = 0; i <= k; i++) panel(frame, fr, f, -f.len / 2 + i * step - 0.07, -f.len / 2 + i * step + 0.07, 0.7, H - 0.45, 0.06)
  }
  slab(frame, fr.c, fr.u, fr.L + 0.8, fr.W + 0.8, H - 0.45, H)                     // the roof slab's dark fascia
  return [part(base, F.stone, STY.granite, 'house', { lod0Only: false }), part(glass, F.steel, STY.glass, 'glass', { lod0Only: false }), part(frame, F.steel, STY.steel, 'frame')]
}

// Place a relief mesh authored in the glb frame (x across, y up from 0, its face toward −z) on the outward face.
function placeRelief(src, at, y0, out) {
  const R = [-out[1], out[0]], m = mesh()
  for (let i = 0; i < src.positions.length; i += 3) {
    const x = src.positions[i], y = src.positions[i + 1], z = src.positions[i + 2]
    m.positions.push(at[0] + R[0] * x - out[0] * z, y0 + y, at[1] + R[1] * x - out[1] * z)
    const nx = src.normals[i], ny = src.normals[i + 1], nz = src.normals[i + 2]
    m.normals.push(R[0] * nx - out[0] * nz, ny, R[1] * nx - out[1] * nz)
  }
  m.uvs.push(...(src.uvs.length === (src.positions.length / 3) * 2 ? src.uvs : new Array((src.positions.length / 3) * 2).fill(0)))
  return m
}
// The procedural stand-in (no Blender export): five standing figures on a panel, as bridges.js drew them.
function reliefStandIn({ w, h }) {
  const m = mesh()
  slab(m, [0, -0.15], [0, -1], 0.3, w, 0, h)
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + (w / 6) * (i + 1), lean = 0.25 * Math.sin(i * 1.7)
    tube(m, [x, 0.9, -0.45], [x + lean, h * 0.75, -0.45], 0.38, 6)
    const head = drum({ at: [x + lean, -0.45], base: h * 0.75, top: h * 0.86, r: 0.34, sides: 8 })
    for (const k of ['positions', 'normals', 'uvs']) m[k].push(...head[k])
  }
  return m
}

function dusable(fr, sp, ctx) {
  const H = sp.bodyM, A = sp.atticM, out = []
  const body = slab(mesh(), fr.c, fr.u, fr.L, fr.W, 0, H), trim = mesh(), win = mesh()
  slab(trim, fr.c, fr.u, fr.L + 0.3, fr.W + 0.3, 0, 1.2)                           // the base course at the sidewalk
  slab(trim, fr.c, fr.u, fr.L + 0.2, fr.W + 0.2, 3.0, 3.3)                         // string course
  for (const f of fr.faces) for (const s of [-1, 1]) panel(trim, fr, f, s > 0 ? f.len / 2 - sp.pilaster : -f.len / 2, s > 0 ? f.len / 2 : -f.len / 2 + sp.pilaster, 1.2, H - 0.6, 0.22)
  slab(trim, fr.c, fr.u, fr.L + 0.9, fr.W + 0.9, H - 0.3, H + 0.4)                 // the cornice
  slab(trim, fr.c, fr.u, fr.L - 0.3, fr.W - 0.3, H + 0.4, A - 0.25)                // the attic
  slab(trim, fr.c, fr.u, fr.L - 0.1, fr.W - 0.1, A - 0.25, A)                      // its coping
  const outF = fr.toward(ctx.outDir), riverF = fr.toward(ctx.riverDir)
  // the side faces: two tall narrow windows each; the river face: a pair of arched windows over the water
  for (const f of fr.faces) {
    if (f === outF) continue
    if (f === riverF) { for (const s of [-1, 1]) archWindow(win, fr, f, s * f.len * 0.2, 0.9, 4.2, 8.2) }
    else for (const s of [-1, 1]) panel(win, fr, f, s * f.len * 0.2 - 0.35, s * f.len * 0.2 + 0.35, 4.0, 9.0, 0.05)
  }
  out.push(part(body, F.stone, STY.bedford, 'house', { lod0Only: false }), part(trim, F.stone, STY.bedford, 'trim', { lod0Only: false }), part(win, F.steel, STY.window, 'windows'))
  // the relief, framed, high on the outward face (Fraser north, Hering south)
  const R = sp.relief, at = onFace(fr, outF, 0, 0.22), frame = mesh()
  panel(frame, fr, outF, -R.w / 2 - 0.25, R.w / 2 + 0.25, R.y0 - 0.25, R.y0 + R.h + 0.25, 0.22)
  out.push(part(frame, F.stone, STY.bedford, 'relief-frame'))
  if (ctx.relief) {
    const src = ctx.reliefMesh ?? reliefStandIn(R)
    out.push(part(placeRelief(src, at, R.y0, ctx.outDir), F.stone, STY.relief, `relief:${ctx.relief}`))
  }
  // the museum's door onto the Riverwalk (SW house), in the river face of the plinth
  if (ctx.museum && ctx.bottom < -1) {
    const door = mesh(), y0 = ctx.levels.riverwalk
    archWindow(door, fr, riverF, 0, 2.0, y0, y0 + 2.6, 0.32)
    out.push(part(door, F.steel, STY.window, 'museum-door'))
  }
  return out
}

const BUILDERS = { 'beaux-arts': beauxArts, deco, moderne, modern, dusable }

// ── Dressing ──────────────────────────────────────────────────────────────────────────────────────────────────────
function nearWater(ring, waterIdx) {
  if (!waterIdx) return false
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(len2(sub2(b, a)) / 1.5))
    for (let k = 0; k < n; k++) { const p = add2(a, mul2(sub2(b, a), k / n)); if (waterIdx.nearEdge(p, NEAR_WATER_M) || waterIdx.find(p)) return true }
  }
  return false
}

export function dressBridgehouses({ buildings, bridges, waterIdx = null, levels = null, data, reliefs = null }) {
  const matches = matchBridgehouses(buildings, bridges, data.match)
  const bridgeKeys = new Set()
  for (const { b, bridge, corner, riverDir, outDir } of matches) {
    const style = BUILDERS[bridge.houses?.style] ? bridge.houses.style : 'modern', sp = data.styles[style]
    const fr = frameOf(b.polygons[0].outer)
    const bottom = levels && nearWater(b.polygons[0].outer, waterIdx) ? levels.river - 0.5 : 0
    const isDusable = style === 'dusable' && bridge.key === data.dusable.bridge
    const relief = isDusable ? data.dusable.reliefs[corner] ?? null : null
    const museum = isDusable && corner === data.dusable.museum.corner
    const ctx = { stone: STY.stone, outDir, riverDir, relief, reliefMesh: relief ? reliefs?.[relief] ?? null : null, museum, bottom, levels }
    const meshes = [plinth(fr, bottom, sp, { stone: style === 'dusable' ? STY.bedford : STY.granite, every: style === 'dusable' ? 0.62 : 0.9 }), ...BUILDERS[style](fr, sp, ctx)]
    b.pieces = (b.pieces ?? []).map((p) => ({ ...p, hidden: true }))
    b.extraMeshes = meshes.filter((m) => m.positions.length)
    b.bridgehouse = { bridge: bridge.key, style, corner }
    if (museum) b.name = data.dusable.museum.name
    bridgeKeys.add(bridge.key)
  }
  return { matched: matches.length, bridgeKeys }
}

// The four Blender reliefs (heroes/scripts/dusable_reliefs.py → heroes/out/relief_<name>.glb), in their own frame:
// x across the panel, y up from its foot, its face toward −z. Null for any that is missing (procedural stand-in).
export async function loadReliefs(dir) {
  const out = {}
  for (const k of RELIEF_NAMES) out[k] = await loadBlenderMesh(join(dir, `relief_${k}.glb`), { at: [0, 0], maxTris: 4000 })
  return out
}

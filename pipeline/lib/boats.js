// pipeline/lib/boats.js — F-9: the boats on Chicago's water, as instances of the scripted Blender models
// (heroes/scripts/boats.py → heroes/out/boats/<kind>.glb: meshes `lod0` and `lod1`, one primitive per role material,
// baked occlusion in COLOR_0). The pipeline never draws a boat into a tile: it lists placements and copies the models
// (meshopt-compressed) into the world; the app draws each kind as instanced meshes (app/src/world/boats/*).
//
// Reuse (river, lake, harbours): every placement goes through placeBoat; build-world collects them and writeBoats
// writes world/boats.json + world/boats/<kind>.glb once. A harbour builder returns placements the same way:
//   placeBoat('cruiser', [x, z], bowDir2, { y: lakeY, livery: 3 })        → { k, x, y, z, h, l }
//   pickKind(rnd, BOAT_MIX.marina) / mooredInSlip(...)                    → deterministic choices for a marina
// Placement record: k kind, x/y/z the waterline point under mid-length, h heading (radians about +Y: the model's +X,
// its bow, turns to [cos h, −sin h] in (x, z)), l livery index into BOAT_KINDS[k].liveries.
// Pure and deterministic except writeBoats (I/O).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import { add2, mul2, norm2, left, dot2, bearing } from './meshkit.js'

const HERE = dirname(fileURLToPath(import.meta.url))
export const BOATS_FILE = 'boats.json'
export const BOATS_DIR = 'boats'
export const BOATS_VERSION = 1

// L × B (metres) as built in boats.py; lit: the cabins glow after dusk (working boats); liveries are sRGB hex for the three recolourable roles (hull, trim, canopy).
// Generic and fictional: colours of the class, no operator's livery or name.
export const BOAT_KINDS = {
  runabout: { L: 7.4, B: 2.55, file: 'runabout.glb', liveries: [
    { hull: '#f2f1ec', trim: '#13305e', canopy: '#1b2a44' }, { hull: '#f2f1ec', trim: '#7a1d24', canopy: '#c9b99a' },
    { hull: '#f2f1ec', trim: '#1f6f78', canopy: '#2f3b45' }, { hull: '#e9ecef', trim: '#222428', canopy: '#5b6168' }] },
  cruiser: { L: 11.0, B: 3.6, file: 'cruiser.glb', liveries: [
    { hull: '#f4f3ef', trim: '#1d1f22', canopy: '#4a4f55' }, { hull: '#f4f3ef', trim: '#14325f', canopy: '#14325f' },
    { hull: '#efeee9', trim: '#6d7378', canopy: '#c4b493' }, { hull: '#f4f3ef', trim: '#0e4d5c', canopy: '#2b3640' }] },
  yacht: { L: 14.0, B: 4.4, file: 'yacht.glb', liveries: [
    { hull: '#f4f3ef', trim: '#14244a', canopy: '#14244a' }, { hull: '#f4f3ef', trim: '#2a2d31', canopy: '#c9bea4' },
    { hull: '#16233d', trim: '#e8e6df', canopy: '#e8e6df' }] },
  tourboat: { L: 28.0, B: 7.6, file: 'tourboat.glb', lit: true, liveries: [
    { hull: '#16264a', trim: '#f1f0ea', canopy: '#1c3563' }, { hull: '#173b2c', trim: '#f1f0ea', canopy: '#24543f' },
    { hull: '#f1f0ea', trim: '#1a4f8a', canopy: '#1a4f8a' }, { hull: '#2a2c31', trim: '#d9d4c5', canopy: '#7d1f25' }] },
  watertaxi: { L: 18.5, B: 5.6, file: 'watertaxi.glb', lit: true, liveries: [
    { hull: '#e9b31a', trim: '#16171a', canopy: '#e9b31a' }, { hull: '#f1f0ea', trim: '#0f5d6b', canopy: '#0f5d6b' }] },
}
// slip mixes: the pleasure boats a marina holds (weights)
export const BOAT_MIX = { marina: [['cruiser', 5], ['runabout', 3], ['yacht', 2]] }

const r3 = (v) => Math.round(v * 1000) / 1000

// One boat: kind, the waterline point under mid-length [x, z], the bow's direction (2D, any length), at waterline y.
export function placeBoat(kind, at, bow, { y, livery = 0 } = {}) {
  const K = BOAT_KINDS[kind]
  if (!K) throw new Error(`boats: unknown kind ${kind}`)
  const u = norm2(bow)
  return { k: kind, x: r3(at[0]), y: r3(y), z: r3(at[1]), h: r3(Math.atan2(-u[1], u[0])), l: ((livery % K.liveries.length) + K.liveries.length) % K.liveries.length }
}

// the boat's footprint corners (2D) — for "is it all on the water?"
export function boatCorners(p, margin = 0) {
  const K = BOAT_KINDS[p.k], u = [Math.cos(p.h), -Math.sin(p.h)], v = left(u), hl = K.L / 2 + margin, hw = K.B / 2 + margin
  return [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw], [hl, 0], [-hl, 0]].map(([a, b]) => add2(add2([p.x, p.z], mul2(u, a)), mul2(v, b)))
}

export function pickKind(rnd, mix) {
  const tot = mix.reduce((t, [, w]) => t + w, 0)
  let r = rnd() * tot
  for (const [k, w] of mix) { if ((r -= w) < 0) return k }
  return mix[mix.length - 1][0]
}

// A pleasure boat moored stern-to in a slip: `mouth` the slip's dock-side middle, `out` the direction out into the
// river; the stern stands 0.4 m off the dock. Deterministic through `rnd`.
export function mooredInSlip(mouth, out, { y, rnd, mix = BOAT_MIX.marina, maxL = Infinity }) {
  let kind = pickKind(rnd, mix)
  if (BOAT_KINDS[kind].L > maxL) kind = mix.map(([k]) => k).filter((k) => BOAT_KINDS[k].L <= maxL).sort((a, b) => BOAT_KINDS[b].L - BOAT_KINDS[a].L)[0] ?? kind
  const K = BOAT_KINDS[kind], u = norm2(out)
  // bow out (most come in bow-first and back out; a third back in): either way the hull lies along the slip
  const bowOut = rnd() < 0.66
  return placeBoat(kind, add2(mouth, mul2(u, K.L / 2 + 0.4)), bowOut ? u : mul2(u, -1), { y, livery: Math.floor(rnd() * 97) })
}

// ── the river's working boats (data/riverboats.json): tour boats and water taxis at their docks and under way ──────
// A spec point is approximate (read from maps and photographs); the boat is laid against the river as built:
//   moored   against the nearest bank toward `side` (a compass bearing), its side `gap` m off the wall
//   underway on the river's axis at `at` (`across` −1…1 from bank to bank), along the river toward `bow` (a bearing)
// The river's axis is found by ray-marching the water (isWater: [x, z] → bool) — the direction with the longest
// clear run through `at`. A boat that would not lie wholly on the water is dropped (reported, never drawn on land).
export function freeRun(isWater, p, d, max = 120, step = 1) {
  let s = 0
  while (s < max && isWater(add2(p, mul2(d, s + step)))) s += step
  return s
}
export function riverAxis(isWater, p) {
  // the river runs across its narrowest section: the bank-to-bank width is least perpendicular to the axis
  // (coarse 5° then fine 1° around the best, so a build lays a boat in a few thousand probes)
  const width = (a, step) => { const n = bearing(a); return freeRun(isWater, p, n, 160, step) + freeRun(isWater, p, mul2(n, -1), 160, step) }
  let best = 0, bw = Infinity
  for (let a = 0; a < 180; a += 5) { const w = width(a, 1); if (w < bw - 1e-9) { bw = w; best = a } }
  let fine = best
  bw = Infinity
  for (let a = best - 5; a <= best + 5; a += 1) { const w = width(a, 0.5); if (w < bw - 1e-9) { bw = w; fine = a } }
  return left(bearing(fine))
}
export function riverBoat(spec, { isWater, y }) {
  const p0 = spec.at, ax = riverAxis(isWater, p0), K = BOAT_KINDS[spec.kind]
  const along = dot2(ax, bearing(spec.bow ?? 90)) >= 0 ? ax : mul2(ax, -1)
  const n = left(along)                                                  // across the river
  const a = freeRun(isWater, p0, n, 150, 0.25), b = freeRun(isWater, p0, mul2(n, -1), 150, 0.25)
  const t = spec.across ?? 0                                              // −1 the −n bank … +1 the +n bank
  const towardN = dot2(n, bearing(spec.side ?? 0)) >= 0
  // moored: against the bank, eased out (≤ 5 m) until the whole hull clears the dockwall's kinks
  const at = (k) => (spec.mode === 'moored'
    ? (towardN ? add2(p0, mul2(n, a - K.B / 2 - (spec.gap ?? 0.8) - k)) : add2(p0, mul2(n, -(b - K.B / 2 - (spec.gap ?? 0.8) - k))))
    : add2(p0, mul2(n, (a - b) / 2 + ((t * (a + b)) / 2) * 0.8)))
  let p = null, ok = false
  for (let k = 0; k <= (spec.mode === 'moored' ? 5 : 0) && !ok; k += 0.5) {
    p = placeBoat(spec.kind, at(k), along, { y, livery: spec.livery ?? 0 })
    ok = boatCorners(p, 0.3).every(isWater)
  }
  return { boat: ok ? p : null, key: spec.key, ok, width: r3(a + b), tried: p }
}

export function riverBoats(spec, { isWater, y }) {
  const out = spec.boats.map((s) => riverBoat(s, { isWater, y }))
  return { boats: out.filter((r) => r.ok).map((r) => r.boat), report: out.map((r) => `${r.key}${r.ok ? '' : ` (dropped: not on the water at ${r.tried.x}, ${r.tried.z}; river ${r.width} m wide)`}`) }
}

// ── world/boats.json ────────────────────────────────────────────────────────────────────────────────────────────────
// { version, kinds: { kind: { file, L, B, liveries } }, lod1At (m), farAt (m), boats: [...] }, kinds only those used.
export const BOAT_LOD = { lod1At: 220, farAt: 2600 }
export function boatsJson(boats) {
  const used = [...new Set(boats.map((b) => b.k))].sort()
  const kinds = Object.fromEntries(used.map((k) => [k, { file: `${BOATS_DIR}/${BOAT_KINDS[k].file}`, L: BOAT_KINDS[k].L, B: BOAT_KINDS[k].B, lit: Boolean(BOAT_KINDS[k].lit), liveries: BOAT_KINDS[k].liveries }]))
  const sorted = [...boats].sort((p, q) => (p.k < q.k ? -1 : p.k > q.k ? 1 : p.x - q.x || p.z - q.z))
  return { version: BOATS_VERSION, ...BOAT_LOD, kinds, boats: sorted }
}

export const boatSource = (kind) => join(HERE, '..', 'heroes', 'out', 'boats', BOAT_KINDS[kind].file)

// Copy each used model into the world, meshopt-compressed like the tiles, and write boats.json. Returns the manifest
// entry, or null when no model exists (the app then simply draws no boats).
export async function writeBoats(outDir, boats) {
  const used = [...new Set(boats.map((b) => b.k))].filter((k) => existsSync(boatSource(k)))
  const kept = boats.filter((b) => used.includes(b.k))
  if (!kept.length) return null
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  mkdirSync(join(outDir, BOATS_DIR), { recursive: true })
  for (const k of used) {
    const doc = await io.readBinary(new Uint8Array(readFileSync(boatSource(k))))
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    await io.write(join(outDir, BOATS_DIR, BOAT_KINDS[k].file), doc)
  }
  writeFileSync(join(outDir, BOATS_FILE), JSON.stringify(boatsJson(kept)))
  return { file: BOATS_FILE, count: kept.length }
}

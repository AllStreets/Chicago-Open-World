// pipeline/lib/tilepack.js — split world layers into 500 m tiles and write compressed multi-layer glbs.
import polygonClipping from 'polygon-clipping'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { weld, meshopt, quantize } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { openRing, signedArea } from './geom.js'
import { tileKeyFor } from './tiles.js'

const close = (r) => [...r, r[0]]

export function clipPolysToTile(polys, { minX, minZ, maxX, maxZ }) {
  const rect = [[[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ], [minX, minZ]]]
  const out = []
  for (const p of polys) {
    let res
    try { res = polygonClipping.intersection([close(p.outer), ...p.holes.map(close)], rect) } catch { continue }
    for (const [outer, ...holes] of res) {
      const o = openRing(outer)
      if (o.length >= 3 && Math.abs(signedArea(o)) > 0.5) out.push({ outer: o, holes: holes.map(openRing), tags: p.tags })
    }
  }
  return out
}

export function splitLineByTiles(points) {
  const out = new Map()
  let curKey = null, cur = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const key = tileKeyFor([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    if (key !== curKey) {
      cur = [a, b]; curKey = key
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(cur)
    } else cur.push(b)
  }
  return out
}

let io = null
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  }
  return io
}

// ── X-0b: quantisation (Decision 5 · V1–V5). meshopt 'medium' as before (QUANTIZE: positions 14 bits per mesh volume,
// normals 10, generic 12; floats outside [0,1] kept). The only change: metric UVs (metres along walls, roofs, roads,
// water) snap to a 1/256 m grid — ≤ 2 mm, finer than any façade feature (≥ 2.7 cm) and close to float32's own ~1 mm at
// the world's 8–10 km UV values — so meshopt packs them (−9.5 MB, parity SSIM ≥ 0.9998 on static surfaces).
// Measured and rejected (V5): meshopt 'high' (its octahedral normal filter is 8-bit, below V2's 10) and 16-bit positions
// (V2 asks ≥ 16 bits / ≤ 1 cm at LOD0, but the corrected geometry moves edges by up to a pixel: parity SSIM 0.956–0.99
// on detail poses), so positions keep the 14 bits every baseline was taken with.
export const V2_LIMITS = { normalDeg: 0.25, uvM: 1 / 512 + 1e-6, fracCustom: 2.7e-4 }
export const POSITION_BITS = 14
export const UV_GRID = 256
export const METRIC_UV_LAYERS = new Set(['buildings', 'leaves', 'ground', 'water'])
// façades that read UVs as 0..1 per face (Crown Fountain faces 28, painted fields 24, Pilsen murals 30–33): never snapped
export const EXACT_UV_FACADES = new Set([24, 28, 30, 31, 32, 33])

export function snapUvs(m) {
  const uv = m.uvs, f = m.extra?.FACADE, out = new Float32Array(uv.length)
  for (let i = 0; i < uv.length; i++) {
    const keep = f && EXACT_UV_FACADES.has(Math.round(f[i >> 1]))
    out[i] = keep ? uv[i] : Math.round(uv[i] * UV_GRID) / UV_GRID
  }
  return out
}

function layersDoc(layers) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()
  const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr instanceof Float32Array ? arr : new Float32Array(arr)).setBuffer(buffer)
  for (const [name, m] of Object.entries(layers)) {
    if (!m || !m.positions.length) continue
    const prim = doc.createPrimitive().setAttribute('POSITION', acc(m.positions, 'VEC3')).setAttribute('NORMAL', acc(m.normals, 'VEC3'))
    if (m.uvs?.length) prim.setAttribute('TEXCOORD_0', acc(METRIC_UV_LAYERS.has(name) ? snapUvs(m) : m.uvs, 'VEC2'))
    if (m.colors?.length) prim.setAttribute('COLOR_0', acc(m.colors, 'VEC3'))
    for (const [k, arr] of Object.entries(m.extra || {})) prim.setAttribute(`_${k}`, acc(arr, 'SCALAR'))
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
  }
  return doc
}

export async function writeTileGlb(path, layers) {
  const doc = layersDoc(layers)
  await doc.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  mkdirSync(dirname(path), { recursive: true })
  await (await getIO()).write(path, doc)
}

// V2 measurement: the same quantisation writeTileGlb applies (minus weld/reorder, which only merge identical vertices
// and permute them), so every source vertex lines up with its quantised self. Max position error (m), normal angle
// error (°), UV error (m) and custom-attribute exactness per layer, against the unquantised source arrays.
export async function quantizationError(layers, { keepPositions = false } = {}) {
  await MeshoptEncoder.ready
  const doc = layersDoc(layers)
  await doc.transform(quantize({ pattern: /.*/, patternTargets: /.*/ })) // exactly meshopt 'medium'
  const out = {}
  for (const node of doc.getRoot().listNodes()) {
    const name = node.getName(), src = layers[name], prim = node.getMesh().listPrimitives()[0]
    const t = node.getTranslation(), s = node.getScale()
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0')
    const r = { verts: P.getCount(), positionM: 0, normalDeg: 0, uvM: 0, customExact: true, fracErr: 0, bits: P.getComponentType() === 5126 ? 32 : POSITION_BITS }
    if (keepPositions) r.positions = []
    const e = [], ne = [], u = []
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, e)
      const w = [e[0] * s[0] + t[0], e[1] * s[1] + t[1], e[2] * s[2] + t[2]]
      if (keepPositions) r.positions.push(w)
      r.positionM = Math.max(r.positionM, Math.hypot(w[0] - src.positions[i * 3], w[1] - src.positions[i * 3 + 1], w[2] - src.positions[i * 3 + 2]))
      N.getElement(i, ne)
      const a = [src.normals[i * 3], src.normals[i * 3 + 1], src.normals[i * 3 + 2]], la = Math.hypot(...a), lb = Math.hypot(...ne)
      if (la > 0 && lb > 0) r.normalDeg = Math.max(r.normalDeg, (Math.acos(Math.min(1, (a[0] * ne[0] + a[1] * ne[1] + a[2] * ne[2]) / (la * lb))) * 180) / Math.PI)
      if (T) { T.getElement(i, u); r.uvM = Math.max(r.uvM, Math.abs(u[0] - src.uvs[i * 2]), Math.abs(u[1] - src.uvs[i * 2 + 1])) }
    }
    for (const [k, arr] of Object.entries(src.extra || {})) {
      const A = prim.getAttribute(`_${k}`)
      for (let i = 0; i < arr.length; i++) {
        const d = Math.abs(A.getScalar(i) - arr[i])
        if (Number.isInteger(arr[i])) { if (d !== 0) r.customExact = false } else r.fracErr = Math.max(r.fracErr, d) // fractional customs (_SEED, glow intensity) keep the 12-bit quantisation they always had
      }
    }
    out[name] = r
  }
  return out
}

// Ground surfaces share one mesh per tile; the shader picks the texture by layer index.
// paving: brick plazas and paths (user, 2026-09-30). dockwall, riprap (D1): the river's vertical walls — concrete and
// sheet pile downtown, darker rubble-faced banks upriver — and the soffits under bridge decks over the Riverwalk
export const GROUND_LAYERS = ['roads', 'sidewalks', 'parks', 'pitches', 'beaches', 'rail', 'paving', 'dockwall', 'riprap']
export function mergeGroundLayers(layers) {
  const out = { positions: [], normals: [], uvs: [], layer: [] }
  for (const [name, m] of Object.entries(layers)) {
    const idx = GROUND_LAYERS.indexOf(name)
    if (idx < 0 || !m?.positions.length) continue
    for (const v of m.positions) out.positions.push(v)
    for (const v of m.normals) out.normals.push(v)
    for (const v of m.uvs) out.uvs.push(v)
    for (let i = 0; i < m.positions.length / 3; i++) out.layer.push(idx)
  }
  return { positions: out.positions, normals: out.normals, uvs: out.uvs, extra: { LAYER: new Float32Array(out.layer) } }
}

// 2 km blocks (4×4 tiles) for far-away detail.
export const BLOCK_TILES = 4
export const blockKeyFor = (tileKey) => tileKey.split('_').map((n) => Math.floor(Number(n) / BLOCK_TILES)).join('_')

// Like splitLineByTiles, but each piece remembers the point before its first vertex and after its last,
// so ribbons on both sides of a tile seam miter the shared vertex identically (no notch).
export function splitLineWithContext(points) {
  const out = new Map()
  let curKey = null, cur = null
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const key = tileKeyFor([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    if (key !== curKey) {
      if (cur) cur.after = b
      cur = { line: [a, b], before: points[i - 2] ?? null, after: null }
      curKey = key
      if (!out.has(key)) out.set(key, [])
      out.get(key).push(cur)
    } else cur.line.push(b)
  }
  return out
}

// Joins same-shaped layers (e.g. every tile's coarse glow into its 2 km block).
export function concatLayers(list) {
  const out = { positions: [], normals: [], uvs: [], colors: [], extra: {} }
  for (const m of list) {
    for (const k of ['positions', 'normals', 'uvs', 'colors']) for (const v of m[k] ?? []) out[k].push(v)
    for (const [k, arr] of Object.entries(m.extra ?? {})) { out.extra[k] ??= []; for (const v of arr) out.extra[k].push(v) }
  }
  out.extra = Object.fromEntries(Object.entries(out.extra).map(([k, v]) => [k, new Float32Array(v)]))
  return out
}

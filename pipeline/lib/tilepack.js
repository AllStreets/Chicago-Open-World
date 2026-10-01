// pipeline/lib/tilepack.js — split world layers into 500 m tiles and write compressed multi-layer glbs.
import polygonClipping from 'polygon-clipping'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { weld, meshopt, quantize, reorder } from '@gltf-transform/functions'
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

// ── X-0b: quantisation (Decision 5 · V2). meshopt 'medium' (QUANTIZE, no filters); 'high' was measured and rejected:
// its octahedral normal filter is 8-bit, below V2's 10. Tile and block positions get V2's 16 bits per axis within each
// mesh volume (a 500 m tile ≤ 0.8 cm of 3-D displacement; the old 14 bits allowed 3 cm, and gltf-transform filled the
// spare low bits with copies of the high ones, so 16 real bits pack no larger). A mesh whose volume is too big for its
// LOD's displacement limit at 16 bits (a tile layer reaching 1–2 km along a pier or a long building) keeps float32
// positions instead. Normals keep 10 bits, and metric UVs (metres along walls, roofs, roads, water) snap to a
// 1/256 m grid — ≤ 2 mm, finer than any façade feature (≥ 2.7 cm) and close to float32's own ~1 mm at the world's
// 8–10 km UV values — so meshopt can pack them.
export const V2_LIMITS = { lod0: { positionM: 0.01 }, lod1: { positionM: 0.05 }, block: { positionM: 0.05 }, normalBits: 10, normalDeg: 0.25, uvM: 1 / 512 + 1e-6, fracCustom: 2.7e-4 }
export const POSITION_BITS = { lod0: 16, lod1: 16, block: 16, model: 14 } // model: trains and other small meshes (unchanged)
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

// 16-bit signed normalised positions about each mesh's own centre and half-extent (gltf-transform's 'mesh' volume),
// only where the worst 3-D rounding error — √3/2 of a step — stays inside the LOD's V2 limit; other meshes stay float32.
const Q16 = 32767
function quantizePositions(doc, limitM) {
  for (const node of doc.getRoot().listNodes()) {
    const P = node.getMesh()?.listPrimitives()[0]?.getAttribute('POSITION')
    if (!P) continue
    const a = P.getArray(), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < a.length; i++) { const k = i % 3; if (a[i] < min[k]) min[k] = a[i]; if (a[i] > max[k]) max[k] = a[i] }
    const s = Math.max((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2) || 1
    if ((Math.sqrt(3) / 2) * (s / Q16) > limitM) continue
    const c = [0, 1, 2].map((k) => min[k] + (max[k] - min[k]) / 2), q = new Int16Array(a.length)
    for (let i = 0; i < a.length; i++) { const v = Math.max(-1, Math.min(1, (a[i] - c[i % 3]) / s)); q[i] = Math.sign(v) * Math.round(Math.abs(v) * Q16) }
    P.setArray(q).setNormalized(true)
    node.setTranslation(c).setScale([s, s, s])
  }
}

// the quantisation both writeTileGlb and quantizationError apply: positions as above, every other attribute exactly as
// meshopt 'medium' always did (normals 10, UVs in [0,1] 12, colours 8, generic 12 bits; floats outside the range kept)
async function quantizeTile(doc, lod) {
  quantizePositions(doc, V2_LIMITS[lod].positionM)
  await doc.transform(quantize({ pattern: /^(?!POSITION$).*/, patternTargets: /^(?!POSITION$).*/, quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8, quantizeGeneric: 12 }))
}

// lod: 'lod0' (a tile's full detail), 'lod1' (its far mesh), 'block' (2 km far block), 'model' (default: trains and
// other small meshes, meshopt 'medium' at 14 bits exactly as before)
export async function writeTileGlb(path, layers, { lod = 'model' } = {}) {
  const doc = layersDoc(layers)
  if (lod === 'model') await doc.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  else {
    await doc.transform(weld(), reorder({ encoder: MeshoptEncoder, target: 'size' }))
    await quantizeTile(doc, lod)
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  }
  mkdirSync(dirname(path), { recursive: true })
  await (await getIO()).write(path, doc)
}

// V2 measurement: the same quantisation writeTileGlb applies (minus weld/reorder, which only merge identical vertices
// and permute them), so every source vertex lines up with its quantised self. Max position error (m), normal angle
// error (°), UV error (m) and custom-attribute exactness per layer, against the unquantised source arrays.
export async function quantizationError(layers, { lod = 'model', keepPositions = false } = {}) {
  await MeshoptEncoder.ready
  const doc = layersDoc(layers)
  if (lod === 'model') await doc.transform(quantize({ pattern: /.*/, patternTargets: /.*/ })) // meshopt 'medium' defaults: 14-bit positions
  else await quantizeTile(doc, lod)
  const out = {}
  for (const node of doc.getRoot().listNodes()) {
    const name = node.getName(), src = layers[name], prim = node.getMesh().listPrimitives()[0]
    const t = node.getTranslation(), s = node.getScale()
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0')
    const r = { verts: P.getCount(), positionM: 0, normalDeg: 0, uvM: 0, customExact: true, fracErr: 0, bits: P.getComponentType() === 5126 ? 32 : POSITION_BITS[lod] ?? POSITION_BITS.model }
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
export const GROUND_LAYERS = ['roads', 'sidewalks', 'parks', 'pitches', 'beaches', 'rail', 'paving'] // paving: brick plazas and paths (user, 2026-09-30)
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

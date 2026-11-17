// pipeline/build/build-trains.js — the four rolling-stock models → app/public/world/trains.glb (V4).
// The models come from the scripted Blender build (heroes/scripts/trains.py → heroes/out/trains.glb: meshes
// cta5000, cta7000, metraCoach, metraLoco in the car frame, COLOR_0 = kind colour × baked occlusion, `_KIND` per
// vertex) when that file exists, else from the procedural lib/rollingstock.js. Either way the output is the same
// format: one node per model with position, normal, COLOR_0, _KIND and _ALONG, welded and meshopt-compressed.
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { writeTileGlb } from '../lib/tilepack.js'
import { toLayer } from '../lib/transit/meshkit.js'
import { buildRollingStock } from '../lib/rollingstock.js'
import { loadCatalog } from '../lib/transit/lines.js'

const HERE = dirname(fileURLToPath(import.meta.url))
export const HERO_TRAINS = join(HERE, '..', 'heroes', 'out', 'trains.glb')
export const TRAIN_MODELS = ['cta5000', 'cta7000', 'metraCoach', 'metraLoco']

// One node of the Blender export → a triangle-soup layer (the shape toLayer gives the procedural meshes).
function heroLayer(node) {
  const mat = node.getWorldMatrix(), out = { positions: [], normals: [], colors: [], kind: [], along: [] }
  const xf = (e, w) => [0, 1, 2].map((r) => mat[r] * e[0] + mat[4 + r] * e[1] + mat[8 + r] * e[2] + (w ? mat[12 + r] : 0))
  for (const prim of node.getMesh().listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0'), K = prim.getAttribute('_KIND')
    if (!P || !N || !C || !K) throw new Error(`trains: ${node.getName()} lacks POSITION, NORMAL, COLOR_0 or _KIND`)
    const idx = prim.getIndices(), n = idx ? idx.getCount() : P.getCount(), e = [], c = []
    for (let t = 0; t < n; t++) {
      const i = idx ? idx.getScalar(t) : t
      out.positions.push(...xf(P.getElement(i, e), true))
      const nn = xf(N.getElement(i, e), false), l = Math.hypot(...nn) || 1
      out.normals.push(nn[0] / l, nn[1] / l, nn[2] / l)
      C.getElement(i, c)
      out.colors.push(c[0], c[1], c[2])
      out.kind.push(Math.round(K.getScalar(i)))
      out.along.push(0)
    }
  }
  return out
}

export async function loadHeroTrains(path = HERO_TRAINS) {
  const doc = await new NodeIO().read(path)
  const nodes = Object.fromEntries(doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => [n.getName(), n]))
  return Object.fromEntries(TRAIN_MODELS.map((k) => {
    if (!nodes[k]) throw new Error(`trains: ${path} has no mesh named ${k}`)
    return [k, heroLayer(nodes[k])]
  }))
}

export async function writeTrainsGlb(path, catalog, { hero = HERO_TRAINS } = {}) {
  const models = hero && existsSync(hero) ? await loadHeroTrains(hero) : buildRollingStock(catalog)
  await writeTileGlb(path, Object.fromEntries(Object.entries(models).map(([k, m]) => [k, toLayer(m)])))
  return models
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(HERE, '..', '..', 'app', 'public', 'world', 'trains.glb')
  const models = await writeTrainsGlb(out, loadCatalog())
  const src = existsSync(HERO_TRAINS) ? 'heroes/out/trains.glb (Blender)' : 'lib/rollingstock.js (procedural)'
  console.log(`trains.glb written → ${out} from ${src}: ${Object.entries(models).map(([k, m]) => `${k} ${m.positions.length / 9} tris`).join(', ')}`)
}

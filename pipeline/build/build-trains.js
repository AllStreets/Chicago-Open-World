// pipeline/build/build-trains.js — the four rolling-stock models → app/public/world/trains.glb (V4).
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeTileGlb } from '../lib/tilepack.js'
import { toLayer } from '../lib/transit/meshkit.js'
import { buildRollingStock } from '../lib/rollingstock.js'
import { loadCatalog } from '../lib/transit/lines.js'

export async function writeTrainsGlb(path, catalog) {
  const models = buildRollingStock(catalog)
  await writeTileGlb(path, Object.fromEntries(Object.entries(models).map(([k, m]) => [k, toLayer(m)])))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'world', 'trains.glb')
  await writeTrainsGlb(out, loadCatalog())
  console.log(`trains.glb written → ${out}`)
}

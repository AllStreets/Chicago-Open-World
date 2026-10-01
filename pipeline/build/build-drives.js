// pipeline/build/build-drives.js — D3-3: the drives under the street (Lower Wacker) → app/src/data/rides.json `drives`,
// routed over public/world/traffic.bin (run build-traffic.js or build-world.js first). The buses and walks in
// rides.json are left as they are (build-rides.js keeps the drives in turn).
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DRIVES, driveRide } from '../lib/drives.js'
import { polyLength } from '../lib/rides.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORLD = join(ROOT, '..', 'app', 'public', 'world')
const OUT = join(ROOT, '..', 'app', 'src', 'data', 'rides.json')
const manifest = JSON.parse(readFileSync(join(WORLD, 'manifest.json'), 'utf8'))
const buf = readFileSync(join(WORLD, manifest.traffic ?? 'traffic.bin'))
const bin = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
if (bin[0] < 2) throw new Error('traffic.bin is v1 (no lower levels): run build-traffic.js first')
const drives = []
for (const d of DRIVES) {
  const r = driveRide(bin, d)
  if (!r) throw new Error(`drive ${d.id}: no route through its waypoints`)
  const { waypoints: _w, ...meta } = d
  drives.push({ ...meta, ...r })
  console.log(`  drive ${d.id}: ${(polyLength(r.path) / 1000).toFixed(2)} km, ${r.path.length} points, ${r.stops.length} stops, lowest ${Math.min(...r.path.map((p) => p[2]))} m`)
}
const rides = JSON.parse(readFileSync(OUT, 'utf8'))
writeFileSync(OUT, JSON.stringify({ ...rides, drives }))
console.log(`rides.json → ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(0)} KB)`)

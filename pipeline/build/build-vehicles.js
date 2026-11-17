// pipeline/build/build-vehicles.js — refresh only the road vehicles in the built world (app/public/world/vehicles/ and the
// manifest's `vehicles` entry) without a full build-world run: node pipeline/build/build-vehicles.js
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeVehicles, VEHICLES_DIR } from '../lib/vehicles.js'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'world')
const entry = await writeVehicles(OUT)
const mpath = join(OUT, 'manifest.json'), m = JSON.parse(readFileSync(mpath, 'utf8'))
m.vehicles = entry
writeFileSync(mpath, JSON.stringify(m))
if (entry) for (const f of readdirSync(join(OUT, VEHICLES_DIR))) console.log(`${VEHICLES_DIR}/${f} ${(statSync(join(OUT, VEHICLES_DIR, f)).size / 1e3).toFixed(0)} kB`)
console.log('manifest.vehicles =', JSON.stringify(entry))

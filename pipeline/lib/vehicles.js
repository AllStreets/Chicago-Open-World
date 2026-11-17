// pipeline/lib/vehicles.js — the Blender road vehicles (heroes/scripts/vehicles.py → heroes/out/vehicles/<kind>.glb) into the
// world: each model meshopt-compressed like the tiles into world/vehicles/, and the manifest entry the app's traffic reads
// ({ dir, kinds }). A kind whose model was never built is left out; with none the app keeps its box models.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const HERE = dirname(fileURLToPath(import.meta.url))
export const VEHICLES_DIR = 'vehicles'
// the app's vehicleModels.js VARIANTS draw these
export const VEHICLE_KINDS = ['sedan', 'suv', 'hatch', 'pickup', 'taxi', 'van', 'bus', 'semi', 'boxtruck']
export const vehicleSource = (kind) => join(HERE, '..', 'heroes', 'out', 'vehicles', `${kind}.glb`)

export async function writeVehicles(outDir) {
  rmSync(join(outDir, VEHICLES_DIR), { recursive: true, force: true })
  const kinds = VEHICLE_KINDS.filter((k) => existsSync(vehicleSource(k)))
  if (!kinds.length) return null
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  mkdirSync(join(outDir, VEHICLES_DIR), { recursive: true })
  for (const k of kinds) {
    const doc = await io.readBinary(new Uint8Array(readFileSync(vehicleSource(k))))
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    await io.write(join(outDir, VEHICLES_DIR, `${k}.glb`), doc)
  }
  return { dir: VEHICLES_DIR, kinds }
}

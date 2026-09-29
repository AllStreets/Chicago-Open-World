// Checks the built world on disk (skipped on a clone without app/public/world).
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'world')
const has = existsSync(join(OUT, 'manifest.json'))
const json = (f) => JSON.parse(readFileSync(join(OUT, f), 'utf8'))
const nodeNames = async (f) => {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  return (await io.read(join(OUT, f))).getRoot().listNodes().map((n) => n.getName())
}

describe.skipIf(!has)('built world — transit (V3)', () => {
  it('manifest v6 lists transit.json', () => {
    const m = json('manifest.json')
    expect(m.version).toBe(6); expect(m.transit).toBe('transit.json')
  })
  it('transit.json has the CTA lines in official colours, routes and stations', () => {
    const t = json('transit.json')
    for (const id of ['red', 'blue', 'brown', 'green', 'orange', 'pink', 'purple']) expect(t.lines.find((l) => l.id === id)).toBeTruthy()
    expect(t.lines.find((l) => l.id === 'red').colour).toBe('#c60c30')
    expect(t.routes.length).toBeGreaterThan(14); expect(t.stations.length).toBeGreaterThan(40)
    expect(t.stations.find((s) => /clark\s*\/\s*lake/i.test(s.name))).toBeTruthy()
  })
  it('the Tower 18 tile (-1_-1) carries structure, ties, stations and glow; the old deck and columns are gone', async () => {
    const names = await nodeNames('tiles/-1_-1.glb')
    for (const n of ['transit', 'ties', 'stations', 'glow']) expect(names).toContain(n)
    expect(names).not.toContain('elevated')
    expect(json('tiles/-1_-1.json').columns).toBeUndefined()
    expect(await nodeNames('tiles/-1_-1.lod1.glb')).toContain('glow')
  })
  it('V4: trains.glb, services and service data are built', async () => {
    expect(json('manifest.json').trains).toBe('trains.glb')
    expect((await nodeNames('trains.glb')).sort()).toEqual(['cta5000', 'cta7000', 'metraCoach', 'metraLoco'])
    const t = json('transit.json'), ids = new Set(t.routes.map((r) => r.id))
    expect(t.services.length).toBeGreaterThan(10)
    for (const sv of t.services) for (const r of sv.routes) expect(ids.has(r)).toBe(true)
    expect(t.lines.find((l) => l.id === 'red').service.headwayMin.peak).toBe(5)
  })
})

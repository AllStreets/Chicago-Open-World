// pipeline/tests/monuments.test.js — B-6: Lincoln Park's monuments. Each pedestal stands at its sourced coordinates
// (±3 m), the Hamilton reads gilded, the exedra wraps the Standing Lincoln's back, the Grant Memorial is 18.5 m tall.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildLandmark } from '../lib/landmarks.js'
import { project } from '../../shared/project.js'

const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes
const pts = (ms) => ms.flatMap((m) => { const o = []; for (let i = 0; i < m.mesh.positions.length; i += 3) o.push(m.mesh.positions.slice(i, i + 3)); return o })
const part = (r, p) => r.meshes.filter((m) => m.part === p)
const hi = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity)
const KEYS = ['lincolnstatues', 'grantstatue', 'goethestatue', 'schillerstatue', 'andersenstatue', 'franklinstatue', 'hamiltonstatue', 'altgeldstatue', 'signalofpeace', 'kwanusila']
const SOURCED = { schillerstatue: [41.92203, -87.63519], franklinstatue: [41.913806, -87.631083], hamiltonstatue: [41.93172, -87.63844], altgeldstatue: [41.932194, -87.637528], signalofpeace: [41.9332, -87.6315], kwanusila: [41.948972, -87.642444], andersenstatue: [41.91966, -87.63585] }
const build = (h) => { const c = project(h.match.lon, h.match.lat); return buildLandmark({ id: 't', height: 0, polygons: [{ outer: [[c[0] - 5, c[1] - 5], [c[0] + 5, c[1] - 5], [c[0] + 5, c[1] + 5], [c[0] - 5, c[1] + 5]], holes: [] }], centroid: c, area: 100 }, h.landmark) }

describe('Lincoln Park monuments (B-6)', () => {
  it('every monument is a hero with ⌘K aliases and https sources', () => {
    for (const k of KEYS) {
      const h = heroes.find((x) => x.key === k)
      expect(h, k).toBeTruthy(); expect(h.aliases.length, k).toBeGreaterThan(0)
      expect([h.source, ...(h.sources ?? [])].some((s) => /^https:\/\//.test(s)), k).toBe(true)
    }
    for (const q of ['Hans Christian Andersen', 'Alexander Hamilton', 'Signal of Peace', 'totem pole', 'Schiller statue', 'Benjamin Franklin', 'John Peter Altgeld', 'exedra']) expect(KEYS.some((k) => heroes.find((h) => h.key === k).aliases.includes(q)), q).toBe(true)
  })
  it('each pedestal stands at its sourced coordinates (±3 m)', () => {
    for (const [k, [lat, lon]] of Object.entries(SOURCED)) {
      const h = heroes.find((x) => x.key === k), r = build(h), want = project(lon, lat)
      const base = pts([...part(r, 'plinth'), ...part(r, 'pad')]), cx = base.reduce((a, p) => a + p[0], 0) / base.length, cz = base.reduce((a, p) => a + p[2], 0) / base.length
      expect(Math.hypot(cx - want[0], cz - want[1]), k).toBeLessThan(3)
    }
  })
  it('the Hamilton is gilded on red granite; the figures are Blender exports', () => {
    const h = heroes.find((x) => x.key === 'hamiltonstatue'), r = build(h)
    expect(part(r, 'figure')[0].style).toBe('gold-leaf'); expect(part(r, 'plinth')[0].style).toBe('lp-granite-red')
    for (const k of ['schiller', 'andersen', 'hamilton', 'franklin', 'signal', 'altgeld']) expect(existsSync(new URL(`../heroes/out/statue_${k}.glb`, import.meta.url)), k).toBe(true)
  })
  it('the Grant Memorial: 60 ft 9 in (18.5 m) to the top of the bronze, an arch through its terrace', () => {
    const r = build(heroes.find((x) => x.key === 'grantstatue'))
    expect(Math.abs(hi(pts(r.meshes).map((p) => p[1])) - 18.52)).toBeLessThan(0.3)
    expect(part(r, 'arch').length).toBe(1)
  })
  it('the exedra curves round the Standing Lincoln\'s back, 60 ft along its arc', () => {
    const h = heroes.find((x) => x.key === 'lincolnstatues'), r = build(h), c = project(h.match.lon, h.match.lat)
    const ex = pts(part(r, 'exedra'))
    const d = ex.map(([x, , z]) => Math.hypot(x - c[0], z - c[1]))
    expect(Math.min(...d)).toBeGreaterThan(7.5); expect(Math.max(...d)).toBeLessThan(11)
    // behind him: the figure faces bearing 270 (west), so the bench lies east of the statue
    expect(ex.reduce((a, p) => a + p[0], 0) / ex.length).toBeGreaterThan(c[0] + 2)
  })
  it('Kwanusila: 40 ft (12.2 m) of painted cedar', () => {
    const r = build(heroes.find((x) => x.key === 'kwanusila'))
    expect(Math.abs(hi(pts(r.meshes).map((p) => p[1])) - 12.2)).toBeLessThan(0.3)
    for (const p of ['pole', 'paint-black', 'paint-red', 'paint-teal']) expect(part(r, p).length, p).toBe(1)
  })
})

// The built world: every open storey the build found (pipeline/world-gaps.json) is closed in the tiles it ships in —
// slabs, a dark core and perimeter steel at LOD0 and LOD1 — and no sight line into it is see-through or hollow.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildingTris } from '../lib/tileTris.js'
import { auditGap } from '../lib/gaps.js'
import { styleIndex } from '../lib/styles.js'

const TILES = new URL('../../app/public/world/tiles/', import.meta.url)
const REPORT = new URL('../world-gaps.json', import.meta.url)
const DATA = JSON.parse(readFileSync(new URL('../data/gaps.json', import.meta.url), 'utf8')).buildings
const has = existsSync(REPORT) && existsSync(TILES)
const report = has ? JSON.parse(readFileSync(REPORT, 'utf8')).gaps : []


describe.skipIf(!has)('built world — open storeys are closed (user, 2026-10-02)', () => {
  it('the report lists every listed gap building, and the St. Regis blow-through', () => {
    const ids = new Set(report.map((g) => g.id))
    for (const [id, d] of Object.entries(DATA)) if (d.verdict !== 'data-error') expect([id, ids.has(id)]).toEqual([id, true])
    expect(report.some((g) => g.name === 'St. Regis Chicago' && g.kind === 'blow-through')).toBe(true)
    // a data error, once corrected, leaves no gap (McCormick Place's roof in feet)
    for (const [id, d] of Object.entries(DATA)) if (d.verdict === 'data-error') expect(report.filter((g) => g.id === id && g.kind !== 'facade')).toEqual([])
  })
  for (const g of report) {
    for (const lod of g.lod0 ? ['lod0', 'lod1'] : ['lod1']) {
      it(`${g.name ?? g.id} ${g.y0}–${g.y1} m (${g.kind}) at ${lod}: closed, never see-through, never hollow`, async () => {
        const { tris, styles } = await buildingTris(new URL(`${g.tile}${lod === 'lod1' ? '.lod1' : ''}.glb`, TILES).pathname, g.bldg)
        expect(tris.length).toBeGreaterThan(0)
        if (g.verdict !== 'sculpt' && (g.kind === 'storey' || g.kind === 'canopy')) { expect(styles.has(styleIndex('gap-steel'))).toBe(true); if (g.kind === 'storey') expect(styles.has(styleIndex('gap-core'))).toBe(true) }
        if (g.kind === 'blow-through') { expect(styles.has(styleIndex('stregis-steel'))).toBe(true); expect(styles.has(styleIndex('stregis-gap'))).toBe(true) }
        const a = auditGap(tris, g, { az: 16, seam: 0.3 }) // open air (a canopy, cantilever or arcade) may be looked under, never into
        expect(a.rays).toBeGreaterThan(100)
        expect({ through: a.through, hollow: a.hollow }).toEqual({ through: 0, hollow: 0 })
      }, 60_000)
    }
  }
})

// X-0e: the world-size ledger — per-folder MB, the delta against the last build, a 197 MB content cap under the 200 MB
// hard cap, and the sweep of outputs no current build writes.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUDGET, worldLedger, ledgerReport, checkBudget, sweepStale, STALE_OUTPUTS } from '../lib/budget.js'

const world = () => {
  const d = mkdtempSync(join(tmpdir(), 'w-'))
  mkdirSync(join(d, 'tiles')); writeFileSync(join(d, 'tiles', 'a.glb'), Buffer.alloc(1500)); writeFileSync(join(d, 'tiles', 'a.json'), Buffer.alloc(500))
  writeFileSync(join(d, 'manifest.json'), Buffer.alloc(100))
  return d
}

describe('world budget ledger (X-0e)', () => {
  it('caps: 197 MB for content stages, 200 MB hard', () => {
    expect(BUDGET.contentMB).toBe(197); expect(BUDGET.hardMB).toBe(200)
  })
  it('counts bytes per top-level folder and root file, plus tiles by kind', () => {
    const l = worldLedger(world())
    expect(l.total).toBe(2100)
    expect(l.entries).toEqual({ 'manifest.json': 100, tiles: 2000, 'tiles:glb': 1500, 'tiles:json': 500 })
  })
  it('reports MB and the delta against the previous ledger', () => {
    const lines = ledgerReport({ total: 3e6, entries: { tiles: 2e6, 'minimap.webp': 1e6 } }, { total: 4e6, entries: { tiles: 2.5e6, 'minimap.png': 1.5e6 } })
    expect(lines.join('\n')).toMatch(/tiles\s+2\.00 MB\s+-0\.50/)
    expect(lines.join('\n')).toMatch(/minimap\.png\s+0\.00 MB\s+-1\.50/)
    expect(lines.at(-1)).toMatch(/total\s+3\.00 MB\s+-1\.00/)
  })
  it('fails above the content cap, never above the hard cap', () => {
    expect(() => checkBudget(196.9e6)).not.toThrow()
    expect(() => checkBudget(197.1e6)).toThrow(/197 MB/)
    expect(() => checkBudget(201e6, { contentMB: 210 })).toThrow(/200 MB hard cap/)
  })
  it('sweeps outputs from earlier formats that nothing loads', () => {
    const d = world()
    for (const f of STALE_OUTPUTS) writeFileSync(join(d, f), 'x')
    expect(sweepStale(d).sort()).toEqual([...STALE_OUTPUTS].sort())
    for (const f of STALE_OUTPUTS) expect(existsSync(join(d, f))).toBe(false)
    expect(existsSync(join(d, 'manifest.json'))).toBe(true)
  })
})

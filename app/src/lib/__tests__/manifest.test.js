import { describe, it, expect } from 'vitest'
import { loadManifest } from '../manifest.js'

const res = (ok, body, status = 200) => async () => ({ ok, status, json: async () => body })

describe('loadManifest', () => {
  it('returns the manifest on success', async () => {
    const r = await loadManifest(res(true, { version: 1, tiles: [], ground: {} }))
    expect(r).toEqual({ ok: true, manifest: { version: 1, tiles: [], ground: {} } })
  })
  it('reports HTTP errors without throwing', async () => {
    expect(await loadManifest(res(false, null, 404))).toEqual({ ok: false, error: 'manifest HTTP 404' })
  })
  it('reports network errors and bad shapes without throwing', async () => {
    expect((await loadManifest(async () => { throw new Error('offline') })).ok).toBe(false)
    expect((await loadManifest(res(true, { nope: 1 }))).error).toBe('manifest malformed')
  })
})

describe('manifest v3', () => {
  it('accepts the streamed-world shape (tiles + land, no ground block)', async () => {
    const r = await loadManifest(async () => ({ ok: true, status: 200, json: async () => ({ version: 3, tiles: [], land: 'ground/land.glb' }) }))
    expect(r.ok).toBe(true)
  })
})

describe('groundFiles', () => {
  it('uses the manifest ground when present, else the known default paths', async () => {
    const { groundFiles, DEFAULT_GROUND } = await import('../manifest.js')
    expect(groundFiles({ ground: { land: 'a.glb', river: 'b.glb' } })).toEqual({ land: 'a.glb', river: 'b.glb' })
    expect(groundFiles(null)).toEqual(DEFAULT_GROUND)
    expect(DEFAULT_GROUND).toEqual({ land: 'ground/land.glb', river: 'ground/river.glb' })
  })
})

describe('worldUrl (review focus: no stale v3 files after a v4 rebuild)', () => {
  it('every world URL carries the manifest version', async () => {
    const { worldUrl } = await import('../manifest.js')
    expect(worldUrl('tiles/0_0.glb', 4)).toBe('/world/tiles/0_0.glb?v=4')
    expect(worldUrl('tiles/0_0.json', 4)).toBe('/world/tiles/0_0.json?v=4')
    expect(worldUrl('ground/land.glb')).toBe('/world/ground/land.glb')
  })
})

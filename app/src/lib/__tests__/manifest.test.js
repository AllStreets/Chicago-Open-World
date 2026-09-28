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

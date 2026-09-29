import { describe, it, expect, vi } from 'vitest'

vi.mock('../textureArray.js', () => ({ loadLayerArray: vi.fn(async () => ({})) }))

describe('loadFacadeTextures', () => {
  it('loads window masks with a 0 fallback so a missing mask never lights the wall', async () => {
    globalThis.fetch = vi.fn(async (u) => ({ ok: String(u).endsWith('facades.json'), json: async () => [{ family: 'x', index: 0, albedo: 'a.jpg', win: 'a-win.png', tileW: 1, tileH: 1, bays: 1, floors: 1 }] }))
    const { loadLayerArray } = await import('../textureArray.js')
    const { loadFacadeTextures } = await import('../facadeMaterial.js')
    await loadFacadeTextures()
    const winCall = loadLayerArray.mock.calls.find(([urls]) => urls[0].includes('-win'))
    expect(winCall[2]).toMatchObject({ srgb: false, fallback: 0 })
  })
})

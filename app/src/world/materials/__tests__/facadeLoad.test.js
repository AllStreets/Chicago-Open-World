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
  it('loads the four Pilsen mural layers into their own array (P3)', async () => {
    const { loadLayerArray } = await import('../textureArray.js')
    const { loadFacadeTextures, facadeUniforms } = await import('../facadeMaterial.js')
    loadLayerArray.mockClear()
    await loadFacadeTextures()
    const call = loadLayerArray.mock.calls.find(([urls]) => urls[0].includes('murals/'))
    expect(call[0]).toEqual([0, 1, 2, 3].map((k) => `/textures/murals/mural-${k}.jpg`))
    await Promise.resolve()
    expect(facadeUniforms.uMural).toBeDefined()
  })
})

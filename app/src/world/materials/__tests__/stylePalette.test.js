// app/src/world/materials/__tests__/stylePalette.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as THREE from 'three'
import { STYLE_COLS, srgbToLinear, hexLinear, paletteData, createStyleTexture } from '../stylePalette.js'
import { facadeUniforms, loadStylePalette } from '../facadeMaterial.js'

const row = { key: '311wacker', finish: 'granite', base: '#ffffff', glass: '#000000', mullion: '#808080', spandrel: '#ff0000', top: '#00ff00', topFromM: 5, topM: 10, roughness: 0.45, metalness: 0.05, crown: { kind: 'lantern', color: '#0000ff', fromM: 261, toM: 293, intensity: 1.6 } }

describe('style palette', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('sRGB → linear', () => {
    expect(srgbToLinear(0)).toBe(0); expect(srgbToLinear(1)).toBeCloseTo(1)
    expect(srgbToLinear(0.5)).toBeCloseTo(0.2140, 3)
    expect(hexLinear('#ff0000')).toEqual([1, 0, 0])
  })
  it('packs 7 texels per row; row 0 stays zero', () => {
    const { data, width, height } = paletteData([{ key: 'none' }, row])
    expect([width, height, STYLE_COLS]).toEqual([7, 2, 7])
    expect([...data.slice(0, 28)].every((v) => v === 0)).toBe(true)
    const t = (col) => [...data.slice((7 + col) * 4, (7 + col) * 4 + 4)]
    expect(t(0)).toEqual([1, 1, 1, 2])                 // base, finish index of granite
    expect(t(1)[3]).toBeCloseTo(0.45)                   // roughness
    expect(t(2)[3]).toBeCloseTo(0.05)                   // metalness
    expect(t(3).slice(0, 3)).toEqual([1, 0, 0])         // spandrel
    expect(t(4)).toEqual([0, 1, 0, 10])                 // top colour, topM
    expect(t(5)[2]).toBe(1); expect(t(5)[3]).toBeCloseTo(1.6)
    expect(t(6)).toEqual([261, 293, 2, 5])              // crown band, lantern = 2, topFromM
  })
  it('a row without crown light has kind 0 and intensity 0', () => {
    const { data } = paletteData([{ key: 'none' }, { ...row, crown: null }])
    expect(data[(7 + 5) * 4 + 3]).toBe(0); expect(data[(7 + 6) * 4 + 2]).toBe(0)
  })
  it('makes an exact float texture (no filtering, no mips)', () => {
    const tex = createStyleTexture([{ key: 'none' }, row])
    expect(tex).toBeInstanceOf(THREE.DataTexture)
    expect(tex.type).toBe(THREE.FloatType)
    expect(tex.magFilter).toBe(THREE.NearestFilter); expect(tex.minFilter).toBe(THREE.NearestFilter)
    expect(tex.generateMipmaps).toBe(false)
    expect([tex.image.width, tex.image.height]).toEqual([7, 2])
  })
  it('loadStylePalette installs the rows from the manifest', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, cols: 7, styles: [{ key: 'none' }, row] }) })))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/world/styles.json')
    expect(facadeUniforms.uStyleRows.value).toBe(2)
  })
  it('loadStylePalette keeps the default palette when styles.json fails', async () => {
    const before = facadeUniforms.uStylePal.value
    facadeUniforms.uStyleRows.value = 1
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    expect(await loadStylePalette({ styles: 'styles.json' })).toBe(false)
    expect(await loadStylePalette({})).toBe(false)           // a v4 world has no styles
    expect(facadeUniforms.uStylePal.value).toBe(before)
    expect(facadeUniforms.uStyleRows.value).toBe(1)
  })
})

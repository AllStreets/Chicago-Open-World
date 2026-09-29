// pipeline/tests/styles.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
import sharp from 'sharp'
import { STYLE_COLS, MAX_STYLES, styleEntry, createStyleRegistry, meshStyle, writeStylePalettePng } from '../lib/styles.js'

const look = (o = {}) => ({ material: 'test material', finish: 'granite', base: '#e6e4de', glass: '#3b4046', mullion: '#cfcac1', spandrel: '#e6e4de', source: 'https://x.example', ...o })

describe('style registry', () => {
  it('row 0 is "none"; heroes get 1..n in insertion order; re-adding a key reuses its row', () => {
    const r = createStyleRegistry()
    expect(r.add('willis', look())).toBe(1)
    expect(r.add('aon', look())).toBe(2)
    expect(r.add('willis', look({ base: '#000000' }))).toBe(1)
    expect(r.indexOf('aon')).toBe(2); expect(r.indexOf('nope')).toBe(0)
    expect(r.size).toBe(3)
    const j = r.toJSON()
    expect(j).toMatchObject({ version: 1, cols: STYLE_COLS })
    expect(j.styles[0]).toEqual({ key: 'none' })
  })
  it('styleEntry resolves finish presets, top defaults and crown light', () => {
    const e = styleEntry('311wacker', look({ crownLight: { kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6, source: 'https://x.example' } }))
    expect(e).toMatchObject({ key: '311wacker', finish: 'granite', roughness: 0.45, metalness: 0.05, top: '#e6e4de', topFromM: 0, topM: 0 })
    expect(e.crown).toEqual({ kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6 })
    expect(styleEntry('x', look({ crownLight: { kind: 'flood', color: '#ffffff', fromM: 0, toM: 10, intensity: 1, source: 'https://x.example', render: false } })).crown).toBeNull()
  })
  it('a reverted look (render:false) gets row 0 and no palette row', () => {
    const r = createStyleRegistry()
    expect(r.add('crownhall', look({ render: false, note: 'reverted' }))).toBe(0)
    expect(r.size).toBe(1)
  })
  it('registry stops at MAX_STYLES and returns 0', () => {
    const r = createStyleRegistry()
    for (let i = 1; i < MAX_STYLES; i++) expect(r.add(`k${i}`, look())).toBe(i)
    expect(r.add('overflow', look())).toBe(0)
    expect(r.size).toBe(MAX_STYLES)
  })
  it('meshStyle: body always, venue/landmark meshes only for listed parts', () => {
    const b = { styleIndex: 5, styleParts: ['column'] }
    expect(meshStyle(b)).toBe(5)
    expect(meshStyle(b, 'column')).toBe(5)
    expect(meshStyle(b, 'turf')).toBe(0)
    expect(meshStyle({})).toBe(0)
    expect(meshStyle({ styleIndex: 3 }, 'rim')).toBe(0)
  })
  it('writes an sRGB swatch sheet: 7 columns × rows, base colour in column 0', async () => {
    const r = createStyleRegistry(); r.add('aon', look())
    const path = join(mkdtempSync(join(tmpdir(), 'sp-')), 'p.png')
    await writeStylePalettePng(path, r.toJSON(), 4)
    const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([STYLE_COLS * 4, 2 * 4])
    const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
    expect(px(1, 5)).toEqual([0xe6, 0xe4, 0xde]) // row 1, column 0 = base
    expect(px(1, 1)).toEqual([0, 0, 0])          // row 0 = none = black
  })
})

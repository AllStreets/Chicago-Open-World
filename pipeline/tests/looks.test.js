// pipeline/tests/looks.test.js
import { describe, it, expect } from 'vitest'
import { FINISHES, FINISH_PRESETS, CROWN_KINDS, isHex, hexToRgb, validateLook } from '../lib/looks.js'

const ok = { material: 'black anodized aluminium, bronze glass', finish: 'metal', base: '#1c1b1a', glass: '#4a3a2c', mullion: '#121212', spandrel: '#1c1b1a', source: 'https://en.wikipedia.org/wiki/Willis_Tower' }

describe('looks', () => {
  it('six finishes (spec B.6), each with a shader preset', () => {
    expect(FINISHES).toEqual(['glass', 'metal', 'granite', 'limestone', 'terracotta', 'concrete'])
    for (const f of FINISHES) expect(FINISH_PRESETS[f]).toEqual({ roughness: expect.any(Number), metalness: expect.any(Number) })
    expect(CROWN_KINDS).toEqual(['none', 'flood', 'lantern'])
  })
  it('hex helpers', () => {
    expect(isHex('#1c1B1a')).toBe(true); expect(isHex('#fff')).toBe(false); expect(isHex(null)).toBe(false)
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
  })
  it('accepts a complete sourced look', () => {
    expect(validateLook(ok, 'willis')).toEqual([])
    expect(validateLook({ ...ok, source: ['https://a.example/x', 'https://b.example/y'] }, 'w')).toEqual([])
  })
  it('rejects a missing source, a non-https source, a bad finish and bad colours', () => {
    expect(validateLook({ ...ok, source: undefined }, 'w').join()).toMatch(/source/)
    expect(validateLook({ ...ok, source: 'http://x.example' }, 'w').join()).toMatch(/source/)
    expect(validateLook({ ...ok, finish: 'marble' }, 'w').join()).toMatch(/finish/)
    expect(validateLook({ ...ok, glass: 'bronze' }, 'w').join()).toMatch(/glass/)
    expect(validateLook(undefined, 'w')).toEqual(['w: no look block'])
  })
  it('a top colour needs a band above topFromM', () => {
    expect(validateLook({ ...ok, top: '#e8e8e6', topFromM: 442, topM: 443 }, 'w')).toEqual([])
    expect(validateLook({ ...ok, top: '#e8e8e6', topFromM: 442, topM: 442 }, 'w').join()).toMatch(/topM/)
  })
  it('crown light must be sourced, bounded and of a known kind', () => {
    const c = { kind: 'lantern', color: '#fff6e8', fromM: 261, toM: 293, intensity: 1.6, source: 'https://en.wikipedia.org/wiki/311_South_Wacker_Drive' }
    expect(validateLook({ ...ok, crownLight: c }, 'w')).toEqual([])
    expect(validateLook({ ...ok, crownLight: { ...c, kind: 'beacon' } }, 'w').join()).toMatch(/kind/)
    expect(validateLook({ ...ok, crownLight: { ...c, toM: 200 } }, 'w').join()).toMatch(/fromM/)
    expect(validateLook({ ...ok, crownLight: { ...c, intensity: 9 } }, 'w').join()).toMatch(/intensity/)
    expect(validateLook({ ...ok, crownLight: { ...c, source: undefined } }, 'w').join()).toMatch(/crownLight.source/)
  })
  it('a look switched off by evaluate-and-revert must say why', () => {
    expect(validateLook({ ...ok, render: false }, 'w').join()).toMatch(/note/)
    expect(validateLook({ ...ok, render: false, note: 'reverted: reads grey at dusk' }, 'w')).toEqual([])
  })
})

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('heroes.json looks (F1, F7)', () => {
  const heroes = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'heroes.json'), 'utf8')).heroes
  it('the 41 V2 heroes and 6 P2 buildings carry a valid, sourced look; landmarks colour through their material rows', () => {
    const looked = heroes.filter((h) => h.look)
    expect(looked).toHaveLength(41 + 6 + 1 + 35) // P3: Rookery, Monadnock, Marquette, Carbide & Carbon, Palmer House, Newberry; P4: the Waveland fieldhouse; river icons (A): 34 new looks and Union Station's
    expect(looked.flatMap((h) => validateLook(h.look, h.key))).toEqual([])
    for (const h of heroes.filter((x) => !x.look)) expect(h.landmark?.type ?? (h.sacred && 'sacred') ?? h.sculpt, h.key).toBeTruthy() // V6: styled per mesh; P3 churches keep sacred shaping; river structures (rail bridges, Centennial Fountain) style every mesh
  })
  it('the named targets read as specified (B.6)', () => {
    const L = Object.fromEntries(heroes.map((h) => [h.key, h.look]))
    expect(L.willis).toMatchObject({ finish: 'metal', base: '#1c1b1a', glass: '#2a241f' })
    expect(L.aon).toMatchObject({ finish: 'granite', base: '#e6e4de' })
    expect(L.trump).toMatchObject({ finish: 'glass', glass: '#9fb3c4' })
    expect(L.wrigleybldg).toMatchObject({ finish: 'terracotta', crownLight: { kind: 'flood' } })
    expect(L.tribune).toMatchObject({ finish: 'limestone', base: '#cfc6b3' })
    expect(L['311wacker'].crownLight).toMatchObject({ kind: 'lantern', fromM: 261, toM: 293 })
  })
})

// pipeline/tests/heroMethod.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { chooseMethod, METHOD_TRI_LIMIT } from '../lib/heroMethod.js'

const table = JSON.parse(readFileSync(new URL('../data/hero-methods.json', import.meta.url), 'utf8'))
const heroes = JSON.parse(readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')).heroes

describe('chooseMethod', () => {
  it('figurative work goes to Blender', () => {
    expect(chooseMethod({ figurative: true, parametric: false, procTrisEstimate: 5000 })).toBe('blender')
  })
  it('parametric forms stay procedural', () => {
    expect(chooseMethod({ figurative: false, parametric: true, procTrisEstimate: 30000 })).toBe('procedural')
  })
  it('non-parametric and over budget goes to Blender', () => {
    expect(chooseMethod({ figurative: false, parametric: false, procTrisEstimate: METHOD_TRI_LIMIT + 1 })).toBe('blender')
  })
  it('falls back to procedural when Blender is unavailable', () => {
    expect(chooseMethod({ figurative: true, parametric: false, procTrisEstimate: 0, blenderAvailable: false })).toBe('procedural')
  })
})

describe('hero-methods.json', () => {
  it('lists every hero key exactly once', () => {
    const listed = table.methods.map((m) => m.key)
    expect(new Set(listed).size).toBe(listed.length)
    for (const h of heroes) expect(listed).toContain(h.key)
  })
  it('every row agrees with the rule (mixed rows excepted) and gives a reason', () => {
    for (const m of table.methods) {
      expect(m.reason.length).toBeGreaterThan(10)
      if (m.method !== 'mixed') expect(chooseMethod(m.criteria)).toBe(m.method)
    }
  })
})

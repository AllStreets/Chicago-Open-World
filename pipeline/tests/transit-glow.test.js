import { describe, it, expect } from 'vitest'
import { createGlow, glowPiece, toGlowLayer, GLOW_LIFT_M } from '../lib/transit/glow.js'
import { hexToLinear } from '../lib/transit/meshkit.js'

const LOOP = { lines: ['brown', 'orange', 'pink'], colours: ['#62361b', '#f9461c', '#e27ea6'].map(hexToLinear), lineIndex: [2, 4, 5], intensity: [1, 1, 1] }

describe('glow ribbons', () => {
  it('one ribbon per line, side by side on shared trackage', () => {
    const g = createGlow()
    glowPiece(g, [[0, 7.2, 0], [10, 7.2, 0], [20, 7.2, 5]], LOOP)
    expect(g.positions.length / 3).toBe(3 * 2 * 6)
    expect(new Set(g.lane)).toEqual(new Set([-1, 0, 1])); expect(new Set(g.lanes)).toEqual(new Set([3]))
    expect(new Set(g.side)).toEqual(new Set([-1, 1])); expect(new Set(g.line)).toEqual(new Set([2, 4, 5]))
    expect(new Set(g.positions.filter((_, i) => i % 3 === 1))).toEqual(new Set([7.2 + GLOW_LIFT_M]))
    for (let i = 0; i < g.normals.length; i += 3) expect(Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2])).toBeCloseTo(1, 6)
    const brown = g.line.indexOf(2)
    expect(g.colors.slice(brown * 3, brown * 3 + 3)).toEqual(hexToLinear('#62361b'))
  })
  it('subway track is ghosted; the layer exposes every attribute per vertex', () => {
    const g = createGlow()
    glowPiece(g, [[0, -9, 0], [50, -9, 0]], { lines: ['red'], colours: [hexToLinear('#c60c30')], lineIndex: [0], intensity: [1] })
    expect(new Set(g.ghost)).toEqual(new Set([1]))
    const l = toGlowLayer(g)
    for (const k of ['SIDE', 'LANE', 'LANES', 'LINE', 'INTENSITY', 'GHOST']) expect(l.extra[k]).toHaveLength(6)
    expect(l.colors).toHaveLength(18)
  })
  it('does nothing for a piece with no lines or one point', () => {
    const g = createGlow()
    glowPiece(g, [[0, 7, 0]], LOOP); glowPiece(g, [[0, 7, 0], [9, 7, 0]], { lines: [], colours: [], lineIndex: [], intensity: [] })
    expect(g.positions).toHaveLength(0)
  })
})

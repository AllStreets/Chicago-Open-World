import { describe, it, expect } from 'vitest'
import { createSim } from '../sim.js'
import { TRANSIT } from './fixtures.js'
import { layoutCars, TRAIN_MESHES, SHADOW_CASTERS, MAX_TRAIN_CALLS, MODELS } from '../layout.js'

const trains = createSim(TRANSIT).trainsAt(Date.parse('2026-09-30T08:15:00-05:00'))
const t0 = trains.find((t) => t.line === 'red' && t.cars.every(Boolean))
const cam = [t0.cars[0].pos[0] + 20, 20, t0.cars[0].pos[2]]

describe('train layout', () => {
  it('the draw-call budget: four models, one impostor, one light sprite, two shadow casters = 8', () => {
    expect(TRAIN_MESHES).toEqual([...MODELS, 'impostor', 'lights'])
    expect(TRAIN_MESHES.length + SHADOW_CASTERS.length).toBe(MAX_TRAIN_CALLS)
    expect(MAX_TRAIN_CALLS).toBe(8)
  })
  it('near cars use their model, far ones a box; every car is clickable', () => {
    const L = layoutCars(trains, cam, { lod: 600 })
    for (const c of t0.cars) expect(L.cta5000.some((x) => x.pos === c.pos)).toBe(true)
    expect(L.impostor.length).toBeGreaterThan(0)
    expect(L.hits.length).toBe(trains.flatMap((t) => t.cars).filter(Boolean).length)
    expect(L.hits.every((h) => typeof h.trainId === 'string')).toBe(true)
  })
  it('leading cabs near the camera get a headlight flare and a track spill', () => {
    const L = layoutCars(trains, cam, { lod: 600 })
    expect(L.lights.length % 2).toBe(0); expect(L.lights.length).toBeGreaterThanOrEqual(2)
    expect(new Set(L.lights.map((l) => l.mode))).toEqual(new Set([0, 1]))
    const spill = L.lights.find((l) => l.mode === 1)
    expect(spill.pos[1]).toBeCloseTo(7.25, 2) // on the rail top, just above the deck
  })
  it('hidden lines and an empty world draw nothing', () => {
    const L = layoutCars(trains, cam, { hidden: ['red', 'purple', 'bnsf'] })
    expect(Object.values(L).every((a) => a.length === 0)).toBe(true)
    expect(layoutCars([], cam).hits).toEqual([])
  })
})

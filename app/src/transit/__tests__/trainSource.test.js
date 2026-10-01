// app/src/transit/__tests__/trainSource.test.js — live CTA or simulated, never mixed on one line (P5 Task 2).
import { describe, it, expect } from 'vitest'
import { pickTrains } from '../trainSource.js'

const sim = () => [{ id: 's1', line: 'red', s: 1 }, { id: 's2', line: 'up-n', s: 2 }]
const tracker = (n) => ({ size: () => n, trainsAt: () => (n ? [{ id: 'rn:801', lineId: 'red', line: 'red', s: 5, live: true }] : []) })
describe('pickTrains', () => {
  it('uses live CTA trains plus simulated Metra when the CTA feed is live', () => {
    const r = pickTrains({ ctaStatus: 'LIVE', tracker: tracker(1), simTrainsAt: sim, tMs: 0 })
    expect(r.map((t) => t.id).sort()).toEqual(['rn:801', 's2'])
  })
  it('falls back to the simulator when the feed is simulated or empty', () => {
    expect(pickTrains({ ctaStatus: 'SIMULATED', tracker: tracker(1), simTrainsAt: sim, tMs: 0 }).map((t) => t.id)).toEqual(['s1', 's2'])
    expect(pickTrains({ ctaStatus: 'LIVE', tracker: tracker(0), simTrainsAt: sim, tMs: 0 }).map((t) => t.id)).toEqual(['s1', 's2'])
    expect(pickTrains({ ctaStatus: 'LIVE', tracker: null, simTrainsAt: sim, tMs: 0 }).map((t) => t.id)).toEqual(['s1', 's2'])
  })
  it('decorates live trains for the renderer', () => {
    const r = pickTrains({ ctaStatus: 'LIVE', tracker: tracker(1), simTrainsAt: sim, tMs: 0, decorate: (t) => ({ ...t, cars: [1] }) })
    expect(r.find((t) => t.id === 'rn:801').cars).toEqual([1])
  })
})
